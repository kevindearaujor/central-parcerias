// Banco de dados local (SQLite embutido no Node, sem instalar nada)
'use strict';
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(process.env.DB_FILE || path.join(DATA_DIR, 'plataforma.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  pass TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'corretor',
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  lid TEXT,
  phone TEXT,
  name TEXT,
  push_name TEXT,
  avatar TEXT,
  stage TEXT NOT NULL DEFAULT 'novo',
  tags TEXT NOT NULL DEFAULT '[]',
  assigned_to INTEGER,
  notes TEXT NOT NULL DEFAULT '',
  unread INTEGER NOT NULL DEFAULT 0,
  last_text TEXT,
  last_at INTEGER,
  last_from_me INTEGER NOT NULL DEFAULT 0,
  origin TEXT NOT NULL DEFAULT 'whatsapp',
  ad_title TEXT, ad_body TEXT, ad_url TEXT, ad_id TEXT,
  created_at INTEGER NOT NULL,
  first_reply_at INTEGER,
  stage_changed_at INTEGER,
  prev_stage TEXT,
  ref TEXT
);
CREATE INDEX IF NOT EXISTS chats_last ON chats(last_at DESC);
CREATE INDEX IF NOT EXISTS chats_lid ON chats(lid);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  from_me INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'text',
  body TEXT,
  mime TEXT,
  file_name TEXT,
  ts INTEGER NOT NULL,
  status TEXT,
  author_id INTEGER,
  deleted INTEGER NOT NULL DEFAULT 0,
  edited INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS messages_chat ON messages(chat_id, ts);
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#2F6FFF'
);
CREATE TABLE IF NOT EXISTS quick_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shortcut TEXT NOT NULL,
  text TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

// migração de bancos antigos
for (const col of ['prev_stage TEXT', 'ref TEXT', 'avatar_at INTEGER', 'assigned_at INTEGER', 'auto_assigned INTEGER NOT NULL DEFAULT 0', "auto_tries TEXT NOT NULL DEFAULT '[]'", 'held INTEGER NOT NULL DEFAULT 0']) {
  try { db.exec(`ALTER TABLE chats ADD COLUMN ${col}`); } catch {}
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS chats_ref ON chats(ref)');
try { db.exec('ALTER TABLE messages ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0'); } catch {}
// mídias das respostas rápidas (lista em JSON: [{ f, name, mime, size }])
try { db.exec("ALTER TABLE quick_replies ADD COLUMN media TEXT NOT NULL DEFAULT '[]'"); } catch {}
for (const col of ['reply_id TEXT', 'reply_text TEXT', 'reply_from_me INTEGER']) { try { db.exec(`ALTER TABLE messages ADD COLUMN ${col}`); } catch {} }
// fila de distribuição: quem recebe lead e em que ordem
for (const col of ['queue_on INTEGER NOT NULL DEFAULT 1', 'queue_pos INTEGER', 'deleted INTEGER NOT NULL DEFAULT 0']) {
  try { db.exec(`ALTER TABLE users ADD COLUMN ${col}`); } catch {}
}
db.exec('UPDATE users SET queue_pos = id WHERE queue_pos IS NULL');
const newRef = () => crypto.randomBytes(9).toString('base64url');
for (const r of db.prepare('SELECT id FROM chats WHERE ref IS NULL').all()) {
  db.prepare('UPDATE chats SET ref = ? WHERE id = ?').run(newRef(), r.id);
}

// Etapas do funil (o lead entra na primeira resposta)
const STAGES = [
  { id: 'tratativa', name: 'Tratativa' },
  { id: 'agendamento', name: 'Agendamento' },
  { id: 'documento', name: 'Captar documento' },
  { id: 'aprovado', name: 'Aprovado' },
  { id: 'comprou', name: 'Comprou' },
];
// fora do funil
const OUT_STAGES = [
  { id: 'perdido', name: 'Perdido' },
  { id: 'arquivado', name: 'Arquivado' },
];
const FUNNEL_IDS = new Set(STAGES.map(s => s.id));
const STAGE_IDS = new Set(['novo', ...FUNNEL_IDS, ...OUT_STAGES.map(s => s.id)]);

// ---------- senhas ----------
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}
function checkPassword(pw, stored) {
  const [alg, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const test = crypto.scryptSync(String(pw), salt, 64);
  const real = Buffer.from(hash, 'hex');
  return real.length === test.length && crypto.timingSafeEqual(real, test);
}

// ---------- settings ----------
function getSetting(key, def = null) {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return r ? r.value : def;
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value == null ? null : String(value));
}

// ---------- seed inicial ----------
function seed() {
  const count = db.prepare('SELECT COUNT(*) n FROM users').get().n;
  if (count === 0) {
    const email = (process.env.ADMIN_EMAIL || 'admin@admin.com').toLowerCase().trim();
    const pass = process.env.ADMIN_PASSWORD || 'trocar123';
    db.prepare('INSERT INTO users(name, email, pass, role, created_at) VALUES(?, ?, ?, ?, ?)')
      .run(process.env.ADMIN_NAME || 'Administrador', email, hashPassword(pass), 'admin', Date.now());
    console.log(`[seed] administrador criado: ${email}`);
  }
  const tags = db.prepare('SELECT COUNT(*) n FROM tags').get().n;
  if (tags === 0) {
    const ins = db.prepare('INSERT INTO tags(name, color) VALUES(?, ?)');
    [['Análise assessoria', '#3e6fd0'], ['Fazer follow up', '#f5a524'], ['IR 2027', '#2A9BC4'],
     ['Restrição', '#e5484d'], ['Perfil de comprador', '#8e4ec6']]
      .forEach(([n, c]) => ins.run(n, c));
  }
  const qr = db.prepare('SELECT COUNT(*) n FROM quick_replies').get().n;
  if (qr === 0) {
    const ins = db.prepare('INSERT INTO quick_replies(shortcut, text) VALUES(?, ?)');
    ins.run('oi', 'Olá! Tudo bem? Aqui é da equipe de parcerias Cury. Vi que você se interessou pelo nosso anúncio. Qual empreendimento chamou sua atenção?');
    ins.run('renda', 'Para eu te passar as melhores condições, me conta: qual a sua renda familiar aproximada e se você tem FGTS disponível?');
    ins.run('visita', 'Que tal conhecer o decorado pessoalmente? Tenho horários disponíveis esta semana. Qual dia fica melhor para você?');
  }
  if (getSetting('auto_distribute') == null) setSetting('auto_distribute', '0');
  if (getSetting('reassign_on') == null) setSetting('reassign_on', '1');
  if (getSetting('reassign_min') == null) setSetting('reassign_min', '5');
  // represar leads que chegam fora do horário (só o administrador vê até liberar)
  if (getSetting('hold_on') == null) setSetting('hold_on', '1');
  if (getSetting('hold_start') == null) setSetting('hold_start', '22:00');
  if (getSetting('hold_end') == null) setSetting('hold_end', '08:45');
  if (getSetting('session_secret') == null) setSetting('session_secret', crypto.randomBytes(32).toString('hex'));
}
seed();

// ---------- helpers de linha ----------
function rowChat(r) {
  if (!r) return null;
  let tags = [];
  try { tags = JSON.parse(r.tags || '[]'); } catch {}
  return { ...r, tags, last_from_me: !!r.last_from_me, held: !!r.held };
}
function rowMsg(r) {
  if (!r) return null;
  return { ...r, from_me: !!r.from_me, deleted: !!r.deleted, edited: !!r.edited };
}
function publicUser(u) {
  if (!u) return null;
  return { id: u.id, name: u.name, email: u.deleted ? '' : u.email, role: u.role, active: !!u.active, deleted: !!u.deleted };
}

module.exports = {
  db, DATA_DIR, STAGES, OUT_STAGES, FUNNEL_IDS, STAGE_IDS, newRef,
  hashPassword, checkPassword, getSetting, setSetting,
  rowChat, rowMsg, publicUser,
};
