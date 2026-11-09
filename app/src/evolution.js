// Cliente da Evolution API (a "ponte" com o WhatsApp)
'use strict';

const BASE = (process.env.EVOLUTION_URL || 'http://evolution:8080').replace(/\/$/, '');
const KEY = process.env.EVOLUTION_KEY || '';
const INSTANCE = process.env.INSTANCE_NAME || 'parcerias';
const WEBHOOK_URL = process.env.WEBHOOK_URL || `http://app:3000/webhook/${process.env.WEBHOOK_SECRET || ''}`;

const WEBHOOK_EVENTS = [
  'QRCODE_UPDATED', 'CONNECTION_UPDATE', 'MESSAGES_UPSERT',
  'MESSAGES_UPDATE', 'SEND_MESSAGE', 'CONTACTS_UPDATE',
];

class EvoError extends Error {
  constructor(status, body) {
    super(`Evolution API ${status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
    this.status = status; this.body = body;
  }
}

async function call(method, path, body, timeoutMs = 30000) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', apikey: KEY },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let data = text;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) throw new EvoError(res.status, data);
  return data;
}

function enc(s) { return encodeURIComponent(s); }

async function connectionState() {
  try {
    const r = await call('GET', `/instance/connectionState/${enc(INSTANCE)}`);
    return (r && (r.instance?.state || r.state)) || 'close';
  } catch (e) {
    if (e.status === 404) return 'missing';
    throw e;
  }
}

async function createInstance() {
  return call('POST', '/instance/create', {
    instanceName: INSTANCE,
    integration: 'WHATSAPP-BAILEYS',
    qrcode: true,
    groupsIgnore: true,
    alwaysOnline: false,
    readMessages: false,
    readStatus: false,
    syncFullHistory: false,
    webhook: { url: WEBHOOK_URL, byEvents: false, base64: true, events: WEBHOOK_EVENTS },
  });
}

async function setWebhook() {
  return call('POST', `/webhook/set/${enc(INSTANCE)}`, {
    webhook: { enabled: true, url: WEBHOOK_URL, byEvents: false, base64: true, events: WEBHOOK_EVENTS },
  });
}

// Pede um QR Code novo (ou código de pareamento se vier o número)
async function connect(number) {
  const q = number ? `?number=${enc(String(number).replace(/\D/g, ''))}` : '';
  return call('GET', `/instance/connect/${enc(INSTANCE)}${q}`);
}

async function logout() {
  return call('DELETE', `/instance/logout/${enc(INSTANCE)}`);
}

async function sendText(number, text) {
  return call('POST', `/message/sendText/${enc(INSTANCE)}`, { number, text });
}

async function sendMedia(number, { mediatype, mimetype, base64, fileName, caption }) {
  // arquivos grandes demoram para subir ao WhatsApp: espera até 5 minutos
  return call('POST', `/message/sendMedia/${enc(INSTANCE)}`, {
    number, mediatype, mimetype, media: base64, fileName, caption: caption || '',
  }, 5 * 60e3);
}

// Áudio de voz (aparece para o cliente como áudio gravado, não como arquivo)
async function sendVoice(number, base64) {
  return call('POST', `/message/sendWhatsAppAudio/${enc(INSTANCE)}`, { number, audio: base64, encoding: true });
}

async function getMediaBase64(messageId) {
  return call('POST', `/chat/getBase64FromMediaMessage/${enc(INSTANCE)}`, {
    message: { key: { id: messageId } }, convertToMp4: false,
  });
}

async function profilePicture(number) {
  try {
    const r = await call('POST', `/chat/fetchProfilePictureUrl/${enc(INSTANCE)}`, { number });
    return r?.profilePictureUrl || null;
  } catch { return null; }
}

// Perfil público do número conectado (o que o cliente vê)
async function ownProfile() {
  const out = { name: null, number: null, picture: null, about: null, isBusiness: false, description: null, category: null, email: null, website: null, address: null };
  let inst = null;
  try {
    const r = await call('GET', `/instance/fetchInstances?instanceName=${enc(INSTANCE)}`);
    inst = Array.isArray(r) ? r[0] : r;
    inst = inst?.instance || inst;
  } catch {}
  const jid = inst?.ownerJid || inst?.owner || null;
  out.name = inst?.profileName || null;
  out.picture = inst?.profilePicUrl || inst?.profilePictureUrl || null;
  out.number = jid ? String(jid).split('@')[0].split(':')[0] : null;
  if (!out.number) return out;
  try {
    const p = await call('POST', `/chat/fetchProfile/${enc(INSTANCE)}`, { number: out.number });
    out.name = out.name || p?.name || null;
    out.picture = out.picture || p?.picture || null;
    out.about = (typeof p?.status === 'string' ? p.status : p?.status?.status) || null;
    out.isBusiness = !!p?.isBusiness;
    out.description = p?.description || null;
    out.email = p?.email || null;
    out.website = Array.isArray(p?.website) ? p.website.join(' · ') : (p?.website || null);
  } catch {}
  try {
    const b = await call('POST', `/chat/fetchBusinessProfile/${enc(INSTANCE)}`, { number: out.number });
    const bp = b?.profile || b;
    if (bp) {
      out.isBusiness = out.isBusiness || !!bp.isBusiness || !!bp.description || !!bp.category;
      out.description = out.description || bp.description || null;
      out.category = bp.category || (Array.isArray(bp.categories) ? bp.categories.map(c => c.localized_display_name || c.name || c).join(', ') : null);
      out.email = out.email || bp.email || null;
      out.website = out.website || (Array.isArray(bp.website) ? bp.website.join(' · ') : bp.website) || null;
      out.address = bp.address || null;
    }
  } catch {}
  return out;
}

async function markRead(remoteJid, ids) {
  if (!ids.length) return;
  try {
    await call('POST', `/chat/markMessageAsRead/${enc(INSTANCE)}`, {
      readMessages: ids.map(id => ({ remoteJid, fromMe: false, id })),
    });
  } catch {}
}

module.exports = {
  INSTANCE, WEBHOOK_URL, EvoError,
  connectionState, createInstance, setWebhook, connect, logout,
  sendText, sendMedia, sendVoice, getMediaBase64, profilePicture, markRead, ownProfile,
};
