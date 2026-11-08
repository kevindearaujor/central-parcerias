// Notificações no celular (Web Push) sem bibliotecas externas.
// Criptografia conforme RFC 8291 (aes128gcm) e identificação do servidor pela RFC 8292 (VAPID).
'use strict';
const crypto = require('node:crypto');
const { db, getSetting, setSetting } = require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS push_subs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS push_user ON push_subs(user_id);
`);

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const fromB64u = (s) => Buffer.from(String(s).replace(/=+$/, ''), 'base64url');

// ---------- chaves VAPID (geradas uma vez e guardadas) ----------
function vapidKeys() {
  let pub = getSetting('vapid_public');
  let priv = getSetting('vapid_private');
  if (!pub || !priv) {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.generateKeys();
    pub = b64u(ecdh.getPublicKey());      // 65 bytes, formato não comprimido
    priv = b64u(ecdh.getPrivateKey());    // 32 bytes
    setSetting('vapid_public', pub);
    setSetting('vapid_private', priv);
  }
  return { pub, priv };
}

function privateKeyObject(pubB64, privB64) {
  const p = fromB64u(pubB64);
  return crypto.createPrivateKey({
    key: { kty: 'EC', crv: 'P-256', d: privB64, x: b64u(p.subarray(1, 33)), y: b64u(p.subarray(33, 65)) },
    format: 'jwk',
  });
}

function vapidHeader(endpoint) {
  const { pub, priv } = vapidKeys();
  const aud = new URL(endpoint).origin;
  const header = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64u(JSON.stringify({
    aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: process.env.PUSH_CONTACT || 'mailto:central@parceirocury.com.br',
  }));
  const data = `${header}.${claims}`;
  const sig = crypto.sign('sha256', Buffer.from(data), { key: privateKeyObject(pub, priv), dsaEncoding: 'ieee-p1363' });
  return `vapid t=${data}.${b64u(sig)}, k=${pub}`;
}

// ---------- criptografia da mensagem (RFC 8291) ----------
function encrypt(payload, p256dhB64, authB64) {
  const uaPublic = fromB64u(p256dhB64);
  const authSecret = fromB64u(authB64);
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);
  const salt = crypto.randomBytes(16);

  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, authSecret, keyInfo, 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));

  const plain = Buffer.concat([Buffer.from(payload), Buffer.from([0x02])]); // último registro
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);

  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  const header = Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic]);
  return Buffer.concat([header, body]);
}

async function sendOne(sub, data) {
  const body = encrypt(JSON.stringify(data), sub.p256dh, sub.auth);
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      TTL: '86400',
      Urgency: 'high',
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      Authorization: vapidHeader(sub.endpoint),
    },
    body,
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 404 || res.status === 410) {
    db.prepare('DELETE FROM push_subs WHERE endpoint = ?').run(sub.endpoint); // inscrição expirou
  } else if (!res.ok) {
    console.warn('[push]', res.status, (await res.text().catch(() => '')).slice(0, 200));
  }
  return res.status;
}

// Envia para vários usuários (em segundo plano, sem travar nada)
function notifyUsers(userIds, data) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return;
  const subs = db.prepare(`SELECT s.* FROM push_subs s JOIN users u ON u.id = s.user_id
    WHERE u.active = 1 AND s.user_id IN (${ids.map(() => '?').join(',')})`).all(...ids);
  for (const s of subs) sendOne(s, data).catch(e => console.warn('[push]', e.message));
}

function subscribe(userId, sub) {
  const endpoint = String(sub?.endpoint || '');
  const p256dh = sub?.keys?.p256dh; const auth = sub?.keys?.auth;
  if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) throw Object.assign(new Error('Inscrição inválida'), { status: 400 });
  db.prepare(`INSERT INTO push_subs(user_id, endpoint, p256dh, auth, created_at) VALUES(?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`)
    .run(userId, endpoint, p256dh, auth, Date.now());
}
function unsubscribe(endpoint) { db.prepare('DELETE FROM push_subs WHERE endpoint = ?').run(String(endpoint || '')); }
function countFor(userId) { return db.prepare('SELECT COUNT(*) n FROM push_subs WHERE user_id = ?').get(userId).n; }

module.exports = { vapidKeys, encrypt, vapidHeader, notifyUsers, subscribe, unsubscribe, countFor, sendOne };
