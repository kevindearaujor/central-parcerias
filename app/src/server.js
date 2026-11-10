// Servidor web da plataforma (sem dependências externas)
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { db, DATA_DIR, STAGES, OUT_STAGES, hashPassword, checkPassword, getSetting, setSetting, rowChat, rowMsg, publicUser } = require('./db');
const core = require('./core');
const evo = require('./evolution');
const push = require('./push');

const PORT = Number(process.env.PORT || 3000);
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MEDIA_DIR = path.join(DATA_DIR, 'media');
fs.mkdirSync(MEDIA_DIR, { recursive: true });
const SESSION_DAYS = 30;

if (!WEBHOOK_SECRET || WEBHOOK_SECRET.length < 16) {
  console.warn('[aviso] defina WEBHOOK_SECRET com pelo menos 16 caracteres no .env');
}

// ================= sessão =================
const secret = () => getSetting('session_secret');
function sign(v) { return crypto.createHmac('sha256', secret()).update(v).digest('base64url'); }
function makeToken(uid) {
  const exp = Date.now() + SESSION_DAYS * 864e5;
  const v = `${uid}.${exp}`;
  return `${v}.${sign(v)}`;
}
function readToken(tok) {
  const parts = String(tok || '').split('.');
  if (parts.length !== 3) return null;
  const v = `${parts[0]}.${parts[1]}`;
  const good = sign(v);
  if (good.length !== parts[2].length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(parts[2]))) return null;
  if (Number(parts[1]) < Date.now()) return null;
  return Number(parts[0]);
}
function cookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function currentUser(req) {
  const uid = readToken(cookies(req).sid);
  if (!uid) return null;
  const u = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(uid);
  return u || null;
}
function isHttps(req) { return req.headers['x-forwarded-proto'] === 'https'; }
function setSession(req, res, token, maxAge) {
  res.setHeader('Set-Cookie', `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isHttps(req) ? '; Secure' : ''}`);
}

// limite de tentativas: por aparelho + usuário (um erro de uma pessoa não trava as outras)
const attempts = new Map();
const MAX_TRIES = 8;
function triesFor(key) {
  const now = Date.now();
  const a = (attempts.get(key) || []).filter(t => now - t < 15 * 60e3);
  attempts.set(key, a);
  return a;
}
function clearTries(login) { for (const k of attempts.keys()) if (k.endsWith('|' + login)) attempts.delete(k); }

// ================= utilitários http =================
function send(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}
function fail(res, status, message) { send(res, status, { error: message }); }
async function readBody(req, limit = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(Object.assign(new Error('Arquivo muito grande'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(Object.assign(new Error('JSON inválido'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

const MIME = { '.webmanifest': 'application/manifest+json', '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || !path.extname(rel)) rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) return fail(res, 403, 'Proibido');
  fs.readFile(file, (err, buf) => {
    if (err) return fail(res, 404, 'Não encontrado');
    // páginas, scripts e estilos sempre conferem a versão nova (as atualizações aparecem sem limpar o cache)
    const fresh = !rel.startsWith('/icons/');
    const headers = { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': fresh ? 'no-cache' : 'public, max-age=300' };
    if (rel === '/sw.js') headers['Service-Worker-Allowed'] = '/';
    res.writeHead(200, headers);
    res.end(buf);
  });
}

// ================= rotas =================
const routes = [];
function route(method, pattern, handler, opts = {}) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler, ...opts });
}

function requireChat(user, ref) {
  const chat = core.getChatByRef(ref);
  if (!chat || !core.canSee(user, chat)) throw Object.assign(new Error('Conversa não encontrada'), { status: 404 });
  return chat;
}
function adminOnly(user) { if (user.role !== 'admin') throw Object.assign(new Error('Apenas administradores'), { status: 403 }); }

// ---- login ----
route('POST', '/api/login', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  const { email, password } = await readBody(req);
  const login = String(email || '').toLowerCase().trim();
  const key = `${ip}|${login}`;
  const tries = triesFor(key);
  if (tries.length >= MAX_TRIES) {
    const wait = Math.max(1, Math.ceil((tries[0] + 15 * 60e3 - Date.now()) / 60e3));
    return fail(res, 429, `Muitas tentativas com esse usuário. Tente de novo em ${wait} min, ou peça ao administrador uma senha nova.`);
  }
  const u = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1 AND deleted = 0').get(login);
  // aceita a senha mesmo com espaço sobrando no começo ou no fim (comum no corretor do celular)
  const ok = u && (checkPassword(password, u.pass) || checkPassword(String(password || '').trim(), u.pass));
  if (!ok) {
    tries.push(Date.now());
    const left = MAX_TRIES - tries.length;
    return fail(res, 401, left > 0 && left <= 3 ? `Usuário ou senha incorretos. Restam ${left} ${left === 1 ? 'tentativa' : 'tentativas'}.` : 'Usuário ou senha incorretos');
  }
  attempts.delete(key);
  setSession(req, res, makeToken(u.id), SESSION_DAYS * 86400);
  send(res, 200, { user: publicUser(u) });
}, { public: true });

route('POST', '/api/logout', async (req, res) => { setSession(req, res, '', 0); send(res, 200, { ok: true }); }, { public: true });

route('GET', '/api/bootstrap', async (req, res, { user }) => {
  send(res, 200, {
    me: publicUser(user),
    users: db.prepare('SELECT * FROM users ORDER BY name').all().map(publicUser),
    tags: db.prepare('SELECT * FROM tags ORDER BY id').all(),
    quickReplies: db.prepare('SELECT * FROM quick_replies ORDER BY shortcut').all(),
    stages: STAGES,
    outStages: OUT_STAGES,
    settings: { auto_distribute: getSetting('auto_distribute') === '1' },
    wa: { state: core.getWaState().state },
  });
});

// ---- conversas ----
route('GET', '/api/chats', async (req, res, { user, query }) => {
  const where = [];
  const vals = [];
  if (user.role !== 'admin') { where.push('((assigned_to IS NULL AND held = 0) OR assigned_to = ?)'); vals.push(user.id); }
  const f = query.get('filter') || 'all';
  if (f === 'mine') { where.push('assigned_to = ?'); vals.push(user.id); }
  if (f === 'queue') where.push('assigned_to IS NULL');
  if (f === 'unread') where.push('unread > 0');
  const stage = query.get('stage'); if (stage) { where.push('stage = ?'); vals.push(stage); }
  const broker = query.get('broker'); if (broker && user.role === 'admin') { where.push('assigned_to = ?'); vals.push(Number(broker)); }
  const s = (query.get('q') || '').trim();
  if (s) {
    const like = `%${s}%`;
    if (user.role === 'admin') {
      where.push('(name LIKE ? OR push_name LIKE ? OR phone LIKE ? OR last_text LIKE ? OR ad_title LIKE ?)');
      vals.push(like, like, `%${s.replace(/\D/g, '') || s}%`, like, like);
    } else {
      where.push('(name LIKE ? OR push_name LIKE ? OR last_text LIKE ? OR ad_title LIKE ?)');
      vals.push(like, like, like, like);
    }
  }
  const limit = Math.min(Number(query.get('limit')) || 500, 2000);
  const sql = `SELECT * FROM chats ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY COALESCE(last_at, created_at) DESC LIMIT ${limit}`;
  let rows = db.prepare(sql).all(...vals).map(rowChat);
  const tag = Number(query.get('tag'));
  if (tag) rows = rows.filter(c => c.tags.includes(tag));
  send(res, 200, { chats: rows.map(c => core.present(c, user)) });
});

route('GET', '/api/chats/:id', async (req, res, { user, params, query }) => {
  const chat = requireChat(user, params.id);
  const before = Number(query.get('before')) || Number.MAX_SAFE_INTEGER;
  const msgs = db.prepare('SELECT * FROM messages WHERE chat_id = ? AND ts < ? AND hidden = 0 ORDER BY ts DESC LIMIT 150').all(chat.id, before).reverse().map(rowMsg);
  if (!query.get('before')) core.refreshAvatar(chat);
  send(res, 200, { chat: core.present(chat, user), messages: msgs.map(core.presentMsg), hasMore: msgs.length === 150 });
});

route('POST', '/api/chats/:id/read', async (req, res, { user, params }) => {
  const chat = requireChat(user, params.id);
  if (chat.unread > 0) {
    const ids = db.prepare('SELECT id FROM messages WHERE chat_id = ? AND from_me = 0 ORDER BY ts DESC LIMIT ?').all(chat.id, Math.min(chat.unread, 20)).map(r => r.id);
    core.updateChat(user, chat, { unread: 0 });
    evo.markRead(chat.lid && !chat.phone ? chat.lid : chat.id, ids);
  }
  send(res, 200, { ok: true });
});

route('POST', '/api/chats/:id/send', async (req, res, { user, params }) => {
  const chat = requireChat(user, params.id);
  const { text, replyTo } = await readBody(req);
  if (!String(text || '').trim()) return fail(res, 400, 'Mensagem vazia');
  const msg = await core.sendText(user, chat, String(text).slice(0, 4000), replyTo ? String(replyTo) : null);
  send(res, 200, { message: core.presentMsg(msg) });
});

// Envio de arquivo em binário puro (aceita até 100 MB)
const MAX_UPLOAD = 100 * 1024 * 1024;
route('POST', '/api/chats/:id/upload', async (req, res, { user, params, query }) => {
  const chat = requireChat(user, params.id);
  const len = Number(req.headers['content-length'] || 0);
  if (len > MAX_UPLOAD) return fail(res, 413, 'Arquivo acima de 100 MB');
  const tmp = path.join(core.MEDIA_DIR, `up_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`);
  const size = await new Promise((resolve, reject) => {
    let n = 0; const out = fs.createWriteStream(tmp);
    req.on('data', c => { n += c.length; if (n > MAX_UPLOAD) { req.destroy(); out.destroy(); reject(Object.assign(new Error('Arquivo acima de 100 MB'), { status: 413 })); } });
    req.pipe(out); out.on('finish', () => resolve(n)); out.on('error', reject); req.on('error', reject);
  }).catch(e => { try { fs.unlinkSync(tmp); } catch {} throw e; });
  if (!size) { try { fs.unlinkSync(tmp); } catch {} return fail(res, 400, 'Arquivo vazio'); }
  const fileName = String(query.get('name') || 'arquivo').slice(0, 200);
  const caption = String(query.get('caption') || '').slice(0, 1000);
  try {
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    const baseUrl = host && host.includes('.') ? `https://${host}` : null;
    const msg = await core.sendFile(user, chat, { file: tmp, size, mime: req.headers['content-type'], fileName, caption, baseUrl });
    send(res, 200, { message: core.presentMsg(msg) });
  } catch (e) { try { fs.unlinkSync(tmp); } catch {} throw e; }
});

route('POST', '/api/chats/:id/media', async (req, res, { user, params }) => {
  const chat = requireChat(user, params.id);
  const { base64, mime, fileName, caption } = await readBody(req);
  if (!base64 || !mime) return fail(res, 400, 'Arquivo inválido');
  const msg = await core.sendMedia(user, chat, { base64: String(base64).replace(/^data:[^,]+,/, ''), mime, fileName: fileName || 'arquivo', caption });
  send(res, 200, { message: core.presentMsg(msg) });
});

route('POST', '/api/chats/:id/audio', async (req, res, { user, params }) => {
  const chat = requireChat(user, params.id);
  const { base64, mime } = await readBody(req);
  if (!base64) return fail(res, 400, 'Áudio vazio');
  send(res, 200, { message: core.presentMsg(await core.sendVoice(user, chat, { base64, mime })) });
});

route('POST', '/api/chats/:id/note', async (req, res, { user, params }) => {
  const chat = requireChat(user, params.id);
  const { text } = await readBody(req);
  if (!String(text || '').trim()) return fail(res, 400, 'Nota vazia');
  send(res, 200, { message: core.presentMsg(core.addNote(user, chat, String(text).slice(0, 4000))) });
});

route('PATCH', '/api/chats/:id', async (req, res, { user, params }) => {
  const chat = requireChat(user, params.id);
  const patch = await readBody(req);
  send(res, 200, { chat: core.present(core.updateChat(user, chat, patch), user) });
});

// ---- mídia (baixa da Evolution uma vez e guarda) ----
// mídia: guardada no servidor e entregue em pedaços (o PDF começa a abrir antes de baixar tudo)
const mediaInflight = new Map();
async function ensureMedia(m) {
  const file = core.mediaFile(m.id);
  if (fs.existsSync(file)) return file;
  if (!mediaInflight.has(m.id)) {
    mediaInflight.set(m.id, (async () => {
      const r = await evo.getMediaBase64(m.id);
      if (!r?.base64) return null;
      fs.writeFileSync(file, Buffer.from(r.base64, 'base64'));
      if (r.mimetype && !m.mime) db.prepare('UPDATE messages SET mime = ? WHERE id = ?').run(r.mimetype, m.id);
      return file;
    })().finally(() => mediaInflight.delete(m.id)));
  }
  return mediaInflight.get(m.id);
}
route('GET', '/api/media/:id', async (req, res, { user, params }) => {
  const m = db.prepare('SELECT * FROM messages WHERE id = ?').get(params.id);
  if (!m || !core.canSee(user, core.getChat(m.chat_id))) return fail(res, 404, 'Mídia não encontrada');
  const file = await ensureMedia(m);
  if (!file) return fail(res, 404, 'Mídia indisponível');
  const st = fs.statSync(file);
  const etag = `"${st.size.toString(36)}-${st.mtimeMs.toString(36)}"`;
  const headers = { 'Content-Type': (m.mime || 'application/octet-stream').split(';')[0], 'Cache-Control': 'private, max-age=2592000, immutable', ETag: etag, 'Accept-Ranges': 'bytes' };
  if (m.kind === 'document') headers['Content-Disposition'] = `inline; filename*=UTF-8''${encodeURIComponent(m.file_name || 'arquivo')}`;
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end(); }
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range) {
    let start = range[1] === '' ? st.size - Number(range[2]) : Number(range[1]);
    let end = range[1] !== '' && range[2] !== '' ? Number(range[2]) : st.size - 1;
    if (isNaN(start) || start < 0 || start >= st.size || end < start) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
    end = Math.min(end, st.size - 1);
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, 'Content-Length': st.size });
  fs.createReadStream(file).pipe(res);
});

route('POST', '/api/chats/:id/messages/:msg/edit', async (req, res, { user, params }) => {
  const chat = requireChat(user, params.id);
  const { text } = await readBody(req);
  send(res, 200, { message: core.presentMsg(await core.editMessage(user, chat, params.msg, text)) });
});
route('POST', '/api/chats/:id/messages/:msg/delete', async (req, res, { user, params }) => {
  const chat = requireChat(user, params.id);
  const { everyone } = await readBody(req);
  send(res, 200, { message: core.presentMsg(await core.deleteMessage(user, chat, params.msg, !!everyone)) });
});

// ---- foto do lead (guardada no servidor) ----
route('GET', '/api/avatar/:ref', async (req, res, { user, params }) => {
  const chat = requireChat(user, params.ref);
  const file = core.avatarFile(chat.ref);
  if (!fs.existsSync(file)) return fail(res, 404, 'Sem foto');
  const buf = fs.readFileSync(file);
  res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=86400', 'Content-Length': buf.length });
  res.end(buf);
});

// ---- avisos no celular ----
route('GET', '/api/push/key', async (req, res, { user }) => send(res, 200, { publicKey: push.vapidKeys().pub, devices: push.countFor(user.id) }));
route('POST', '/api/push/subscribe', async (req, res, { user }) => {
  const { subscription } = await readBody(req);
  push.subscribe(user.id, subscription);
  send(res, 200, { ok: true, devices: push.countFor(user.id) });
});
route('POST', '/api/push/unsubscribe', async (req, res) => {
  const { endpoint } = await readBody(req);
  push.unsubscribe(endpoint);
  send(res, 200, { ok: true });
});
route('POST', '/api/push/test', async (req, res, { user }) => {
  push.notifyUsers([user.id], { title: 'Quero Leads', body: 'Pronto! Os avisos de lead novo vão chegar assim.', tag: 'teste', url: '/' });
  send(res, 200, { ok: true, devices: push.countFor(user.id) });
});

// ---- painel ----
route('GET', '/api/dashboard', async (req, res, { user, query }) => {
  // days=0 é "Hoje": desde a meia-noite (fuso do servidor: America/Sao_Paulo)
  const raw = query.get('days');
  const days = raw === '0' ? 0 : Math.min(Math.max(Number(raw) || 30, 1), 365);
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const since = days === 0 ? midnight.getTime() : Date.now() - days * 864e5;
  const scope = user.role === 'admin' ? '' : ' AND assigned_to = ' + Number(user.id);
  const leads = db.prepare(`SELECT COUNT(*) n FROM chats WHERE created_at >= ?${scope}`).get(since).n;
  const fromAds = db.prepare(`SELECT COUNT(*) n FROM chats WHERE created_at >= ? AND origin = 'anuncio'${scope}`).get(since).n;
  const sales = db.prepare(`SELECT COUNT(*) n FROM chats WHERE stage = 'comprou' AND stage_changed_at >= ?${scope}`).get(since).n;
  const visits = db.prepare(`SELECT COUNT(*) n FROM chats WHERE stage IN ('agendamento','documento','aprovado','comprou') AND created_at >= ?${scope}`).get(since).n;
  const lost = db.prepare(`SELECT COUNT(*) n FROM chats WHERE stage IN ('perdido','arquivado') AND stage_changed_at >= ?${scope}`).get(since).n;
  const waiting = db.prepare(`SELECT COUNT(*) n FROM chats WHERE last_from_me = 0 AND unread > 0 AND stage NOT IN ('perdido','arquivado')${scope}`).get().n;
  const resp = db.prepare(`SELECT AVG(first_reply_at - created_at) a, COUNT(*) n FROM chats WHERE created_at >= ? AND first_reply_at IS NOT NULL AND first_reply_at >= created_at${scope}`).get(since);
  const byStage = db.prepare(`SELECT stage, COUNT(*) n FROM chats WHERE 1=1${scope} GROUP BY stage`).all();
  const byAd = db.prepare(`SELECT COALESCE(ad_title, 'Sem anúncio') title, COUNT(*) n FROM chats WHERE created_at >= ?${scope} GROUP BY title ORDER BY n DESC LIMIT 8`).all(since);
  const byBroker = user.role === 'admin'
    ? db.prepare(`SELECT u.id, u.name,
        (SELECT COUNT(*) FROM chats c WHERE c.assigned_to = u.id AND c.created_at >= ?) leads,
        (SELECT COUNT(*) FROM chats c WHERE c.assigned_to = u.id AND c.stage IN ('agendamento','documento','aprovado','comprou')) avancados,
        (SELECT COUNT(*) FROM chats c WHERE c.assigned_to = u.id AND c.stage = 'comprou') vendas,
        (SELECT AVG(c.first_reply_at - c.created_at) FROM chats c WHERE c.assigned_to = u.id AND c.created_at >= ? AND c.first_reply_at >= c.created_at) resp
        FROM users u WHERE u.active = 1 ORDER BY leads DESC`).all(since, since)
    : [];
  const perDay = db.prepare(`SELECT created_at FROM chats WHERE created_at >= ?${scope}`).all(since).map(r => r.created_at);
  send(res, 200, { days, leads, fromAds, sales, visits, lost, waiting, avgResponseMs: resp.a, byStage, byAd, byBroker, perDay });
});

// ---- usuários (admin) ----
route('GET', '/api/users', async (req, res, { user }) => { adminOnly(user); send(res, 200, { users: db.prepare('SELECT * FROM users ORDER BY name').all().map(publicUser) }); });
route('POST', '/api/users', async (req, res, { user }) => {
  adminOnly(user);
  const { name, username, email, password, role } = await readBody(req);
  // login pode ser um nome de usuário simples (ex: ana.paula) ou um e-mail
  const login = String(username || email || '').toLowerCase().trim();
  if (!String(name || '').trim() || !login || !password || String(password).length < 6) return fail(res, 400, 'Preencha nome, usuário e senha (mínimo 6 caracteres)');
  if (!login.includes('@') && !/^[a-z0-9._-]{3,30}$/.test(login)) return fail(res, 400, 'Usuário deve ter de 3 a 30 caracteres, só letras minúsculas, números, ponto, hífen ou sublinhado, sem espaços nem acentos');
  try {
    const pos = (db.prepare('SELECT MAX(queue_pos) m FROM users').get().m || 0) + 1;
    const r = db.prepare('INSERT INTO users(name, email, pass, role, created_at, queue_pos) VALUES(?, ?, ?, ?, ?, ?)')
      .run(String(name).trim(), login, hashPassword(password), role === 'admin' ? 'admin' : 'corretor', Date.now(), pos);
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
    core.pushAll('users_changed', {});
    send(res, 200, { user: publicUser(u) });
  } catch { fail(res, 400, 'Esse usuário já existe. Escolha outro.'); }
});
route('POST', '/api/users/:id/delete', async (req, res, { user, params }) => {
  adminOnly(user);
  const { transferTo } = await readBody(req);
  send(res, 200, core.deleteUser(user, Number(params.id), transferTo ? Number(transferTo) : null));
});
route('PATCH', '/api/users/:id', async (req, res, { user, params }) => {
  const id = Number(params.id);
  const body = await readBody(req);
  if (user.role !== 'admin' && id !== user.id) return fail(res, 403, 'Sem permissão');
  const sets = []; const vals = [];
  if (body.name) { sets.push('name = ?'); vals.push(String(body.name).trim()); }
  if (body.password) {
    if (String(body.password).length < 6) return fail(res, 400, 'Senha com mínimo de 6 caracteres');
    sets.push('pass = ?'); vals.push(hashPassword(body.password));
    const target = db.prepare('SELECT email FROM users WHERE id = ?').get(id);
    if (target) clearTries(target.email); // senha nova destrava o login na hora
  }
  if (user.role === 'admin' && body.username !== undefined) {
    const login = String(body.username).toLowerCase().trim();
    if (!login.includes('@') && !/^[a-z0-9._-]{3,30}$/.test(login)) return fail(res, 400, 'Usuário deve ter de 3 a 30 caracteres, só letras minúsculas, números, ponto, hífen ou sublinhado, sem espaços nem acentos');
    const other = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(login, id);
    if (other) return fail(res, 400, 'Esse usuário já existe. Escolha outro.');
    sets.push('email = ?'); vals.push(login);
  }
  if (user.role === 'admin') {
    if (body.role && id !== user.id) { sets.push('role = ?'); vals.push(body.role === 'admin' ? 'admin' : 'corretor'); }
    if (body.active !== undefined && id !== user.id) { sets.push('active = ?'); vals.push(body.active ? 1 : 0); }
  }
  if (!sets.length) return send(res, 200, { ok: true });
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
  core.pushAll('users_changed', {});
  send(res, 200, { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
});

// ---- etiquetas e respostas rápidas ----
function crud(table, fields, label) {
  route('POST', `/api/${table.replace('_', '-')}`, async (req, res, { user }) => {
    adminOnly(user);
    const b = await readBody(req);
    if (fields.some(f => !String(b[f] || '').trim())) return fail(res, 400, `Preencha ${label}`);
    const r = db.prepare(`INSERT INTO ${table}(${fields.join(', ')}) VALUES(${fields.map(() => '?').join(', ')})`).run(...fields.map(f => String(b[f]).trim()));
    core.pushAll('config_changed', {});
    send(res, 200, { item: db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(r.lastInsertRowid) });
  });
  route('PATCH', `/api/${table.replace('_', '-')}/:id`, async (req, res, { user, params }) => {
    adminOnly(user);
    const b = await readBody(req);
    const f = fields.filter(k => b[k] !== undefined);
    if (f.length) db.prepare(`UPDATE ${table} SET ${f.map(k => `${k} = ?`).join(', ')} WHERE id = ?`).run(...f.map(k => String(b[k]).trim()), Number(params.id));
    core.pushAll('config_changed', {});
    send(res, 200, { ok: true });
  });
  route('DELETE', `/api/${table.replace('_', '-')}/:id`, async (req, res, { user, params }) => {
    adminOnly(user);
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(Number(params.id));
    core.pushAll('config_changed', {});
    send(res, 200, { ok: true });
  });
}
crud('tags', ['name', 'color'], 'nome e cor');
crud('quick_replies', ['shortcut', 'text'], 'atalho e texto');

route('PATCH', '/api/settings', async (req, res, { user }) => {
  adminOnly(user);
  const b = await readBody(req);
  if (b.auto_distribute !== undefined) setSetting('auto_distribute', b.auto_distribute ? '1' : '0');
  core.pushAll('config_changed', {});
  send(res, 200, { settings: { auto_distribute: getSetting('auto_distribute') === '1' } });
});

// ---- fila de distribuição (admin) ----
route('GET', '/api/queue', async (req, res, { user }) => { adminOnly(user); send(res, 200, core.queueState()); });
route('PATCH', '/api/queue', async (req, res, { user }) => {
  adminOnly(user);
  const b = await readBody(req);
  if (b.auto !== undefined) setSetting('auto_distribute', b.auto ? '1' : '0');
  if (Array.isArray(b.order)) {
    const up = db.prepare('UPDATE users SET queue_pos = ? WHERE id = ?');
    b.order.map(Number).filter(Boolean).forEach((id, i) => up.run(i + 1, id));
  }
  if (b.member && b.member.id) db.prepare('UPDATE users SET queue_on = ? WHERE id = ?').run(b.member.on ? 1 : 0, Number(b.member.id));
  if (b.reassignOn !== undefined) setSetting('reassign_on', b.reassignOn ? '1' : '0');
  if (b.reassignMin !== undefined) setSetting('reassign_min', String(Math.min(Math.max(Number(b.reassignMin) || 5, 1), 120)));
  const hhmm = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || '')) ? String(v) : null;
  if (b.holdOn !== undefined) setSetting('hold_on', b.holdOn ? '1' : '0');
  if (b.holdStart !== undefined) { const v = hhmm(b.holdStart); if (!v) return fail(res, 400, 'Horário inválido'); setSetting('hold_start', v); }
  if (b.holdEnd !== undefined) { const v = hhmm(b.holdEnd); if (!v) return fail(res, 400, 'Horário inválido'); setSetting('hold_end', v); }
  if (b.releaseNow) core.releaseHeld(true);
  else if (b.holdOn !== undefined || b.holdStart !== undefined || b.holdEnd !== undefined) core.releaseHeld();
  core.pushAll('config_changed', {});
  send(res, 200, core.queueState());
});

// ---- conexão do WhatsApp (admin) ----
route('GET', '/api/wa/status', async (req, res, { user }) => {
  adminOnly(user);
  try {
    const state = await evo.connectionState();
    if (state !== core.getWaState().state) core.setWaState({ state, ...(state === 'open' ? { qr: null, pairingCode: null } : {}) });
  } catch (e) { core.setWaState({ state: 'offline', error: 'Não consegui falar com a Evolution API' }); }
  send(res, 200, core.getWaState());
});
route('POST', '/api/wa/connect', async (req, res, { user }) => {
  adminOnly(user);
  const { number } = await readBody(req);
  let state = await evo.connectionState();
  let qr = null; let pairingCode = null;
  if (state === 'missing') {
    const r = await evo.createInstance();
    qr = r?.qrcode?.base64 || null; pairingCode = r?.qrcode?.pairingCode || null;
    state = 'connecting';
  }
  try { await evo.setWebhook(); } catch (e) { console.warn('[wa] webhook:', e.message); }
  if (state !== 'open' && (number || !qr)) {
    const r = await evo.connect(number);
    qr = r?.base64 || qr; pairingCode = r?.pairingCode || pairingCode;
  }
  core.setWaState({ state: state === 'open' ? 'open' : 'connecting', qr: state === 'open' ? null : qr, pairingCode: state === 'open' ? null : pairingCode });
  send(res, 200, core.getWaState());
});
let profileCache = { at: 0, data: null };
// foto e nome do número conectado, visível para toda a equipe
route('GET', '/api/wa/profile', async (req, res, { query }) => {
  if (core.getWaState().state !== 'open') return send(res, 200, { connected: false });
  if (!profileCache.data || Date.now() - profileCache.at > 5 * 60e3 || query.get('fresh')) {
    profileCache = { at: Date.now(), data: await evo.ownProfile() };
  }
  send(res, 200, { connected: true, name: profileCache.data.name, picture: profileCache.data.picture });
});

route('POST', '/api/wa/logout', async (req, res, { user }) => {
  adminOnly(user);
  try { await evo.logout(); } catch (e) { console.warn('[wa] logout:', e.message); }
  core.setWaState({ state: 'close', qr: null, pairingCode: null });
  send(res, 200, core.getWaState());
});

// ---- tempo real ----
route('GET', '/api/events', async (req, res, { user }) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 3000\n\n');
  core.addClient(res, publicUser(user));
  res.write(`event: wa_state\ndata: ${JSON.stringify({ state: core.getWaState().state })}\n\n`);
  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 25000);
  req.on('close', () => { clearInterval(ping); core.removeClient(res); });
}, { stream: true });

// ================= servidor =================
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const pathname = url.pathname;
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');

  // webhook da Evolution (rede interna, protegido por segredo)
  if (req.method === 'POST' && pathname.startsWith('/webhook/')) {
    const tok = pathname.slice('/webhook/'.length).split('/')[0];
    if (!WEBHOOK_SECRET || tok !== WEBHOOK_SECRET) return fail(res, 403, 'Proibido');
    try { const body = await readBody(req, 160 * 1024 * 1024); core.handleWebhook(body); } catch (e) { console.error('[webhook]', e.message); }
    return send(res, 200, { ok: true });
  }

  if (pathname === '/health') return send(res, 200, { ok: true });

  // endereço temporário para o WhatsApp buscar um arquivo enviado (rede interna, token de uso único)
  if (req.method === 'GET' && pathname.startsWith('/interno/arquivo/')) {
    const t = core.takeTemp(pathname.split('/')[3]);
    if (!t || !fs.existsSync(t.file)) return fail(res, 404, 'Não encontrado');
    res.writeHead(200, { 'Content-Type': t.mime, 'Content-Length': fs.statSync(t.file).size, 'Content-Disposition': `attachment; filename="${encodeURIComponent(t.name)}"` });
    return fs.createReadStream(t.file).pipe(res);
  }

  if (pathname.startsWith('/api/')) {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = pathname.match(r.re);
      if (!m) continue;
      const params = {}; r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      const user = r.public ? null : currentUser(req);
      if (!r.public && !user) return fail(res, 401, 'Faça login');
      // proteção básica contra requisições de outros sites
      if (req.method !== 'GET' && req.headers['x-requested-with'] !== 'plataforma') return fail(res, 403, 'Requisição inválida');
      try { await r.handler(req, res, { user, params, query: url.searchParams }); }
      catch (e) {
        const status = e.status && e.status < 500 ? e.status : (e instanceof evo.EvoError ? 502 : 500);
        if (status >= 500) console.error('[api]', req.method, pathname, e.message);
        if (!res.headersSent) fail(res, status, e instanceof evo.EvoError ? 'O WhatsApp não respondeu. Verifique a conexão em Configurações.' : (e.message || 'Erro interno'));
      }
      return;
    }
    return fail(res, 404, 'Rota não encontrada');
  }

  if (req.method === 'GET') return serveStatic(req, res, pathname);
  fail(res, 405, 'Método não permitido');
});

// uploads grandes pelo celular podem demorar: não corta a conexão no meio
server.requestTimeout = 20 * 60e3;
server.headersTimeout = 60e3;

server.listen(PORT, () => {
  console.log(`Plataforma rodando na porta ${PORT}`);
  // checa o estado do WhatsApp ao iniciar
  setTimeout(async () => {
    try {
      const state = await evo.connectionState();
      core.setWaState({ state });
      if (state !== 'missing') await evo.setWebhook().catch(() => {});
    } catch { core.setWaState({ state: 'offline' }); }
  }, 3000);
});

module.exports = server;
