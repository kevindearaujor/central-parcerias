// Regras do sistema: conversas, mensagens, distribuição e tempo real
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DATA_DIR } = require('./db');
const { db, rowChat, rowMsg, getSetting, setSetting, STAGE_IDS, FUNNEL_IDS, newRef } = require('./db');
const evo = require('./evolution');
const push = require('./push');

// ================= avisos no celular =================
function displayName(c) { return c.name || c.push_name || 'Lead'; }
function queueAudience() {
  return db.prepare("SELECT id FROM users WHERE active = 1 AND (role = 'admin' OR (role = 'corretor' AND queue_on = 1))").all().map(u => u.id);
}
function adminIds() { return db.prepare("SELECT id FROM users WHERE active = 1 AND role = 'admin'").all().map(u => u.id); }
// kind: 'new' (lead novo), 'msg' (mensagem nova), 'assigned' (lead passou para alguém), 'queue' (voltou para a fila)
function notifyChat(c, kind, text) {
  try {
    if (!c) return;
    const name = displayName(c);
    const preview = String(text || c.last_text || '').slice(0, 120);
    const data = { tag: c.ref, url: `/?c=${encodeURIComponent(c.ref)}` };
    let to = [];
    if (c.held && !c.assigned_to) {
      // lead represado fora do horário: só o administrador fica sabendo
      data.title = kind === 'new' ? `Lead represado · ${c.ad_title || name}` : name;
      data.body = kind === 'new' ? `${name}: ${preview} (libera às ${getSetting('hold_end', '08:45')})` : preview;
      push.notifyUsers(adminIds(), data);
      return;
    }
    if (kind === 'new') {
      data.title = c.ad_title ? `Novo lead · ${c.ad_title}` : `Novo lead · ${name}`;
      data.body = c.assigned_to ? `${name}: ${preview}` : `${name} está na fila: ${preview}`;
      to = c.assigned_to ? [c.assigned_to, ...adminIds()] : queueAudience();
    } else if (kind === 'assigned') {
      data.title = `Lead para você · ${name}`;
      data.body = preview || 'Responda o quanto antes.';
      to = [c.assigned_to];
    } else if (kind === 'queue') {
      data.title = `Lead sem resposta na fila · ${name}`;
      data.body = preview;
      to = queueAudience();
    } else {
      data.title = name;
      data.body = preview;
      to = c.assigned_to ? [c.assigned_to] : queueAudience();
    }
    push.notifyUsers(to, data);
  } catch (e) { console.warn('[aviso]', e.message); }
}

const SHOW_GROUPS = process.env.SHOW_GROUPS === '1';

// ================= tempo real (SSE) =================
// clients: Map<res, user>
const clients = new Map();
let waState = { state: 'unknown', qr: null, pairingCode: null, updatedAt: 0 };

function sse(res, event, data) {
  try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {}
}
function addClient(res, user) { clients.set(res, user); }
function removeClient(res) { clients.delete(res); }

// O que cada usuário recebe de uma conversa: corretor nunca recebe o número
function present(chat, user) {
  if (!chat) return null;
  const { id, lid, ...rest } = chat;
  const admin = user && user.role === 'admin';
  return { ...rest, id: chat.ref, phone: admin ? chat.phone : null, phone_hidden: !admin };
}
function presentMsg(m) {
  if (!m) return null;
  const { chat_id, ...rest } = m;
  return rest;
}

function canSee(user, chat) {
  if (!user || !chat) return false;
  if (user.role === 'admin') return true;
  if (chat.held && chat.assigned_to == null) return false; // represado: só o administrador vê
  return chat.assigned_to == null || chat.assigned_to === user.id;
}

// envia a atualização só para quem pode ver a conversa
function pushChat(chat, prevAssigned) {
  for (const [res, user] of clients) {
    if (canSee(user, chat)) sse(res, 'chat', present(chat, user));
    else if (prevAssigned !== undefined && canSee(user, { assigned_to: prevAssigned })) sse(res, 'chat_removed', { id: chat.ref });
  }
}
function pushMessage(chat, message) {
  for (const [res, user] of clients) if (canSee(user, chat)) sse(res, 'message', { chatId: chat.ref, message: presentMsg(message) });
}
function pushAll(event, data) { for (const res of clients.keys()) sse(res, event, data); }
function pushAdmins(event, data) {
  for (const [res, user] of clients) if (user.role === 'admin') sse(res, event, data);
}

function setWaState(patch) {
  waState = { ...waState, ...patch, updatedAt: Date.now() };
  pushAdmins('wa', waState);
  pushAll('wa_state', { state: waState.state });
}
function getWaState() { return waState; }

// ================= conversas =================
const q = {
  chatById: db.prepare('SELECT * FROM chats WHERE id = ?'),
  chatByRef: db.prepare('SELECT * FROM chats WHERE ref = ?'),
  chatByLid: db.prepare('SELECT * FROM chats WHERE lid = ?'),
  insertChat: db.prepare(`INSERT INTO chats(id, lid, phone, push_name, origin, ad_title, ad_body, ad_url, ad_id, created_at, stage_changed_at, ref)
                          VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  msgById: db.prepare('SELECT * FROM messages WHERE id = ?'),
  insertMsg: db.prepare(`INSERT OR IGNORE INTO messages(id, chat_id, from_me, kind, body, mime, file_name, ts, status, author_id)
                         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  queueMembers: db.prepare("SELECT id, name, queue_on, queue_pos FROM users WHERE role = 'corretor' AND active = 1 ORDER BY queue_pos, id"),
  userById: db.prepare('SELECT * FROM users WHERE id = ?'),
};

function getChat(id) { return rowChat(q.chatById.get(id)); }
function getChatByRef(ref) { return rowChat(q.chatByRef.get(ref)); }

function phoneFromJid(jid) {
  if (!jid || !jid.endsWith('@s.whatsapp.net')) return null;
  return jid.split('@')[0].split(':')[0];
}

// Rodízio na ordem da fila, pulando quem está pausado
function peekNextBroker() {
  const all = q.queueMembers.all();
  const on = all.filter(u => u.queue_on);
  if (!on.length) return null;
  const last = Number(getSetting('rr_last', '0')) || 0;
  const i = all.findIndex(u => u.id === last);
  if (i < 0) return on[0];
  for (let k = 1; k <= all.length; k++) {
    const u = all[(i + k) % all.length];
    if (u.queue_on) return u;
  }
  return on[0];
}
function setNextBroker(id) {
  const all = q.queueMembers.all();
  const i = all.findIndex(u => u.id === id);
  if (i < 0) throw new Error('Corretor não está na fila');
  if (!all[i].queue_on) throw new Error('Esse corretor está pausado. Ative ele na fila primeiro.');
  // o rodízio continua a partir de quem vem antes dele na ordem
  setSetting('rr_last', String(all[(i - 1 + all.length) % all.length].id));
  setImmediate(broadcastQueuePos);
}
function nextBroker() {
  const b = peekNextBroker();
  if (b) { setSetting('rr_last', String(b.id)); setImmediate(broadcastQueuePos); }
  return b;
}
// Posição do corretor na fila (aparece para ele embaixo de "Conversas")
function myQueue(userId) {
  const u = q.userById.get(userId);
  if (!u || u.role !== 'corretor') return null;
  if (getSetting('auto_distribute') !== '1') return { state: 'off' };
  if (holdActive()) return { state: 'hold', end: getSetting('hold_end', '08:45') };
  if (!u.queue_on || !u.active) return { state: 'paused' };
  const all = q.queueMembers.all();
  const next = peekNextBroker();
  const start = Math.max(0, all.findIndex(x => x.id === next?.id));
  const order = [];
  for (let k = 0; k < all.length; k++) { const x = all[(start + k) % all.length]; if (x.queue_on) order.push(x.id); }
  const pos = order.indexOf(u.id) + 1;
  return pos ? { state: 'on', pos, total: order.length } : { state: 'paused' };
}
function broadcastQueuePos() {
  for (const [res, user] of clients) if (user.role !== 'admin') sse(res, 'queue_pos', myQueue(user.id) || {});
}
// Repasse: lead distribuído que ficou sem resposta vai para o próximo da fila
function reassignOverdue() {
  if (getSetting('auto_distribute') !== '1' || getSetting('reassign_on') !== '1') return;
  const mins = Math.max(1, Number(getSetting('reassign_min', '5')) || 5);
  const limit = Date.now() - mins * 60e3;
  const rows = db.prepare(`SELECT * FROM chats WHERE auto_assigned = 1 AND first_reply_at IS NULL AND assigned_to IS NOT NULL
    AND assigned_at < ? AND stage NOT IN ('perdido','arquivado')`).all(limit);
  for (const c of rows) {
    let tries = []; try { tries = JSON.parse(c.auto_tries || '[]'); } catch {}
    const all = q.queueMembers.all();
    const i = all.findIndex(u => u.id === c.assigned_to);
    let next = null;
    for (let k = 1; k <= all.length; k++) {
      const u = all[((i < 0 ? -1 : i) + k + all.length) % all.length];
      if (u && u.queue_on && !tries.includes(u.id) && u.id !== c.assigned_to) { next = u; break; }
    }
    const prev = q.userById.get(c.assigned_to);
    const prevName = prev ? prev.name : 'o corretor';
    let sys;
    if (next) {
      tries.push(next.id);
      db.prepare('UPDATE chats SET assigned_to = ?, assigned_at = ?, auto_tries = ? WHERE id = ?').run(next.id, Date.now(), JSON.stringify(tries), c.id);
      sys = addSystemMessage(c.id, `Sem resposta em ${mins} min. Lead passou de ${prevName} para ${next.name}.`);
    } else {
      db.prepare('UPDATE chats SET assigned_to = NULL, assigned_at = NULL, auto_assigned = 0 WHERE id = ?').run(c.id);
      sys = addSystemMessage(c.id, `Ninguém da fila respondeu em ${mins} min. Lead voltou para Não lidas.`);
    }
    const fresh = getChat(c.id);
    pushChat(fresh, c.assigned_to);
    pushMessage(fresh, sys);
    notifyChat(fresh, next ? 'assigned' : 'queue');
  }
}

// ===== horário de represamento =====
// Leads que chegam no horário configurado (ex.: 22:00 às 08:45) ficam só com o administrador
// e são liberados em fila quando o horário termina. Horário de Brasília.
function nowMinutesBR(d = new Date()) {
  try {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
    return Number(p.find(x => x.type === 'hour').value) * 60 + Number(p.find(x => x.type === 'minute').value);
  } catch {
    const m = (d.getUTCHours() * 60 + d.getUTCMinutes() - 180 + 1440) % 1440; // Brasília = UTC-3
    return m;
  }
}
const toMin = (s) => { const [h, m] = String(s || '').split(':').map(Number); return ((h || 0) * 60 + (m || 0)) % 1440; };
function holdActive(d) {
  if (getSetting('hold_on') !== '1') return false;
  const now = nowMinutesBR(d);
  const a = toMin(getSetting('hold_start', '22:00'));
  const b = toMin(getSetting('hold_end', '08:45'));
  if (a === b) return false;
  return a < b ? (now >= a && now < b) : (now >= a || now < b);
}
function heldCount() { return db.prepare('SELECT COUNT(*) n FROM chats WHERE held = 1').get().n; }
// Fim do horário: solta os represados, do mais antigo para o mais novo, na fila
function releaseHeld(force = false) {
  if (!force && holdActive()) return 0;
  const rows = db.prepare('SELECT * FROM chats WHERE held = 1 ORDER BY created_at').all();
  for (const c of rows) {
    const sys = [];
    db.prepare('UPDATE chats SET held = 0 WHERE id = ?').run(c.id);
    sys.push(addSystemMessage(c.id, 'Lead liberado para a equipe (chegou fora do horário)'));
    const out = c.stage === 'perdido' || c.stage === 'arquivado';
    let assigned = false;
    if (!out && c.assigned_to == null && getSetting('auto_distribute') === '1') {
      const b = nextBroker();
      if (b) {
        db.prepare('UPDATE chats SET assigned_to = ?, assigned_at = ?, auto_assigned = 1, auto_tries = ? WHERE id = ?').run(b.id, Date.now(), JSON.stringify([b.id]), c.id);
        sys.push(addSystemMessage(c.id, `Distribuído automaticamente para ${b.name}`));
        assigned = true;
      }
    }
    const fresh = getChat(c.id);
    pushChat(fresh);
    sys.forEach(s => pushMessage(fresh, s));
    if (!out) notifyChat(fresh, assigned ? 'assigned' : 'new');
  }
  if (rows.length) { console.log(`[represamento] ${rows.length} lead(s) liberado(s)`); pushAdmins('queue_changed', {}); }
  return rows.length;
}
let lastHold = null;
setInterval(() => {
  // virou o horário de represamento: atualiza a posição que o corretor vê
  try { const h = holdActive(); if (lastHold !== null && h !== lastHold) broadcastQueuePos(); lastHold = h; } catch {}
  try { releaseHeld(); } catch (e) { console.error('[represamento]', e.message); }
  try { reassignOverdue(); } catch (e) { console.error('[repasse]', e.message); }
}, 30e3);

function queueState() {
  const next = peekNextBroker();
  return {
    reassignOn: getSetting('reassign_on') === '1',
    reassignMin: Number(getSetting('reassign_min', '5')) || 5,
    auto: getSetting('auto_distribute') === '1',
    hold: { on: getSetting('hold_on') === '1', start: getSetting('hold_start', '22:00'), end: getSetting('hold_end', '08:45'), active: holdActive(), count: heldCount() },
    nextId: next ? next.id : null,
    members: q.queueMembers.all().map(u => ({ id: u.id, name: u.name, on: !!u.queue_on })),
  };
}

function addSystemMessage(chatId, text, authorId = null, ts = Date.now()) {
  const id = `sys_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  q.insertMsg.run(id, chatId, 1, 'system', text, null, null, ts, null, authorId);
  return rowMsg(q.msgById.get(id));
}

// Acha a conversa (por número ou por @lid) e cria se for nova
function findOrCreateChat({ jid, lid, pushName, fromMe, ad, ts }) {
  let chat = q.chatById.get(jid) || (lid ? q.chatByLid.get(lid) : null) || (lid ? q.chatById.get(lid) : null);
  if (chat) {
    // migração: conversa que começou só com @lid e agora sabemos o número
    if (chat.id !== jid && jid.endsWith('@s.whatsapp.net') && !q.chatById.get(jid)) {
      db.prepare('UPDATE chats SET id = ?, phone = ?, lid = COALESCE(lid, ?) WHERE id = ?').run(jid, phoneFromJid(jid), chat.id, chat.id);
      db.prepare('UPDATE messages SET chat_id = ? WHERE chat_id = ?').run(jid, chat.id);
      chat = q.chatById.get(jid);
    }
    const sets = [];
    const vals = [];
    if (lid && !chat.lid) { sets.push('lid = ?'); vals.push(lid); }
    if (!fromMe && pushName && pushName !== chat.push_name) { sets.push('push_name = ?'); vals.push(pushName); }
    if (ad && !chat.ad_title) {
      sets.push("origin = 'anuncio', ad_title = ?, ad_body = ?, ad_url = ?, ad_id = ?");
      vals.push(ad.title, ad.body, ad.url, ad.id);
    }
    if (sets.length) db.prepare(`UPDATE chats SET ${sets.join(', ')} WHERE id = ?`).run(...vals, chat.id);
    return { chat: getChat(chat.id), created: false };
  }
  const now = ts || Date.now();
  q.insertChat.run(jid, lid || null, phoneFromJid(jid), fromMe ? null : (pushName || null),
    ad ? 'anuncio' : 'whatsapp', ad?.title || null, ad?.body || null, ad?.url || null, ad?.id || null, now, now, newRef());
  return { chat: getChat(jid), created: true };
}

function onNewLead(chat) {
  const sys = [];
  if (chat.origin === 'anuncio') sys.push(addSystemMessage(chat.id, `Lead veio do anúncio${chat.ad_title ? `: ${chat.ad_title}` : ''}`, null, chat.created_at - 1));
  if (chat.assigned_to == null && holdActive()) {
    db.prepare('UPDATE chats SET held = 1 WHERE id = ?').run(chat.id);
    sys.push(addSystemMessage(chat.id, `Chegou fora do horário. Represado até as ${getSetting('hold_end', '08:45')}: só o administrador vê.`, null, chat.created_at));
  } else if (getSetting('auto_distribute') === '1' && chat.assigned_to == null) {
    const b = nextBroker();
    if (b) {
      db.prepare("UPDATE chats SET assigned_to = ?, assigned_at = ?, auto_assigned = 1, auto_tries = ? WHERE id = ?").run(b.id, Date.now(), JSON.stringify([b.id]), chat.id);
      sys.push(addSystemMessage(chat.id, `Distribuído automaticamente para ${b.name}`, null, chat.created_at));
    }
  }
  refreshAvatar(chat, { force: true });
  return sys;
}

// ================= foto de perfil =================
// O link da foto do WhatsApp expira em alguns dias, então a foto é baixada e guardada aqui.
const AVATAR_DIR = path.join(DATA_DIR, 'avatars');
const MEDIA_DIR = path.join(DATA_DIR, 'media');
fs.mkdirSync(MEDIA_DIR, { recursive: true });
function mediaFile(id) { return path.join(MEDIA_DIR, String(id).replace(/[^\w-]/g, '_')); }
// guarda a mídia que veio junto no aviso do WhatsApp (evita depender de baixar depois)
function saveIncomingMedia(id, data) {
  try {
    const b64 = data?.message?.base64 || data?.base64;
    if (!b64 || typeof b64 !== 'string') return;
    const file = mediaFile(id);
    if (!fs.existsSync(file)) fs.writeFileSync(file, Buffer.from(b64.replace(/^data:[^,]+,/, ''), 'base64'));
  } catch (e) { console.warn('[mídia]', e.message); }
}
fs.mkdirSync(AVATAR_DIR, { recursive: true });
const AVATAR_TTL = 24 * 3600e3;
function avatarFile(ref) { return path.join(AVATAR_DIR, `${String(ref).replace(/[^\w-]/g, '_')}.jpg`); }

async function refreshAvatar(chat, { force = false, url = null } = {}) {
  try {
    const cur = q.chatById.get(chat.id);
    if (!cur) return;
    if (!force && !url && cur.avatar_at && Date.now() - cur.avatar_at < AVATAR_TTL) return;
    db.prepare('UPDATE chats SET avatar_at = ? WHERE id = ?').run(Date.now(), cur.id);
    const pic = url || await evo.profilePicture(cur.phone || cur.lid || cur.id);
    const file = avatarFile(cur.ref);
    let avatar = null;
    if (pic) {
      const r = await fetch(pic, { signal: AbortSignal.timeout(15000) });
      if (r.ok) {
        fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
        avatar = `/api/avatar/${cur.ref}?v=${Date.now()}`;
      } else if (cur.avatar && fs.existsSync(file)) return; // falha temporária: mantém a foto que já tem
    } else {
      try { fs.unlinkSync(file); } catch {}
    }
    if (avatar !== cur.avatar) {
      db.prepare('UPDATE chats SET avatar = ? WHERE id = ?').run(avatar, cur.id);
      const c = getChat(cur.id); if (c) pushChat(c);
    }
  } catch (e) { /* sem foto não é erro */ }
}

// ================= leitura do conteúdo da mensagem =================
function unwrap(m) {
  let msg = m || {};
  for (let i = 0; i < 5; i++) {
    const inner = msg.ephemeralMessage?.message || msg.viewOnceMessage?.message ||
      msg.viewOnceMessageV2?.message || msg.viewOnceMessageV2Extension?.message ||
      msg.documentWithCaptionMessage?.message || msg.editedMessage?.message;
    if (!inner) break;
    msg = inner;
  }
  return msg;
}

function extractContent(raw) {
  const m = unwrap(raw);
  const out = { kind: 'other', body: '', mime: null, fileName: null, ctx: null, protocol: null };
  const pick = (k) => m[k];
  if (m.protocolMessage) { out.protocol = m.protocolMessage; return out; }
  if (m.reactionMessage) { out.kind = 'reaction'; out.body = m.reactionMessage.text || ''; out.reactTo = m.reactionMessage.key?.id; return out; }
  if (typeof m.conversation === 'string') { out.kind = 'text'; out.body = m.conversation; }
  else if (m.extendedTextMessage) { out.kind = 'text'; out.body = m.extendedTextMessage.text || ''; out.ctx = m.extendedTextMessage.contextInfo; }
  else if (pick('imageMessage')) { const x = m.imageMessage; out.kind = 'image'; out.body = x.caption || ''; out.mime = x.mimetype; out.ctx = x.contextInfo; }
  else if (pick('videoMessage')) { const x = m.videoMessage; out.kind = 'video'; out.body = x.caption || ''; out.mime = x.mimetype; out.ctx = x.contextInfo; }
  else if (pick('audioMessage')) { const x = m.audioMessage; out.kind = 'audio'; out.mime = x.mimetype; out.ctx = x.contextInfo; }
  else if (pick('documentMessage')) { const x = m.documentMessage; out.kind = 'document'; out.body = x.caption || ''; out.mime = x.mimetype; out.fileName = x.fileName || x.title || 'arquivo'; out.ctx = x.contextInfo; }
  else if (pick('stickerMessage')) { out.kind = 'sticker'; out.mime = m.stickerMessage.mimetype; }
  else if (pick('locationMessage') || pick('liveLocationMessage')) {
    const x = m.locationMessage || m.liveLocationMessage;
    out.kind = 'location'; out.body = `${x.degreesLatitude},${x.degreesLongitude}${x.name ? ` · ${x.name}` : ''}${x.address ? ` · ${x.address}` : ''}`;
  }
  else if (pick('contactMessage')) { out.kind = 'contact'; out.body = m.contactMessage.displayName || 'Contato'; }
  else if (pick('contactsArrayMessage')) { out.kind = 'contact'; out.body = (m.contactsArrayMessage.contacts || []).map(c => c.displayName).join(', '); }
  else if (pick('buttonsResponseMessage')) { out.kind = 'text'; out.body = m.buttonsResponseMessage.selectedDisplayText || ''; }
  else if (pick('listResponseMessage')) { out.kind = 'text'; out.body = m.listResponseMessage.title || ''; }
  else if (pick('templateButtonReplyMessage')) { out.kind = 'text'; out.body = m.templateButtonReplyMessage.selectedDisplayText || ''; }
  else if (pick('pollCreationMessage') || pick('pollCreationMessageV3')) { const x = m.pollCreationMessage || m.pollCreationMessageV3; out.kind = 'text'; out.body = `📊 Enquete: ${x.name}`; }
  return out;
}

function extractAd(data, content) {
  const ctx = content.ctx || data.contextInfo || data.message?.messageContextInfo || null;
  const ext = ctx?.externalAdReply || data.contextInfo?.externalAdReply;
  const campaign = data.campaign; // alguns forks enviam um objeto "campaign"
  const isAd = !!ext || ctx?.conversionSource === 'FB_Ads' || !!ctx?.ctwaClid || !!campaign;
  if (!isAd) return null;
  return {
    title: ext?.title || campaign?.title || campaign?.adTitle || 'Anúncio',
    body: ext?.body || campaign?.body || null,
    url: ext?.sourceUrl || campaign?.sourceUrl || null,
    id: ext?.sourceId || campaign?.sourceId || campaign?.adId || null,
  };
}

function preview(kind, body, fileName) {
  switch (kind) {
    case 'image': return '📷 ' + (body || 'Foto');
    case 'video': return '🎥 ' + (body || 'Vídeo');
    case 'audio': return '🎤 Áudio';
    case 'document': return '📄 ' + (fileName || 'Documento');
    case 'sticker': return 'Figurinha';
    case 'location': return '📍 Localização';
    case 'contact': return '👤 ' + (body || 'Contato');
    default: return body || '';
  }
}

function toMs(ts) {
  const n = Number(ts?.low ?? ts);
  if (!n) return Date.now();
  return n < 1e12 ? n * 1000 : n;
}

// ================= gravação de mensagem =================
function storeMessage({ chat, id, fromMe, kind, body, mime, fileName, ts, status, authorId }) {
  const r = q.insertMsg.run(id, chat.id, fromMe ? 1 : 0, kind || 'other', body ?? '', mime ?? null, fileName ?? null, ts, status || null, authorId || null);
  const isNew = r.changes > 0;
  const msg = rowMsg(q.msgById.get(id));
  if (!isNew) return { msg, isNew };

  // atualiza resumo da conversa (só se for a mais recente)
  const cur = q.chatById.get(chat.id);
  if (!cur.last_at || ts >= cur.last_at) {
    db.prepare('UPDATE chats SET last_text = ?, last_at = ?, last_from_me = ? WHERE id = ?')
      .run(preview(kind, body, fileName).slice(0, 200), ts, fromMe ? 1 : 0, chat.id);
  }
  if (!fromMe) db.prepare('UPDATE chats SET unread = unread + 1 WHERE id = ?').run(chat.id);
  if (fromMe && !cur.first_reply_at) {
    const hasInbound = db.prepare('SELECT 1 FROM messages WHERE chat_id = ? AND from_me = 0 LIMIT 1').get(chat.id);
    if (hasInbound) db.prepare('UPDATE chats SET first_reply_at = ? WHERE id = ?').run(ts, chat.id);
    // primeira resposta: o lead entra no funil
    if (cur.stage === 'novo' && hasInbound) db.prepare("UPDATE chats SET stage = 'tratativa', stage_changed_at = ? WHERE id = ?").run(ts, chat.id);
  }
  return { msg, isNew };
}

// ================= webhook da Evolution =================
function resolveJid(key = {}, data = {}) {
  let jid = key.remoteJid || data.remoteJid;
  let lid = null;
  if (!jid) return null;
  if (jid.endsWith('@lid')) {
    lid = jid;
    const alt = key.remoteJidAlt || key.senderPn || data.remoteJidAlt || data.phoneJid ||
      (data.phoneNumber ? `${String(data.phoneNumber).replace(/\D/g, '')}@s.whatsapp.net` : null);
    if (alt && alt.endsWith('@s.whatsapp.net')) jid = alt;
  } else if (key.remoteJidAlt && key.remoteJidAlt.endsWith('@lid')) {
    lid = key.remoteJidAlt;
  } else if (data.remoteJidLid) {
    lid = data.remoteJidLid;
  }
  return { jid, lid };
}

function ignorable(jid) {
  if (!jid) return true;
  if (jid === 'status@broadcast' || jid.endsWith('@broadcast') || jid.endsWith('@newsletter')) return true;
  if (jid.endsWith('@g.us') && !SHOW_GROUPS) return true;
  return false;
}

function handleUpsert(data) {
  const key = data.key || {};
  const r = resolveJid(key, data);
  if (!r || ignorable(r.jid) || !key.id) return;
  const fromMe = !!key.fromMe;
  const content = extractContent(data.message);

  // apagada / editada
  if (content.protocol) {
    const p = content.protocol;
    const target = p.key?.id;
    if (!target) return;
    const existing = q.msgById.get(target);
    if (!existing) return;
    if (p.type === 0 || p.type === 'REVOKE') {
      db.prepare('UPDATE messages SET deleted = 1 WHERE id = ?').run(target);
    } else if (p.editedMessage) {
      const ed = extractContent(p.editedMessage);
      db.prepare('UPDATE messages SET body = ?, edited = 1 WHERE id = ?').run(ed.body, target);
    } else return;
    const chat = getChat(existing.chat_id);
    if (chat) pushMessage(chat, rowMsg(q.msgById.get(target)));
    return;
  }
  if (content.kind === 'reaction') return; // reações não entram na linha do tempo

  const ad = !fromMe ? extractAd(data, content) : null;
  const ts = toMs(data.messageTimestamp);
  const { chat, created } = findOrCreateChat({ jid: r.jid, lid: r.lid, pushName: data.pushName, fromMe, ad, ts });

  const status = data.status || (fromMe ? 'SERVER_ACK' : null);
  if (['image', 'video', 'audio', 'document', 'sticker'].includes(content.kind)) saveIncomingMedia(key.id, data);
  const { msg: msg0, isNew } = storeMessage({
    chat, id: key.id, fromMe, kind: content.kind, body: content.body,
    mime: content.mime, fileName: content.fileName, ts, status,
  });
  let msg = msg0;
  // cliente respondeu citando uma mensagem
  const rid = content.ctx?.stanzaId;
  if (isNew && rid) {
    const orig = q.msgById.get(rid);
    const qt = orig ? replySnippet(orig) : (extractContent(content.ctx.quotedMessage).body || 'Mensagem');
    const rfm = orig ? orig.from_me : (content.ctx.participant ? 0 : 1);
    db.prepare('UPDATE messages SET reply_id = ?, reply_text = ?, reply_from_me = ? WHERE id = ?').run(rid, String(qt).slice(0, 300), rfm ? 1 : 0, key.id);
    msg = rowMsg(q.msgById.get(key.id));
  }
  if (!isNew) return;

  const sys = created && !fromMe ? onNewLead(chat) : [];
  // cliente voltou a falar com um lead perdido/arquivado: volta para o atendimento
  if (!fromMe && !created) {
    const cur = getChat(chat.id);
    if (cur.stage === 'perdido' || cur.stage === 'arquivado') {
      db.prepare('UPDATE chats SET stage = ?, prev_stage = NULL, stage_changed_at = ? WHERE id = ?').run(restoreStage(cur), Date.now(), chat.id);
      sys.push(addSystemMessage(chat.id, 'O cliente voltou a conversar. Lead reativado.'));
    }
  }
  const fresh = getChat(chat.id);
  pushChat(fresh);
  pushMessage(fresh, msg);
  for (const s of sys) pushMessage(fresh, s);
  if (!fromMe && !created) refreshAvatar(fresh);
  if (!fromMe) notifyChat(fresh, created ? 'new' : 'msg', preview(content.kind, content.body, content.fileName));
}

const STATUS_RANK = { ERROR: 0, PENDING: 1, SERVER_ACK: 2, DELIVERY_ACK: 3, READ: 4, PLAYED: 5 };
function handleUpdate(data) {
  const list = Array.isArray(data) ? data : [data];
  for (const u of list) {
    const id = u.keyId || u.key?.id || u.messageId;
    const status = u.status || u.update?.status;
    if (!id || !status) continue;
    const m = q.msgById.get(id);
    if (!m) continue;
    const next = String(status).toUpperCase();
    if ((STATUS_RANK[next] ?? -1) <= (STATUS_RANK[m.status] ?? -1)) continue;
    db.prepare('UPDATE messages SET status = ? WHERE id = ?').run(next, id);
    const chat = getChat(m.chat_id);
    if (chat) pushMessage(chat, rowMsg(q.msgById.get(id)));
  }
}

function handleWebhook(body) {
  if (!body || typeof body !== 'object') return;
  const event = String(body.event || '').toLowerCase().replace(/_/g, '.');
  const data = body.data;
  switch (event) {
    case 'messages.upsert':
    case 'send.message':
      (Array.isArray(data) ? data : (data?.messages || [data])).forEach(d => { try { handleUpsert(d); } catch (e) { console.error('[webhook upsert]', e); } });
      break;
    case 'messages.update':
      handleUpdate(data);
      break;
    case 'connection.update': {
      const state = data?.state || 'close';
      setWaState({ state, qr: state === 'open' ? null : waState.qr, pairingCode: state === 'open' ? null : waState.pairingCode, number: data?.wuid || waState.number });
      break;
    }
    case 'qrcode.updated': {
      const qr = data?.qrcode?.base64 || data?.base64 || null;
      const pairingCode = data?.qrcode?.pairingCode || data?.pairingCode || null;
      setWaState({ state: 'connecting', qr, pairingCode });
      break;
    }
    case 'contacts.update': {
      (Array.isArray(data) ? data : [data]).forEach(c => {
        const jid = c?.remoteJid || c?.id;
        const url = c?.profilePicUrl || c?.profilePictureUrl;
        if (!jid || !url) return;
        const chat = q.chatById.get(jid) || q.chatByLid.get(jid);
        if (chat) refreshAvatar(chat, { url });
      });
      break;
    }
    default: break;
  }
}

// ================= ações da equipe =================
function numberFor(chat) { return chat.phone || chat.id; }

function replySnippet(m) {
  if (!m) return '';
  if (m.deleted) return 'Mensagem apagada';
  const tag = { image: '📷 Foto', video: '🎥 Vídeo', audio: '🎤 Áudio', document: '📄 ' + (m.file_name || 'Documento'), sticker: 'Figurinha', location: '📍 Localização', contact: '👤 Contato' }[m.kind];
  return String(m.body ? (tag && m.kind !== 'document' ? `${tag} · ${m.body}` : m.body) : (tag || '')).slice(0, 300);
}
async function sendText(user, chat, text, replyId) {
  let quoted = null;
  const orig = replyId ? q.msgById.get(replyId) : null;
  if (orig && orig.chat_id === chat.id && !['system', 'note'].includes(orig.kind)) {
    quoted = { id: orig.id, remoteJid: chat.phone ? `${chat.phone}@s.whatsapp.net` : (chat.lid || chat.id), fromMe: !!orig.from_me, text: replySnippet(orig) };
  }
  const res = await evo.sendText(numberFor(chat), text, quoted);
  const id = res?.key?.id || `out_${Date.now()}`;
  const ts = res?.messageTimestamp ? toMs(res.messageTimestamp) : Date.now();
  const { msg } = storeMessage({ chat, id, fromMe: true, kind: 'text', body: text, ts, status: res?.status || 'PENDING', authorId: user.id });
  db.prepare('UPDATE messages SET author_id = COALESCE(author_id, ?) WHERE id = ?').run(user.id, id);
  if (quoted) db.prepare('UPDATE messages SET reply_id = ?, reply_text = ?, reply_from_me = ? WHERE id = ?').run(quoted.id, quoted.text, quoted.fromMe ? 1 : 0, id);
  claimIfQueue(user, chat);
  const fresh = getChat(chat.id);
  pushChat(fresh);
  const m = rowMsg(q.msgById.get(id)) || msg;
  pushMessage(fresh, m);
  return m;
}

async function sendMedia(user, chat, { base64, mime, fileName, caption }) {
  const mediatype = mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'document';
  const res = await evo.sendMedia(numberFor(chat), { mediatype, mimetype: mime, base64, fileName, caption });
  const id = res?.key?.id || `out_${Date.now()}`;
  const ts = res?.messageTimestamp ? toMs(res.messageTimestamp) : Date.now();
  storeMessage({ chat, id, fromMe: true, kind: mediatype, body: caption || '', mime, fileName, ts, status: res?.status || 'PENDING', authorId: user.id });
  db.prepare('UPDATE messages SET author_id = COALESCE(author_id, ?) WHERE id = ?').run(user.id, id);
  claimIfQueue(user, chat);
  const fresh = getChat(chat.id);
  pushChat(fresh);
  const m = rowMsg(q.msgById.get(id));
  pushMessage(fresh, m);
  return m;
}

// Arquivo grande: o WhatsApp busca o arquivo num endereço interno temporário (sem passar tudo pelo JSON)
const MAX_MEDIA = 16 * 1024 * 1024;       // fotos e vídeos acima disso vão como documento
const temp = new Map();                     // token -> { file, mime, name, exp }
// O endereço precisa ser o público (com .com.br): a ponte do WhatsApp não aceita endereços internos sem domínio
function tempUrl(file, mime, name, baseUrl) {
  const token = require('node:crypto').randomBytes(24).toString('base64url');
  temp.set(token, { file, mime, name, exp: Date.now() + 15 * 60e3 });
  const base = baseUrl || new URL(evo.WEBHOOK_URL).origin;
  return { token, url: `${base}/interno/arquivo/${token}/${encodeURIComponent(name || 'arquivo')}` };
}
function takeTemp(token) {
  const t = temp.get(token);
  if (!t || t.exp < Date.now()) { temp.delete(token); return null; }
  return t;
}
setInterval(() => { for (const [k, t] of temp) if (t.exp < Date.now()) temp.delete(k); }, 60e3);

async function sendFile(user, chat, { file, size, mime, fileName, caption, baseUrl }) {
  mime = (mime || 'application/octet-stream').split(';')[0];
  let mediatype = mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'document';
  if ((mediatype === 'image' || mediatype === 'video' || mediatype === 'audio') && size > MAX_MEDIA) mediatype = 'document';
  const { token, url } = tempUrl(file, mime, fileName, baseUrl);
  let res;
  try { res = await evo.sendMedia(numberFor(chat), { mediatype, mimetype: mime, base64: url, fileName, caption }); }
  catch (e) {
    // plano B: se a ponte recusar o endereço, manda o arquivo direto (até 40 MB)
    if (!(e instanceof evo.EvoError) || size > 40 * 1024 * 1024) throw e;
    console.warn('[arquivo] envio por endereço recusado, tentando direto:', e.message.slice(0, 200));
    res = await evo.sendMedia(numberFor(chat), { mediatype, mimetype: mime, base64: fs.readFileSync(file).toString('base64'), fileName, caption });
  }
  finally { temp.delete(token); }
  const id = res?.key?.id || `out_${Date.now()}`;
  const ts = res?.messageTimestamp ? toMs(res.messageTimestamp) : Date.now();
  try { fs.renameSync(file, mediaFile(id)); } catch { try { fs.unlinkSync(file); } catch {} }
  storeMessage({ chat, id, fromMe: true, kind: mediatype, body: caption || '', mime, fileName, ts, status: res?.status || 'PENDING', authorId: user.id });
  db.prepare('UPDATE messages SET author_id = COALESCE(author_id, ?) WHERE id = ?').run(user.id, id);
  claimIfQueue(user, chat);
  const fresh = getChat(chat.id);
  pushChat(fresh);
  const m = rowMsg(q.msgById.get(id));
  pushMessage(fresh, m);
  return m;
}

// ================= marcar como não lida =================
function markUnread(user, chat) {
  db.prepare('UPDATE chats SET unread = MAX(unread, 1) WHERE id = ?').run(chat.id);
  const fresh = getChat(chat.id);
  pushChat(fresh);
  // avisa o corretor responsável no app (se foi outra pessoa que marcou)
  if (fresh.assigned_to && fresh.assigned_to !== user.id) {
    const name = displayName(fresh);
    push.notifyUsers([fresh.assigned_to], {
      tag: fresh.ref, url: `/?c=${encodeURIComponent(fresh.ref)}`,
      title: `${user.name} marcou como não lida`, body: `${name}: ${String(fresh.last_text || '').slice(0, 100)}`,
    });
    for (const [res, u] of clients) if (u.id === fresh.assigned_to) sse(res, 'nudge', { chatId: fresh.ref, by: user.name });
  }
  return fresh;
}

// ================= editar / apagar =================
const EDIT_LIMIT = 15 * 60e3;          // regra do WhatsApp
const DELETE_LIMIT = 48 * 3600e3;       // apagar para todos: até 2 dias
function jidFor(chat) { return chat.phone ? `${chat.phone}@s.whatsapp.net` : (chat.lid || chat.id); }
function err(msg, status = 400) { return Object.assign(new Error(msg), { status }); }

async function editMessage(user, chat, msgId, text) {
  const m = q.msgById.get(msgId);
  if (!m || m.chat_id !== chat.id) throw err('Mensagem não encontrada', 404);
  if (!m.from_me || m.kind !== 'text' || m.deleted) throw err('Só dá para editar mensagens de texto enviadas pela equipe');
  if (Date.now() - m.ts > EDIT_LIMIT) throw err('O WhatsApp só permite editar até 15 minutos depois do envio');
  text = String(text || '').trim();
  if (!text) throw err('A mensagem não pode ficar vazia');
  await evo.editMessage(jidFor(chat), m.id, text);
  db.prepare('UPDATE messages SET body = ?, edited = 1 WHERE id = ?').run(text, m.id);
  const last = db.prepare("SELECT id FROM messages WHERE chat_id = ? AND kind NOT IN ('system','note') ORDER BY ts DESC LIMIT 1").get(chat.id);
  if (last && last.id === m.id) db.prepare('UPDATE chats SET last_text = ? WHERE id = ?').run(text.slice(0, 200), chat.id);
  const fresh = getChat(chat.id); pushChat(fresh);
  const out = rowMsg(q.msgById.get(m.id)); pushMessage(fresh, out);
  return out;
}

async function deleteMessage(user, chat, msgId, everyone) {
  const m = q.msgById.get(msgId);
  if (!m || m.chat_id !== chat.id) throw err('Mensagem não encontrada', 404);
  if (everyone) {
    if (!m.from_me || m.kind === 'system' || m.kind === 'note') throw err('Só dá para apagar para todos as mensagens enviadas pela equipe');
    if (m.deleted) return rowMsg(m);
    if (Date.now() - m.ts > DELETE_LIMIT) throw err('O WhatsApp só permite apagar para todos até 2 dias depois do envio');
    await evo.deleteForEveryone(jidFor(chat), m.id, true);
    db.prepare("UPDATE messages SET deleted = 1, body = '' WHERE id = ?").run(m.id);
  } else {
    db.prepare('UPDATE messages SET hidden = 1 WHERE id = ?').run(m.id);
  }
  const fresh = getChat(chat.id); pushChat(fresh);
  const out = rowMsg(q.msgById.get(m.id)); pushMessage(fresh, out);
  return out;
}

async function sendVoice(user, chat, { base64, mime }) {
  const raw = String(base64).replace(/^data:[^,]+,/, '');
  const res = await evo.sendVoice(numberFor(chat), raw);
  const id = res?.key?.id || `out_${Date.now()}`;
  const ts = res?.messageTimestamp ? toMs(res.messageTimestamp) : Date.now();
  // guarda a gravação original para tocar na hora dentro da plataforma
  try { fs.writeFileSync(mediaFile(id), Buffer.from(raw, 'base64')); } catch {}
  storeMessage({ chat, id, fromMe: true, kind: 'audio', body: '', mime: (mime || 'audio/webm').split(';')[0], fileName: null, ts, status: res?.status || 'PENDING', authorId: user.id });
  db.prepare('UPDATE messages SET author_id = COALESCE(author_id, ?), mime = ? WHERE id = ?').run(user.id, (mime || 'audio/webm').split(';')[0], id);
  claimIfQueue(user, chat);
  const fresh = getChat(chat.id);
  pushChat(fresh);
  const m = rowMsg(q.msgById.get(id));
  pushMessage(fresh, m);
  return m;
}

// corretor que responde um lead da fila assume o atendimento
function claimIfQueue(user, chat) {
  const cur = q.chatById.get(chat.id);
  if (user.role === 'corretor' && cur.assigned_to == null) {
    db.prepare('UPDATE chats SET assigned_to = ?, auto_assigned = 0, assigned_at = ? WHERE id = ?').run(user.id, Date.now(), chat.id);
    const s = addSystemMessage(chat.id, `${user.name} assumiu o atendimento`, user.id);
    const fresh = getChat(chat.id);
    pushChat(fresh, null);
    pushMessage(fresh, s);
  }
}

function addNote(user, chat, text) {
  const id = `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  q.insertMsg.run(id, chat.id, 1, 'note', text, null, null, Date.now(), null, user.id);
  const m = rowMsg(q.msgById.get(id));
  pushMessage(chat, m);
  return m;
}

function restoreStage(chat) {
  if (chat.prev_stage && (FUNNEL_IDS.has(chat.prev_stage) || chat.prev_stage === 'novo')) return chat.prev_stage;
  return chat.first_reply_at ? 'tratativa' : 'novo';
}

function updateChat(user, chat, patch) {
  const sets = [];
  const vals = [];
  const sys = [];
  const prevAssigned = chat.assigned_to;
  if (patch.restore && (chat.stage === 'perdido' || chat.stage === 'arquivado')) {
    sets.push('stage = ?', 'prev_stage = NULL', 'stage_changed_at = ?'); vals.push(restoreStage(chat), Date.now());
    sys.push(`${user.name} reativou o lead`);
  } else if (patch.stage !== undefined && patch.stage !== chat.stage) {
    if (!STAGE_IDS.has(patch.stage)) throw Object.assign(new Error('Etapa inválida'), { status: 400 });
    const out = patch.stage === 'perdido' || patch.stage === 'arquivado';
    const wasOut = chat.stage === 'perdido' || chat.stage === 'arquivado';
    sets.push('stage = ?', 'stage_changed_at = ?'); vals.push(patch.stage, Date.now());
    if (out && !wasOut) { sets.push('prev_stage = ?'); vals.push(chat.stage); }
    if (!out) sets.push('prev_stage = NULL');
    if (out) sys.push(patch.stage === 'perdido' ? `${user.name} marcou como perdido` : `${user.name} arquivou o lead`);
    else if (wasOut) sys.push(`${user.name} reativou o lead`);
  }
  if (patch.tags !== undefined) {
    const tags = Array.isArray(patch.tags) ? patch.tags.map(Number).filter(Boolean) : [];
    sets.push('tags = ?'); vals.push(JSON.stringify([...new Set(tags)]));
  }
  if (patch.notes !== undefined) { sets.push('notes = ?'); vals.push(String(patch.notes).slice(0, 5000)); }
  if (patch.name !== undefined) { sets.push('name = ?'); vals.push(String(patch.name).trim().slice(0, 120) || null); }
  if (patch.assigned_to !== undefined && patch.assigned_to !== chat.assigned_to) {
    const to = patch.assigned_to == null ? null : Number(patch.assigned_to);
    if (user.role !== 'admin') {
      // corretor pode assumir da fila ou transferir os próprios
      if (!(chat.assigned_to == null || chat.assigned_to === user.id)) throw Object.assign(new Error('Sem permissão'), { status: 403 });
    }
    const target = to ? q.userById.get(to) : null;
    if (to && !target) throw Object.assign(new Error('Corretor não encontrado'), { status: 400 });
    sets.push('assigned_to = ?', 'auto_assigned = 0', 'assigned_at = ?'); vals.push(to, Date.now());
    if (to) sets.push('held = 0'); // entregue a alguém: deixa de estar represado
    sys.push(target
      ? (target.id === user.id ? `${user.name} assumiu o atendimento` : `${user.name} transferiu para ${target.name}`)
      : `${user.name} devolveu para a fila`);
  }
  if (patch.unread === 0) { sets.push('unread = 0'); }
  if (!sets.length) return chat;
  db.prepare(`UPDATE chats SET ${sets.join(', ')} WHERE id = ?`).run(...vals, chat.id);
  const fresh = getChat(chat.id);
  const sysMsgs = sys.map(t => addSystemMessage(chat.id, t, user.id));
  pushChat(fresh, prevAssigned !== fresh.assigned_to ? prevAssigned : undefined);
  sysMsgs.forEach(s => pushMessage(fresh, s));
  if (fresh.assigned_to && fresh.assigned_to !== prevAssigned && fresh.assigned_to !== user.id) notifyChat(fresh, 'assigned');
  return fresh;
}

// Exclui um usuário e passa os leads dele para outra pessoa (ou para a fila).
// O nome continua no histórico das conversas; o login deixa de existir.
function deleteUser(admin, userId, transferTo) {
  const u = q.userById.get(userId);
  if (!u || u.deleted) throw Object.assign(new Error('Usuário não encontrado'), { status: 404 });
  if (u.id === admin.id) throw Object.assign(new Error('Você não pode excluir o seu próprio usuário'), { status: 400 });
  const target = transferTo ? q.userById.get(Number(transferTo)) : null;
  if (transferTo && (!target || !target.active || target.deleted || target.id === u.id)) throw Object.assign(new Error('Escolha um corretor ativo para receber os leads'), { status: 400 });
  const chats = db.prepare('SELECT id FROM chats WHERE assigned_to = ?').all(u.id);
  const now = Date.now();
  db.prepare('UPDATE chats SET assigned_to = ?, auto_assigned = 0, assigned_at = ? WHERE assigned_to = ?').run(target ? target.id : null, now, u.id);
  db.prepare("UPDATE users SET deleted = 1, active = 0, queue_on = 0, email = ?, pass = '' WHERE id = ?").run(`#excluido-${u.id}-${now}`, u.id);
  db.prepare('DELETE FROM push_subs WHERE user_id = ?').run(u.id);
  if (Number(getSetting('rr_last', '0')) === u.id) setSetting('rr_last', '0');
  const text = target ? `${u.name} foi excluído. Lead transferido para ${target.name}.` : `${u.name} foi excluído. Lead voltou para a fila.`;
  for (const c of chats) {
    const sys = addSystemMessage(c.id, text, admin.id);
    const fresh = getChat(c.id);
    pushChat(fresh, u.id);
    pushMessage(fresh, sys);
  }
  if (target && chats.length && target.id !== admin.id) {
    push.notifyUsers([target.id], { title: `${chats.length} ${chats.length === 1 ? 'lead transferido' : 'leads transferidos'} para você`, body: `Eram de ${u.name}. Abra a Central para continuar o atendimento.`, tag: 'transfer', url: '/' });
  }
  pushAll('users_changed', {});
  return { moved: chats.length };
}

module.exports = {
  deleteUser,
  addClient, removeClient, canSee, present, presentMsg, pushChat, pushAll, setWaState, getWaState,
  sendVoice, mediaFile, sendFile, editMessage, deleteMessage, takeTemp, MEDIA_DIR,
  getChat, getChatByRef, handleWebhook, releaseHeld, holdActive, setNextBroker, myQueue, broadcastQueuePos, markUnread, refreshAvatar, avatarFile, queueState, reassignOverdue, sendText, sendMedia, addNote, updateChat, findOrCreateChat,
  extractContent, resolveJid, toMs,
};
