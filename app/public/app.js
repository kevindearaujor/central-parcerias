/* Central de Parcerias — painel de atendimento via WhatsApp
   Funciona em dois modos: real (servidor + Evolution API) ou demonstração (dados de exemplo). */
(function () {
  'use strict';
  const DEMO = window.PLATAFORMA_DEMO === true;

  // ================= ícones =================
  const P = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
  const I = {
    logo: P('<path d="M4 20l1.4-3.9A8 8 0 1 1 8.6 19z"/><path d="M9 10.5h6M9 13.5h4"/>'),
    chat: P('<path d="M21 12a8 8 0 0 1-11.7 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>'),
    board: P('<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>'),
    chart: P('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    gear: P('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    search: P('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
    send: P('<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>'),
    clip: P('<path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>'),
    back: P('<path d="M15 18l-6-6 6-6"/>'),
    info: P('<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>'),
    x: P('<path d="M18 6L6 18M6 6l12 12"/>'),
    plus: P('<path d="M12 5v14M5 12h14"/>'),
    doc: P('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>'),
    check: P('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    check2: P('<path d="M2 12.5l4.5 4.5L16 7.5M10 16.5l.5.5L20 7.5"/>'),
    clock: P('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 1.5"/>'),
    alert: P('<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>'),
    logout: P('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
    edit: P('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
    trash: P('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'),
    megaphone: P('<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15 9a3 3 0 0 1 0 6M18 6a7 7 0 0 1 0 12"/>'),
    inbox: P('<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>'),
    phone: P('<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>'),
    warn: P('<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
    archive: P('<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/>'),
    lost: P('<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>'),
    queue: P('<path d="M4 6h11M4 12h11M4 18h7"/><path d="M18 9v10M15 16l3 3 3-3"/>'),
    grip: P('<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>', 'fill="currentColor"'),
    undo: P('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  };

  // ================= utilitários =================
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const COLORS = ['#2F6FFF', '#1F9E8A', '#8E5BD9', '#D0662A', '#D2457A', '#2A9BC4', '#6E8A24', '#B0742E'];
  const colorFor = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; };
  const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  function fmtPhone(p) {
    const d = String(p || '').replace(/\D/g, '');
    if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
      const ddd = d.slice(2, 4); const n = d.slice(4);
      return `+55 (${ddd}) ${n.length === 9 ? n.slice(0, 5) + '-' + n.slice(5) : n.slice(0, 4) + '-' + n.slice(4)}`;
    }
    return d ? '+' + d : '';
  }
  const chatName = (c) => c.name || c.push_name || fmtPhone(c.phone) || 'Contato sem nome';
  const phoneLabel = (c) => c.phone ? fmtPhone(c.phone) : (c.phone_hidden ? 'Número protegido' : 'Número oculto pelo WhatsApp');
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  function fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(ts); const now = new Date();
    if (sameDay(d, now)) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (sameDay(d, y)) return 'Ontem';
    if (now - d < 6 * 864e5) return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }
  const hhmm = (ts) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  function dayLabel(ts) {
    const d = new Date(ts); const now = new Date();
    if (sameDay(d, now)) return 'Hoje';
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (sameDay(d, y)) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  }
  function fmtDuration(ms) {
    if (ms == null || isNaN(ms)) return '—';
    const m = Math.round(ms / 60000);
    if (m < 1) return '< 1 min';
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60); const r = m % 60;
    if (h < 24) return r ? `${h}h ${r}min` : `${h}h`;
    return `${Math.round(h / 24)} d`;
  }
  function richText(s) {
    let t = esc(s);
    t = t.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    t = t.replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,!?])/g, '$1<b>$2</b>');
    t = t.replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,!?])/g, '$1<i>$2</i>');
    t = t.replace(/(^|\s)~([^~\n]+)~(?=\s|$|[.,!?])/g, '$1<s>$2</s>');
    return t;
  }
  function avatarHtml(c, cls = '') {
    const name = chatName(c);
    if (c.avatar) return `<div class="avatar ${cls}"><img src="${esc(c.avatar)}" alt="" loading="lazy" onerror="this.remove()"></div>`;
    return `<div class="avatar ${cls}" style="background:${colorFor(c.id)}">${esc(initials(name))}</div>`;
  }
  let toastTimer;
  function toast(msg, err = false) {
    let t = $('.toast'); if (!t) { t = document.createElement('div'); document.body.appendChild(t); }
    t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
  }
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  // ================= estado =================
  const S = {
    me: null, users: [], tags: [], quickReplies: [], stages: [], settings: {}, wa: { state: 'unknown' },
    chats: new Map(), current: null, messages: [], hasMore: false,
    view: 'inbox', filter: 'all', q: '', tagFilter: '', stageFilter: '', brokerFilter: '',
    outStages: [], archiveTab: 'perdido', showDetail: false, dashDays: 30, waFull: null,
  };
  const userById = (id) => S.users.find(u => u.id === id);
  const tagById = (id) => S.tags.find(t => t.id === id);
  const stageName = (id) => (id === 'novo' ? 'Aguardando 1ª resposta' : ([...S.stages, ...S.outStages].find(s => s.id === id) || {}).name || id);
  const isOut = (c) => c.stage === 'perdido' || c.stage === 'arquivado';
  const inFunnel = (c) => S.stages.some(s => s.id === c.stage);
  const isAdmin = () => S.me?.role === 'admin';
  const brokers = () => S.users.filter(u => u.active);
  const canSeeChat = (c) => S.me && (S.me.role === 'admin' || c.assigned_to == null || c.assigned_to === S.me.id);

  // ================= API =================
  const api = DEMO ? null : {
    async req(method, url, body) {
      const r = await fetch(url, {
        method, credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'plataforma' },
        body: body ? JSON.stringify(body) : undefined,
      });
      let data = null; try { data = await r.json(); } catch {}
      if (r.status === 401 && !url.endsWith('/login')) { showLogin(); throw new Error('Faça login'); }
      if (!r.ok) throw new Error(data?.error || 'Algo deu errado');
      return data;
    },
    get(u) { return this.req('GET', u); },
    post(u, b) { return this.req('POST', u, b || {}); },
    patch(u, b) { return this.req('PATCH', u, b || {}); },
    del(u) { return this.req('DELETE', u); },
  };
  const A = DEMO ? demoApi() : api;

  // ================= tempo real =================
  let es;
  function connectEvents() {
    if (DEMO) return;
    if (es) es.close();
    es = new EventSource('/api/events');
    es.addEventListener('chat', e => onChatEvent(JSON.parse(e.data)));
    es.addEventListener('chat_removed', e => onChatRemoved(JSON.parse(e.data).id));
    es.addEventListener('message', e => { const d = JSON.parse(e.data); onMessageEvent(d.chatId, d.message); });
    es.addEventListener('wa_state', e => { S.wa.state = JSON.parse(e.data).state; renderWaWarn(); });
    es.addEventListener('wa', e => { S.waFull = JSON.parse(e.data); S.wa.state = S.waFull.state; renderWaWarn(); if (S.view === 'config') renderWaBox(); });
    es.addEventListener('users_changed', () => reloadBootstrap());
    es.addEventListener('config_changed', () => reloadBootstrap());
    es.onopen = () => { if (S._esFailed) { S._esFailed = false; loadChats(); } };
    es.onerror = () => { S._esFailed = true; };
  }
  function onChatEvent(chat) {
    if (!canSeeChat(chat)) return onChatRemoved(chat.id);
    S.chats.set(chat.id, chat);
    scheduleListRender();
    updateTitle();
    if (S.current === chat.id) { renderChatHead(); renderDetail(); renderQueueBar(); }
    if (S.view === 'funil') scheduleFunnel();
    if (S.view === 'arquivo') renderArchiveList();
  }
  function onChatRemoved(id) {
    S.chats.delete(id);
    if (S.current === id) closeChat();
    scheduleListRender(); updateTitle();
    if (S.view === 'funil') scheduleFunnel();
  }
  function onMessageEvent(chatId, m) {
    if (S.current === chatId) {
      const i = S.messages.findIndex(x => x.id === m.id);
      if (i >= 0) S.messages[i] = m; else S.messages.push(m);
      renderMessages(i < 0);
      if (!m.from_me && document.visibilityState === 'visible') markRead(chatId);
    }
    if (!m.from_me && m.kind !== 'system' && i18nNotify(chatId, m)) {}
  }
  function i18nNotify(chatId, m) {
    if (document.visibilityState === 'visible' && S.current === chatId) return false;
    const c = S.chats.get(chatId); if (!c) return false;
    if (S.me.role !== 'admin' && c.assigned_to != null && c.assigned_to !== S.me.id) return false;
    beep();
    try {
      if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
        const n = new Notification(chatName(c), { body: m.body || 'Nova mensagem', tag: chatId });
        n.onclick = () => { window.focus(); goView('inbox'); openChat(chatId); };
      }
    } catch {}
    return true;
  }
  let audioCtx;
  function beep() {
    if (!store.get('sound', true)) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.0001;
      o.connect(g); g.connect(audioCtx.destination); o.start();
      g.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);
      o.stop(audioCtx.currentTime + 0.3);
    } catch {}
  }
  function updateTitle() {
    let n = 0; for (const c of S.chats.values()) if (c.unread > 0 && !isOut(c)) n++;
    document.title = (n ? `(${n}) ` : '') + 'Central de Parcerias';
    const dot = $('#rail-unread'); if (dot) { dot.hidden = !n; dot.textContent = n > 99 ? '99+' : n; }
  }

  // ================= início =================
  async function boot() {
    applyTheme();
    try { await reloadBootstrap(); }
    catch { if (!S.me) return; }
    renderApp();
    connectEvents();
    await loadChats();
    const last = store.get('lastView', 'inbox');
    goView(['inbox', 'funil', 'fila', 'arquivo', 'painel', 'config'].includes(last) ? last : 'inbox');
  }
  async function reloadBootstrap() {
    const b = await A.get('/api/bootstrap');
    Object.assign(S, { me: b.me, users: b.users, tags: b.tags, quickReplies: b.quickReplies, stages: b.stages, outStages: b.outStages || [], settings: b.settings });
    S.wa.state = b.wa.state;
    const fb = $('.rail-btn[data-view=fila]'); if (fb) fb.hidden = !isAdmin();
    if ($('.app')) { renderListFilters(); renderList(); renderChatHead(); renderDetail(); renderWaWarn(); if (S.view === 'config') renderConfig(); }
    return b;
  }
  async function loadChats() {
    const r = await A.get('/api/chats?limit=1000');
    S.chats = new Map(r.chats.map(c => [c.id, c]));
    renderList(); updateTitle();
    if (S.view === 'funil') renderFunnel();
    if (S.view === 'arquivo') renderArchiveList();
  }

  function applyTheme() {
    const t = store.get('theme', 'dark');
    if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
  }

  // ================= login =================
  function showLogin() {
    if (es) es.close();
    document.getElementById('root').innerHTML = `
      <div class="login">
        <form class="login-card" id="login-form">
          <div class="brand"><div class="brand-mark">${I.logo}</div>Central de Parcerias</div>
          <p>Entre com o e-mail e a senha que o administrador cadastrou para você.</p>
          <div class="field"><label for="lg-email">E-mail</label><input class="input" id="lg-email" type="email" autocomplete="username" required></div>
          <div class="field"><label for="lg-pass">Senha</label><input class="input" id="lg-pass" type="password" autocomplete="current-password" required></div>
          <div class="form-error" id="lg-err"></div>
          <button class="btn primary" type="submit">Entrar</button>
        </form>
      </div>`;
    $('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button'); btn.disabled = true;
      try {
        await A.post('/api/login', { email: $('#lg-email').value, password: $('#lg-pass').value });
        S.me = null; boot();
      } catch (err) { $('#lg-err').textContent = err.message; btn.disabled = false; }
    });
    $('#lg-email').focus();
  }

  // ================= casca =================
  function renderApp() {
    document.getElementById('root').innerHTML = `
      <div class="app">
        <nav class="rail" aria-label="Navegação">
          <div class="brand-mark" title="Central de Parcerias">${I.logo}</div>
          <button class="rail-btn" data-view="inbox" aria-label="Conversas">${I.chat}<span class="dot" id="rail-unread" hidden></span><span class="tip">Conversas</span></button>
          <button class="rail-btn" data-view="funil" aria-label="Funil">${I.board}<span class="tip">Funil de leads</span></button>
          <button class="rail-btn" data-view="painel" aria-label="Painel">${I.chart}<span class="tip">Painel</span></button>
          <button class="rail-btn" data-view="fila" aria-label="Fila de distribuição" ${S.me.role === 'admin' ? '' : 'hidden'}>${I.queue}<span class="tip">Fila de distribuição</span></button>
          <button class="rail-btn" data-view="arquivo" aria-label="Perdidos e arquivados">${I.warn}<span class="tip">Perdidos e arquivados</span></button>
          <div class="rail-spacer"></div>
          <button class="rail-btn" data-view="config" aria-label="Configurações">${I.gear}<span class="tip">Configurações</span></button>
        </nav>
        <main class="view" id="view"></main>
      </div>
      ${DEMO ? `<div class="demo-banner" role="group" aria-label="Ver a plataforma como"><span>Ver como</span><button data-as="1" class="active">Kevin · admin</button><button data-as="2">Ana · corretora</button></div>` : ''}`;
    $('.rail').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) goView(b.dataset.view); });
    if (DEMO) $('.demo-banner').addEventListener('click', async e => {
      const b = e.target.closest('[data-as]'); if (!b || b.classList.contains('active')) return;
      document.querySelectorAll('.demo-banner [data-as]').forEach(x => x.classList.toggle('active', x === b));
      A.setMe(Number(b.dataset.as));
      S.current = null; S.messages = []; S.filter = 'all'; S.brokerFilter = ''; S.q = '';
      await reloadBootstrap(); await loadChats(); goView(S.view);
      toast(b.dataset.as === '1' ? 'Você está vendo como administrador' : 'Agora você vê o que a corretora Ana vê');
    });
  }
  function goView(v) {
    S.view = v; store.set('lastView', v);
    document.querySelectorAll('.rail-btn').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    if (v === 'inbox') renderInbox();
    if (v === 'funil') renderFunnel();
    if (v === 'painel') renderDashboard();
    if (v === 'arquivo') renderArchive();
    if (v === 'fila') { if (isAdmin()) renderQueue(); else goView('inbox'); }
    if (v === 'config') renderConfig();
  }

  // ================= conversas =================
  function renderInbox() {
    $('#view').innerHTML = `
      <div class="inbox ${store.get('hideDetail', false) ? 'hide-detail' : ''}" id="inbox">
        <section class="list-pane">
          <div id="wa-warn"></div>
          <div class="list-head">
            <div class="list-title"><h1>Conversas${DEMO ? '<span class="demo-chip">Demo</span>' : ''}</h1></div>
            <div class="search">${I.search}<input class="input" id="q" placeholder="Buscar nome, número ou anúncio" value="${esc(S.q)}" autocomplete="off"></div>
            <div class="tabs" id="tabs"></div>
            <div class="filters" id="filters"></div>
          </div>
          <div class="chat-list" id="chat-list"></div>
        </section>
        <section class="chat-pane" id="chat-pane"></section>
        <aside class="detail-pane" id="detail-pane"></aside>
      </div>`;
    $('#q').addEventListener('input', e => { S.q = e.target.value; renderList(); });
    $('#chat-list').addEventListener('click', e => { const it = e.target.closest('[data-chat]'); if (it) openChat(it.dataset.chat); });
    renderWaWarn(); renderListFilters(); renderList();
    if (S.current && S.chats.has(S.current)) openChat(S.current, true); else renderChatPane();
  }
  function renderWaWarn() {
    const el = $('#wa-warn'); if (!el) return;
    const bad = ['close', 'offline', 'missing', 'connecting'].includes(S.wa.state);
    el.innerHTML = bad ? `<div class="wa-warn"><span>${S.wa.state === 'connecting' ? 'WhatsApp aguardando conexão' : 'WhatsApp desconectado'}</span>${isAdmin() ? '<button class="btn sm" id="go-wa">Conectar</button>' : ''}</div>` : '';
    const b = $('#go-wa'); if (b) b.onclick = () => goView('config');
  }
  function visibleChats() {
    const q = S.q.trim().toLowerCase(); const qd = q.replace(/\D/g, '');
    return [...S.chats.values()].filter(c => {
      if (isOut(c)) return false;
      if (S.filter === 'mine' && c.assigned_to !== S.me.id) return false;
      if (S.filter === 'unread' && !(c.unread > 0 || c.assigned_to == null)) return false;
      if (S.tagFilter && !c.tags.includes(Number(S.tagFilter))) return false;
      if (S.stageFilter && c.stage !== S.stageFilter) return false;
      if (S.brokerFilter && String(c.assigned_to) !== S.brokerFilter) return false;
      if (q) {
        const hay = `${chatName(c)} ${c.push_name || ''} ${c.last_text || ''} ${c.ad_title || ''}`.toLowerCase();
        if (!hay.includes(q) && !(qd && c.phone && c.phone.includes(qd))) return false;
      }
      return true;
    }).sort((a, b) => (b.last_at || b.created_at) - (a.last_at || a.created_at));
  }
  function renderListFilters() {
    const tabs = $('#tabs'); if (!tabs) return;
    const all = [...S.chats.values()].filter(c => !isOut(c));
    const counts = {
      all: all.length, mine: all.filter(c => c.assigned_to === S.me.id).length,
      unread: all.filter(c => c.unread > 0 || c.assigned_to == null).length,
    };
    if (S.filter === 'queue') S.filter = 'unread';
    const defs = [['all', 'Todas'], ['mine', 'Minhas'], ['unread', 'Não lidas']];
    tabs.innerHTML = defs.map(([k, l]) => `<button class="tab ${S.filter === k ? 'active' : ''}" data-f="${k}">${l}<span class="count">${counts[k]}</span></button>`).join('');
    tabs.onclick = e => { const b = e.target.closest('[data-f]'); if (b) { S.filter = b.dataset.f; renderListFilters(); renderList(); } };
    $('#filters').innerHTML = `
      <select class="input" id="f-stage" aria-label="Etapa"><option value="">Etapas</option><option value="novo" ${S.stageFilter === 'novo' ? 'selected' : ''}>Aguardando 1ª resposta</option>${S.stages.map(s => `<option value="${s.id}" ${S.stageFilter === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
      <select class="input" id="f-tag" aria-label="Etiqueta"><option value="">Etiquetas</option>${S.tags.map(t => `<option value="${t.id}" ${String(S.tagFilter) === String(t.id) ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
      ${isAdmin() ? `<select class="input" id="f-broker" aria-label="Corretor"><option value="">Corretores</option>${brokers().map(u => `<option value="${u.id}" ${S.brokerFilter === String(u.id) ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>` : ''}`;
    $('#f-stage').onchange = e => { S.stageFilter = e.target.value; renderList(); };
    $('#f-tag').onchange = e => { S.tagFilter = e.target.value; renderList(); };
    const fb = $('#f-broker'); if (fb) fb.onchange = e => { S.brokerFilter = e.target.value; renderList(); };
  }
  let listTimer;
  function scheduleListRender() { clearTimeout(listTimer); listTimer = setTimeout(() => { renderListFilters(); renderList(); }, 60); }
  function renderList() {
    const el = $('#chat-list'); if (!el) return;
    const list = visibleChats();
    if (!list.length) {
      el.innerHTML = `<div class="empty">${I.inbox}<strong>${S.chats.size ? 'Nada por aqui' : 'Nenhuma conversa ainda'}</strong><span>${S.chats.size ? 'Ajuste a busca ou os filtros.' : 'Quando um cliente clicar no anúncio e mandar mensagem, a conversa aparece aqui na hora.'}</span></div>`;
      return;
    }
    el.innerHTML = list.map(c => {
      const broker = c.assigned_to ? userById(c.assigned_to) : null;
      const chips = [];
      if (c.origin === 'anuncio') chips.push(`<span class="chip ad">${esc(c.ad_title ? trunc(c.ad_title, 22) : 'Anúncio')}</span>`);
      if (c.assigned_to == null) chips.push('<span class="chip queue">Fila</span>');
      else if (isAdmin() && broker) chips.push(`<span class="chip">${esc(broker.name.split(' ')[0])}</span>`);
      c.tags.slice(0, 2).forEach(id => { const t = tagById(id); if (t) chips.push(`<span class="chip"><span class="sw" style="background:${esc(t.color)}"></span>${esc(t.name)}</span>`); });
      const prefix = c.last_from_me ? 'Você: ' : '';
      return `<div class="chat-item ${S.current === c.id ? 'active' : ''} ${c.unread ? 'unread' : ''}" data-chat="${esc(c.id)}" role="button" tabindex="0">
        ${avatarHtml(c)}
        <div style="min-width:0"><div class="name">${esc(chatName(c))}</div><div class="preview">${esc(prefix + (c.last_text || ''))}</div>${chips.length ? `<div class="chips">${chips.join('')}</div>` : ''}</div>
        <div class="meta"><span class="time">${fmtTime(c.last_at || c.created_at)}</span>${c.unread ? `<span class="badge">${c.unread}</span>` : ''}</div>
      </div>`;
    }).join('');
  }
  const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  async function openChat(id, keep) {
    const changed = S.current !== id;
    S.current = id;
    $('#inbox')?.classList.add('has-chat');
    document.querySelectorAll('.chat-item').forEach(el => el.classList.toggle('active', el.dataset.chat === id));
    if (changed || !keep) { S.messages = []; renderChatPane(true); }
    try {
      const r = await A.get(`/api/chats/${encodeURIComponent(id)}`);
      if (S.current !== id) return;
      S.chats.set(id, r.chat); S.messages = r.messages; S.hasMore = r.hasMore;
      renderChatPane(); renderDetail();
      markRead(id);
    } catch (e) { toast(e.message, true); }
  }
  function closeChat() {
    S.current = null; S.messages = [];
    $('#inbox')?.classList.remove('has-chat', 'show-detail');
    renderChatPane(); renderDetail(); renderList();
  }
  function markRead(id) {
    const c = S.chats.get(id);
    if (c && c.unread > 0) { c.unread = 0; renderList(); updateTitle(); A.post(`/api/chats/${encodeURIComponent(id)}/read`).catch(() => {}); }
  }

  function renderChatPane(loading) {
    const pane = $('#chat-pane'); if (!pane) return;
    const c = S.chats.get(S.current);
    $('#inbox').classList.toggle('no-detail', !c);
    if (!c) {
      pane.innerHTML = `<div class="chat-empty"><div><div class="big">${I.chat}</div><strong>Escolha uma conversa</strong><p>As mensagens do WhatsApp aparecem aqui em tempo real,<br>do jeito que chegam no celular.</p></div></div>`;
      return;
    }
    pane.innerHTML = `
      <header class="chat-head" id="chat-head"></header>
      <div id="queue-bar"></div>
      <div class="messages" id="messages">${loading ? '<div class="sys">Carregando…</div>' : ''}</div>
      <div class="composer" id="composer">
        <div class="qr-pop" id="qr-pop" hidden></div>
        <div class="attach-preview" id="attach-preview" hidden></div>
        <div class="composer-row">
          <button class="icon-btn" id="attach-btn" type="button" aria-label="Anexar arquivo" title="Anexar arquivo">${I.clip}</button>
          <input type="file" id="file-in" hidden>
          <textarea id="compose" rows="1" placeholder="Digite uma mensagem. Use / para respostas rápidas"></textarea>
          <button class="send-btn" id="send-btn" type="button" aria-label="Enviar">${I.send}</button>
        </div>
      </div>`;
    renderChatHead(); renderQueueBar(); if (!loading) renderMessages(true);
    bindComposer();
  }
  function renderChatHead() {
    const el = $('#chat-head'); const c = S.chats.get(S.current); if (!el || !c) return;
    const canAssign = isAdmin() || c.assigned_to == null || c.assigned_to === S.me.id;
    el.innerHTML = `
      <button class="icon-btn back-btn" id="back-btn" aria-label="Voltar">${I.back}</button>
      ${avatarHtml(c)}
      <div class="who"><strong>${esc(chatName(c))}</strong><span class="${c.phone ? 'num' : ''}">${esc(phoneLabel(c))}</span></div>
      <div class="actions">
        <select class="input" id="head-stage" aria-label="Etapa do lead">${c.stage === 'novo' ? '<option value="" selected disabled>Sem resposta</option>' : ''}${S.stages.map(s => `<option value="${s.id}" ${c.stage === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}<optgroup label="Encerrar">${S.outStages.map(s => `<option value="${s.id}" ${c.stage === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</optgroup></select>
        ${canAssign ? `<select class="input" id="head-assign" aria-label="Corretor responsável"><option value="">Fila (sem corretor)</option>${brokers().map(u => `<option value="${u.id}" ${c.assigned_to === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>` : ''}
        <button class="icon-btn" id="info-btn" aria-label="Ficha do lead" title="Ficha do lead">${I.info}</button>
      </div>`;
    $('#back-btn').onclick = closeChat;
    $('#info-btn').onclick = () => toggleDetail();
    $('#head-stage').onchange = e => {
      const v = e.target.value;
      if (v === 'perdido' || v === 'arquivado') { renderChatHead(); confirmOut(c, v); }
      else patchChat({ stage: v });
    };
    const ha = $('#head-assign'); if (ha) ha.onchange = e => patchChat({ assigned_to: e.target.value ? Number(e.target.value) : null });
  }
  function renderQueueBar() {
    const el = $('#queue-bar'); const c = S.chats.get(S.current); if (!el || !c) return;
    if (isOut(c)) {
      el.innerHTML = `<div class="queue-bar out"><span>${c.stage === 'perdido' ? 'Lead marcado como perdido.' : 'Lead arquivado.'} Ele não aparece nas conversas nem no funil.</span><button class="btn sm" id="restore">${I.undo}Reativar</button></div>`;
      $('#restore').onclick = () => patchChat({ restore: true });
      return;
    }
    el.innerHTML = c.assigned_to == null ? `<div class="queue-bar"><span>Este lead está na fila, sem corretor.</span><button class="btn sm primary" id="claim">Assumir atendimento</button></div>` : '';
    const b = $('#claim'); if (b) b.onclick = () => patchChat({ assigned_to: S.me.id });
  }
  async function patchChat(patch) {
    const id = S.current;
    try {
      const r = await A.patch(`/api/chats/${encodeURIComponent(id)}`, patch);
      if (!canSeeChat(r.chat)) { onChatRemoved(id); toast('Lead transferido'); return; }
      S.chats.set(id, r.chat); renderChatHead(); renderQueueBar(); renderDetail(); scheduleListRender();
      if (DEMO) { const m = await A.get(`/api/chats/${encodeURIComponent(id)}`); S.messages = m.messages; renderMessages(true); }
    } catch (e) { toast(e.message, true); renderChatHead(); }
  }

  function msgHtml(m) {
    if (m.kind === 'system') return `<div class="sys">${esc(m.body)} · ${hhmm(m.ts)}</div>`;
    const author = m.author_id ? userById(m.author_id) : null;
    if (m.kind === 'note') {
      return `<div class="msg note"><div class="author">Nota interna · ${esc(author?.name || '')}</div><div class="body">${richText(m.body)}</div><div class="foot">${hhmm(m.ts)}</div></div>`;
    }
    const src = DEMO ? demoMedia(m) : `/api/media/${encodeURIComponent(m.id)}`;
    let media = '';
    if (m.deleted) media = '';
    else if (m.kind === 'image' || m.kind === 'sticker') media = `<a href="${src}" target="_blank" rel="noopener"><img class="media" src="${src}" alt="Imagem" loading="lazy"></a>`;
    else if (m.kind === 'video') media = `<video class="media" src="${src}" controls preload="metadata"></video>`;
    else if (m.kind === 'audio') media = `<audio src="${src}" controls preload="none"></audio>`;
    else if (m.kind === 'document') media = `<a class="doc" href="${src}" target="_blank" rel="noopener">${I.doc}<span>${esc(m.file_name || 'Documento')}</span></a>`;
    let body = '';
    if (m.deleted) body = 'Mensagem apagada';
    else if (m.kind === 'location') { const [lat, rest] = [m.body.split(' · ')[0], m.body.split(' · ').slice(1).join(' · ')]; body = `📍 <a href="https://maps.google.com/?q=${esc(lat)}" target="_blank" rel="noopener">Ver localização</a>${rest ? ' · ' + esc(rest) : ''}`; }
    else if (m.kind === 'contact') body = '👤 ' + esc(m.body);
    else if (m.kind === 'other') body = '<i>Mensagem não suportada. Veja no celular.</i>';
    else if (m.body) body = richText(m.body);
    let ticks = '';
    if (m.from_me) {
      const st = m.status || '';
      if (st === 'READ' || st === 'PLAYED') ticks = `<span class="ticks read">${I.check2}</span>`;
      else if (st === 'DELIVERY_ACK') ticks = `<span class="ticks">${I.check2}</span>`;
      else if (st === 'SERVER_ACK') ticks = `<span class="ticks">${I.check}</span>`;
      else if (st === 'ERROR') ticks = `<span class="ticks" style="color:var(--danger)">${I.alert}</span>`;
      else ticks = `<span class="ticks">${I.clock}</span>`;
    }
    const who = m.from_me ? (author ? author.name : 'Pelo celular') : '';
    return `<div class="msg ${m.from_me ? 'out' : 'in'} ${m.deleted ? 'deleted' : ''}">
      ${m.from_me ? `<div class="author">${esc(who)}</div>` : ''}
      ${media}${body ? `<div class="body">${body}</div>` : ''}
      <div class="foot">${m.edited ? 'editada · ' : ''}${hhmm(m.ts)}${ticks}</div></div>`;
  }
  function renderMessages(scroll) {
    const el = $('#messages'); if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    let html = S.hasMore ? '<button class="btn sm" id="more-btn" style="align-self:center">Carregar mensagens anteriores</button>' : '';
    let lastDay = '';
    for (const m of S.messages) {
      const d = new Date(m.ts).toDateString();
      if (d !== lastDay) { html += `<div class="day">${dayLabel(m.ts)}</div>`; lastDay = d; }
      html += msgHtml(m);
    }
    if (!S.messages.length) html += '<div class="sys">Nenhuma mensagem ainda</div>';
    el.innerHTML = html;
    const more = $('#more-btn'); if (more) more.onclick = loadMore;
    if (scroll || nearBottom) el.scrollTop = el.scrollHeight;
  }
  async function loadMore() {
    const first = S.messages[0]; if (!first) return;
    const el = $('#messages'); const h = el.scrollHeight;
    const r = await A.get(`/api/chats/${encodeURIComponent(S.current)}?before=${first.ts}`);
    S.messages = [...r.messages, ...S.messages]; S.hasMore = r.hasMore;
    renderMessages(false); el.scrollTop = el.scrollHeight - h;
  }

  let pendingFile = null;
  function bindComposer() {
    const ta = $('#compose'); const pop = $('#qr-pop'); let sel = 0; let items = [];
    const autosize = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; };
    const draftKey = 'draft:' + S.current;
    ta.value = store.get(draftKey, ''); autosize();
    const showQr = () => {
      const v = ta.value;
      if (!v.startsWith('/') || v.includes('\n')) { pop.hidden = true; return; }
      const term = v.slice(1).toLowerCase();
      items = S.quickReplies.filter(r => r.shortcut.toLowerCase().includes(term) || r.text.toLowerCase().includes(term)).slice(0, 8);
      if (!items.length) { pop.hidden = true; return; }
      sel = Math.min(sel, items.length - 1);
      pop.innerHTML = items.map((r, i) => `<button type="button" data-i="${i}" class="${i === sel ? 'sel' : ''}"><b>/${esc(r.shortcut)}</b><span>${esc(trunc(r.text, 90))}</span></button>`).join('');
      pop.hidden = false;
    };
    const pick = (i) => { const r = items[i]; if (!r) return; ta.value = r.text; pop.hidden = true; autosize(); ta.focus(); };
    pop.onmousedown = e => { const b = e.target.closest('[data-i]'); if (b) { e.preventDefault(); pick(Number(b.dataset.i)); } };
    ta.addEventListener('input', () => { autosize(); showQr(); store.set(draftKey, ta.value); });
    ta.addEventListener('keydown', e => {
      if (!pop.hidden) {
        if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % items.length; showQr(); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + items.length) % items.length; showQr(); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(sel); return; }
        if (e.key === 'Escape') { pop.hidden = true; return; }
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && window.matchMedia('(min-width: 761px)').matches) { e.preventDefault(); doSend(); }
    });
    $('#send-btn').onclick = doSend;
    $('#attach-btn').onclick = () => $('#file-in').click();
    $('#file-in').onchange = e => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      if (f.size > 16 * 1024 * 1024) return toast('Arquivo acima de 16 MB', true);
      const rd = new FileReader();
      rd.onload = () => {
        pendingFile = { base64: rd.result, mime: f.type || 'application/octet-stream', fileName: f.name };
        const ap = $('#attach-preview'); ap.hidden = false;
        ap.innerHTML = `${I.doc}<span>${esc(f.name)}</span><button class="icon-btn" id="rm-file" aria-label="Remover anexo">${I.x}</button>`;
        $('#rm-file').onclick = () => { pendingFile = null; ap.hidden = true; };
        ta.placeholder = 'Legenda (opcional)'; ta.focus();
      };
      rd.readAsDataURL(f);
    };
    async function doSend() {
      const text = ta.value.trim(); const id = S.current;
      if (!text && !pendingFile) return;
      const btn = $('#send-btn'); btn.disabled = true;
      try {
        if (pendingFile) { await A.post(`/api/chats/${encodeURIComponent(id)}/media`, { ...pendingFile, caption: text }); pendingFile = null; $('#attach-preview').hidden = true; }
        else await A.post(`/api/chats/${encodeURIComponent(id)}/send`, { text });
        ta.value = ''; store.set(draftKey, ''); autosize(); pop.hidden = true;
      } catch (e) { toast(e.message, true); }
      btn.disabled = false; ta.focus();
    }
  }

  // ---------- ficha do lead ----------
  // Ficha do lead: na tela larga fica fixa ao lado (e o X esconde); na estreita abre por cima
  function toggleDetail(show) {
    const ib = $('#inbox'); if (!ib) return;
    if (window.matchMedia('(min-width: 1181px)').matches) {
      const hide = show === undefined ? !ib.classList.contains('hide-detail') : !show;
      ib.classList.toggle('hide-detail', hide); store.set('hideDetail', hide);
    } else {
      ib.classList.toggle('show-detail', show === undefined ? !ib.classList.contains('show-detail') : show);
    }
  }
  function renderDetail() {
    const el = $('#detail-pane'); if (!el) return;
    const c = S.chats.get(S.current);
    if (!c) { el.innerHTML = ''; return; }
    const msgsIn = S.messages.filter(m => !m.from_me && m.kind !== 'system').length;
    const broker = c.assigned_to ? userById(c.assigned_to) : null;
    el.innerHTML = `
      <div class="detail-top">
        <button class="icon-btn" id="close-detail" aria-label="Fechar ficha" style="justify-self:end;margin:-10px -6px 0 0">${I.x}</button>
        ${avatarHtml(c, 'lg')}
        <h2>${esc(chatName(c))} <button class="icon-btn" id="rename" aria-label="Editar nome" title="Editar nome" style="width:28px;height:28px;vertical-align:middle">${I.edit}</button></h2>
        <div class="phone ${c.phone ? 'num' : ''}">${esc(phoneLabel(c))}</div>
        ${c.push_name && c.name ? `<div class="phone">No WhatsApp: ${esc(c.push_name)}</div>` : ''}
      </div>
      ${c.origin === 'anuncio' ? `<div class="detail-sec"><span class="label">Origem</span>
        <div class="ad-card"><strong>${esc(c.ad_title || 'Anúncio')}</strong>${c.ad_url ? `<a href="${esc(c.ad_url)}" target="_blank" rel="noopener">Abrir anúncio</a>` : ''}</div></div>` : ''}
      <div class="detail-sec"><span class="label">Etiquetas</span>
        <div class="tag-pick">${S.tags.map(t => `<button class="${c.tags.includes(t.id) ? 'on' : ''}" data-tag="${t.id}" style="${c.tags.includes(t.id) ? `color:${esc(t.color)}` : ''}"><span class="sw" style="background:${esc(t.color)}"></span><span style="color:var(--fg)">${esc(t.name)}</span></button>`).join('') || '<span class="phone">Crie etiquetas em Configurações.</span>'}</div>
      </div>
      <div class="detail-sec"><span class="label">Resumo</span>
        <dl class="kv">
          <dt>Etapa</dt><dd>${esc(stageName(c.stage))}</dd>
          <dt>Corretor</dt><dd>${esc(broker ? broker.name : 'Fila')}</dd>
          <dt>Primeiro contato</dt><dd class="num">${new Date(c.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</dd>
          <dt>1ª resposta em</dt><dd>${c.first_reply_at ? fmtDuration(c.first_reply_at - c.created_at) : '<span style="color:var(--warn)">Ainda sem resposta</span>'}</dd>
          <dt>Mensagens do cliente</dt><dd class="num">${msgsIn}</dd>
        </dl>
      </div>`;
    $('#close-detail').onclick = () => toggleDetail(false);
    $('#rename').onclick = () => renameModal(c);
    el.querySelectorAll('[data-tag]').forEach(b => b.onclick = () => {
      const id = Number(b.dataset.tag); const set = new Set(c.tags); set.has(id) ? set.delete(id) : set.add(id);
      patchChat({ tags: [...set] });
    });
  }
  function confirmOut(c, stage) {
    const lost = stage === 'perdido';
    modal(`<h3>${lost ? 'Marcar como perdido?' : 'Arquivar este lead?'}</h3>
      <p style="margin:0;color:var(--muted)">${esc(chatName(c))} sai das conversas e do funil e fica em Perdidos e arquivados. Se o cliente mandar mensagem de novo, o lead volta sozinho.</p>
      <div class="modal-actions"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="out-ok">${lost ? 'Marcar como perdido' : 'Arquivar'}</button></div>`,
    (bg, close) => bg.querySelector('#out-ok').onclick = async () => {
      close(); await patchChat({ stage });
      toast(lost ? 'Lead marcado como perdido' : 'Lead arquivado');
    });
  }

  // ---------- modais ----------
  function modal(html, onReady) {
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(bg);
    const close = () => bg.remove();
    bg.addEventListener('mousedown', e => { if (e.target === bg) close(); });
    bg.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    bg.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
    onReady(bg, close);
    const f = bg.querySelector('input, textarea, select'); if (f) f.focus();
  }
  function renameModal(c) {
    modal(`<h3>Nome do contato</h3>
      <div class="field"><label for="rn">Nome</label><input class="input" id="rn" value="${esc(c.name || c.push_name || '')}" placeholder="Como você quer chamar este lead"></div>
      <div class="modal-actions"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="rn-ok">Salvar</button></div>`,
    (bg, close) => { bg.querySelector('#rn-ok').onclick = async () => { await patchChat({ name: bg.querySelector('#rn').value }); close(); }; });
  }
  // ================= funil =================
  let funnelTimer;
  function scheduleFunnel() { clearTimeout(funnelTimer); funnelTimer = setTimeout(renderFunnelCols, 80); }
  function renderFunnel() {
    $('#view').innerHTML = `<div class="page">
      <div class="page-head"><div><h1>Funil de leads</h1><p>O lead entra aqui quando recebe a primeira resposta. Arraste os cartões entre as etapas.</p></div>
        <div class="funnel-filters">
          <input class="input" id="fn-q" placeholder="Buscar lead ou anúncio" value="${esc(S.q)}">
          ${isAdmin() ? `<select class="input" id="fn-broker"><option value="">Todos os corretores</option><option value="queue" ${S.brokerFilter === 'queue' ? 'selected' : ''}>Fila</option>${brokers().map(u => `<option value="${u.id}" ${S.brokerFilter === String(u.id) ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>` : ''}
        </div></div>
      <div class="kanban" id="kanban"></div></div>`;
    $('#fn-q').oninput = e => { S.q = e.target.value; renderFunnelCols(); };
    const fb = $('#fn-broker'); if (fb) fb.onchange = e => { S.brokerFilter = e.target.value; renderFunnelCols(); };
    renderFunnelCols();
  }
  const STAGE_COLORS = { tratativa: '#2F6FFF', agendamento: '#8E5BD9', documento: '#F5B544', aprovado: '#2A9BC4', comprou: '#3DD68C' };
  function renderFunnelCols() {
    const k = $('#kanban'); if (!k) return;
    const q = S.q.trim().toLowerCase();
    const list = [...S.chats.values()].filter(c => {
      if (!inFunnel(c)) return false;
      if (S.brokerFilter === 'queue' && c.assigned_to != null) return false;
      if (S.brokerFilter && S.brokerFilter !== 'queue' && String(c.assigned_to) !== S.brokerFilter) return false;
      if (q && !`${chatName(c)} ${c.ad_title || ''} ${c.phone || ''}`.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => (b.last_at || 0) - (a.last_at || 0));
    k.innerHTML = S.stages.map(s => {
      const items = list.filter(c => c.stage === s.id);
      return `<section class="col" data-col="${s.id}">
        <div class="col-head"><span class="pin" style="background:${STAGE_COLORS[s.id] || 'var(--faint)'}"></span>${esc(s.name)}<span class="n">${items.length}</span></div>
        <div class="col-body">${items.map(c => {
          const b = c.assigned_to ? userById(c.assigned_to) : null;
          return `<article class="card" draggable="true" data-card="${esc(c.id)}">
            <div class="card-top">${avatarHtml(c, 'sm')}<strong>${esc(chatName(c))}</strong>${c.unread ? `<span class="badge" style="margin-left:auto">${c.unread}</span>` : ''}</div>
            ${c.ad_title ? `<div class="sub">${esc(c.ad_title)}</div>` : `<div class="sub">${esc(c.last_text || '')}</div>`}
            ${c.tags.length ? `<div class="chips">${c.tags.slice(0, 3).map(id => { const t = tagById(id); return t ? `<span class="chip"><span class="sw" style="background:${esc(t.color)}"></span>${esc(t.name)}</span>` : ''; }).join('')}</div>` : ''}
            <div class="card-foot"><span>${b ? esc(b.name.split(' ')[0]) : 'Fila'}</span><span>${fmtTime(c.last_at || c.created_at)}</span></div>
          </article>`;
        }).join('')}</div></section>`;
    }).join('');
    let dragId = null;
    k.querySelectorAll('.card').forEach(card => {
      card.addEventListener('dragstart', e => { dragId = card.dataset.card; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
      card.addEventListener('click', () => { S.current = card.dataset.card; goView('inbox'); });
    });
    k.querySelectorAll('.col').forEach(col => {
      col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drop'); });
      col.addEventListener('dragleave', () => col.classList.remove('drop'));
      col.addEventListener('drop', async e => {
        e.preventDefault(); col.classList.remove('drop');
        const c = S.chats.get(dragId); if (!c || c.stage === col.dataset.col) return;
        c.stage = col.dataset.col; renderFunnelCols();
        try { const r = await A.patch(`/api/chats/${encodeURIComponent(c.id)}`, { stage: col.dataset.col }); S.chats.set(c.id, r.chat); }
        catch (err) { toast(err.message, true); loadChats(); }
      });
    });
  }

  // ================= fila de distribuição =================
  async function renderQueue() {
    $('#view').innerHTML = `<div class="page"><div class="page-head"><div><h1>Fila de distribuição</h1><p>Ordem em que os leads novos são entregues aos corretores. Arraste pelo ícone para mudar a posição.</p></div></div>
      <div class="settings"><section class="panel" id="queue-panel"><div class="sys" style="display:inline-block">Carregando…</div></section></div></div>`;
    try { renderQueuePanel(await A.get('/api/queue')); } catch (e) { toast(e.message, true); }
  }
  function renderQueuePanel(st) {
    const el = $('#queue-panel'); if (!el) return;
    S.settings.auto_distribute = st.auto;
    const onCount = st.members.filter(m => m.on).length;
    el.innerHTML = `
      <label class="switch q-auto"><input type="checkbox" id="q-auto" ${st.auto ? 'checked' : ''}><span><strong>Distribuir leads automaticamente</strong><small>${st.auto ? 'Cada lead novo vai para o próximo corretor da fila, em rodízio.' : 'Desligado: os leads novos ficam em Não lidas e o primeiro corretor que responder assume.'}</small></span></label>
      <div class="q-reassign ${st.auto ? '' : 'disabled'}">
        <label class="switch"><input type="checkbox" id="q-re" ${st.reassignOn ? 'checked' : ''} ${st.auto ? '' : 'disabled'}><span><strong>Repassar se não responder</strong><small>Se o corretor não responder o lead no tempo escolhido, ele vai para o próximo da fila. Se ninguém responder, volta para Não lidas.</small></span></label>
        <select class="input" id="q-min" aria-label="Tempo para repassar" ${st.auto && st.reassignOn ? '' : 'disabled'}>${[2, 3, 5, 10, 15, 30].map(m => `<option value="${m}" ${st.reassignMin === m ? 'selected' : ''}>${m} min</option>`).join('')}</select>
      </div>
      ${st.members.length ? `<ol class="q-list" id="q-list">${st.members.map((m, i) => `
        <li class="q-item ${m.on ? '' : 'off'}" data-id="${m.id}">
          <button class="q-grip" aria-label="Arrastar ${esc(m.name)}" title="Arraste para mudar a posição">${I.grip}</button>
          <span class="q-pos num">${i + 1}º</span>
          <div class="avatar sm" style="background:${colorFor('u' + m.id)}">${esc(initials(m.name))}</div>
          <div class="grow"><strong>${esc(m.name)}</strong>${st.auto && st.nextId === m.id ? '<span class="pill admin">Próximo a receber</span>' : ''}${m.on ? '' : '<span class="pill">Pausado</span>'}</div>
          <label class="switch" title="${m.on ? 'Recebe leads' : 'Não recebe leads'}"><input type="checkbox" data-toggle="${m.id}" ${m.on ? 'checked' : ''} aria-label="${esc(m.name)} recebe leads"><span class="q-lbl">${m.on ? 'Recebe' : 'Pausado'}</span></label>
        </li>`).join('')}</ol>
        <p class="q-foot">${onCount} de ${st.members.length} corretores recebendo leads.${!onCount && st.auto ? ' Com todos pausados, os leads ficam em Não lidas.' : ''}</p>`
      : '<div class="empty">Nenhum corretor cadastrado. Adicione a equipe em Configurações › Equipe.</div>'}`;
    $('#q-auto').onchange = async e => { try { renderQueuePanel(await A.patch('/api/queue', { auto: e.target.checked })); toast(e.target.checked ? 'Distribuição automática ligada' : 'Distribuição automática desligada'); } catch (err) { toast(err.message, true); } };
    $('#q-re').onchange = async e => { try { renderQueuePanel(await A.patch('/api/queue', { reassignOn: e.target.checked })); } catch (err) { toast(err.message, true); } };
    $('#q-min').onchange = async e => { try { renderQueuePanel(await A.patch('/api/queue', { reassignMin: Number(e.target.value) })); toast(`Repasse em ${e.target.value} min sem resposta`); } catch (err) { toast(err.message, true); } };
    el.querySelectorAll('[data-toggle]').forEach(t => t.onchange = async () => {
      try { renderQueuePanel(await A.patch('/api/queue', { member: { id: Number(t.dataset.toggle), on: t.checked } })); } catch (err) { toast(err.message, true); }
    });
    const list = $('#q-list'); if (list) enableDrag(list);
  }
  // arrastar com mouse ou dedo, pelo ícone (os eventos ficam na janela porque o item muda de lugar no meio do gesto)
  function enableDrag(list) {
    let item = null; let startY = 0; let moved = false;
    const onMove = (e) => {
      if (!item) return;
      const y = e.clientY;
      const sibs = [...list.children].filter(x => x !== item);
      const ref = sibs.find(x => { const r = x.getBoundingClientRect(); return y < r.top + r.height / 2; }) || null;
      if (ref !== item.nextElementSibling) {
        const before = item.offsetTop;
        list.insertBefore(item, ref);
        startY += item.offsetTop - before;
        moved = true; renumber(list);
      }
      item.style.transform = `translateY(${y - startY}px)`;
      e.preventDefault();
    };
    const onEnd = async () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      if (!item) return;
      item.classList.remove('dragging'); item.style.transform = ''; const was = moved; item = null;
      if (!was) return;
      const order = [...list.children].map(x => Number(x.dataset.id));
      try { renderQueuePanel(await A.patch('/api/queue', { order })); toast('Ordem da fila salva'); } catch (err) { toast(err.message, true); }
    };
    list.querySelectorAll('.q-grip').forEach(g => {
      g.addEventListener('pointerdown', e => {
        item = g.closest('.q-item'); startY = e.clientY; moved = false;
        item.classList.add('dragging'); e.preventDefault();
        window.addEventListener('pointermove', onMove, { passive: false });
        window.addEventListener('pointerup', onEnd);
        window.addEventListener('pointercancel', onEnd);
      });
      g.addEventListener('keydown', async e => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault(); const it = g.closest('.q-item');
        if (e.key === 'ArrowUp' && it.previousElementSibling) list.insertBefore(it, it.previousElementSibling);
        else if (e.key === 'ArrowDown' && it.nextElementSibling) list.insertBefore(it.nextElementSibling, it);
        const order = [...list.children].map(x => Number(x.dataset.id));
        const id = it.dataset.id;
        renderQueuePanel(await A.patch('/api/queue', { order }));
        $(`.q-item[data-id="${id}"] .q-grip`)?.focus();
      });
    });
  }
  function renumber(list) { [...list.children].forEach((x, i) => { const p = x.querySelector('.q-pos'); if (p) p.textContent = `${i + 1}º`; }); }

  // ================= perdidos e arquivados =================
  function renderArchive() {
    $('#view').innerHTML = `<div class="page">
      <div class="page-head"><div><h1>Perdidos e arquivados</h1><p>Leads que saíram das conversas e do funil. Se o cliente voltar a mandar mensagem, o lead volta sozinho.</p></div></div>
      <div class="tabs" id="arc-tabs" style="margin-bottom:12px"></div>
      <div class="panel" style="padding:0"><div id="arc-list"></div></div></div>`;
    renderArchiveList();
  }
  function renderArchiveList() {
    const tabs = $('#arc-tabs'); const el = $('#arc-list'); if (!tabs || !el) return;
    const all = [...S.chats.values()];
    const n = { perdido: all.filter(c => c.stage === 'perdido').length, arquivado: all.filter(c => c.stage === 'arquivado').length };
    tabs.innerHTML = [['perdido', 'Perdidos'], ['arquivado', 'Arquivados']].map(([k, l]) => `<button class="tab ${S.archiveTab === k ? 'active' : ''}" data-a="${k}">${l}<span class="count">${n[k]}</span></button>`).join('');
    tabs.onclick = e => { const b = e.target.closest('[data-a]'); if (b) { S.archiveTab = b.dataset.a; renderArchiveList(); } };
    const list = all.filter(c => c.stage === S.archiveTab).sort((a, b) => (b.stage_changed_at || 0) - (a.stage_changed_at || 0));
    if (!list.length) { el.innerHTML = `<div class="empty">${S.archiveTab === 'perdido' ? I.lost : I.archive}<strong>${S.archiveTab === 'perdido' ? 'Nenhum lead perdido' : 'Nenhum lead arquivado'}</strong><span>Na conversa, escolha Perdido ou Arquivado no seletor de etapa, no topo do chat.</span></div>`; return; }
    el.innerHTML = list.map(c => {
      const b = c.assigned_to ? userById(c.assigned_to) : null;
      return `<div class="arc-row">
        ${avatarHtml(c)}
        <div class="grow"><strong>${esc(chatName(c))}</strong><small>${esc(c.ad_title || 'Sem anúncio')} · ${esc(b ? b.name : 'Fila')} · ${S.archiveTab === 'perdido' ? 'perdido' : 'arquivado'} ${esc(fmtTime(c.stage_changed_at))}</small></div>
        <div class="arc-actions"><button class="btn sm" data-open="${esc(c.id)}">Ver conversa</button><button class="btn sm primary" data-restore="${esc(c.id)}">${I.undo}Reativar</button></div>
      </div>`;
    }).join('');
    el.onclick = async e => {
      const o = e.target.closest('[data-open]'); const r = e.target.closest('[data-restore]');
      if (o) { S.current = o.dataset.open; goView('inbox'); }
      if (r) {
        try { const res = await A.patch(`/api/chats/${encodeURIComponent(r.dataset.restore)}`, { restore: true }); S.chats.set(res.chat.id, res.chat); renderArchiveList(); updateTitle(); toast('Lead reativado e de volta às conversas'); }
        catch (err) { toast(err.message, true); }
      }
    };
  }

  // ================= painel =================
  async function renderDashboard() {
    $('#view').innerHTML = `<div class="page">
      <div class="page-head"><div><h1>Painel</h1><p>${isAdmin() ? 'Desempenho da equipe e dos anúncios' : 'Seus atendimentos'}</p></div>
        <select class="input" id="dash-days" style="width:auto;height:34px">${[0, 7, 30, 90].map(d => `<option value="${d}" ${S.dashDays === d ? 'selected' : ''}>${d === 0 ? 'Hoje' : `Últimos ${d} dias`}</option>`).join('')}</select></div>
      <div id="dash"><div class="sys" style="display:inline-block">Carregando…</div></div></div>`;
    $('#dash-days').onchange = e => { S.dashDays = Number(e.target.value); renderDashboard(); };
    let d; try { d = await A.get(`/api/dashboard?days=${S.dashDays}`); } catch (e) { $('#dash').innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '—');
    const stageMap = Object.fromEntries(d.byStage.map(r => [r.stage, r.n]));
    const maxStage = Math.max(1, ...S.stages.map(s => stageMap[s.id] || 0));
    const maxAd = Math.max(1, ...d.byAd.map(r => r.n));
    $('#dash').innerHTML = `
      <div class="kpis">
        <div class="kpi"><span class="label">Leads novos</span><span class="value">${d.leads}</span><span class="hint">${pct(d.fromAds, d.leads)} vieram de anúncio</span></div>
        <div class="kpi ${d.waiting ? 'alert' : ''}"><span class="label">Aguardando resposta</span><span class="value">${d.waiting}</span><span class="hint">Conversas com mensagem não lida do cliente</span></div>
        <div class="kpi"><span class="label">Tempo da 1ª resposta</span><span class="value" style="font-size:24px">${fmtDuration(d.avgResponseMs)}</span><span class="hint">Média do período</span></div>
        <div class="kpi"><span class="label">Agendaram ou mais</span><span class="value">${d.visits}</span><span class="hint">${pct(d.visits, d.leads)} dos leads do período</span></div>
        <div class="kpi"><span class="label">Compraram</span><span class="value">${d.sales}</span><span class="hint">Movidos para Comprou no período</span></div>
        <div class="kpi"><span class="label">Perdidos e arquivados</span><span class="value">${d.lost ?? 0}</span><span class="hint">Encerrados no período</span></div>
      </div>
      <div class="grid-2">
        <div class="panel"><h2>${d.days === 0 ? 'Leads por hora' : 'Leads por dia'}</h2>${sparkSvg(d.perDay, d.days)}</div>
        <div class="panel"><h2>Funil agora</h2><div class="bars">${S.stages.map(s => barRow(s.name, stageMap[s.id] || 0, maxStage, STAGE_COLORS[s.id])).join('')}</div></div>
        <div class="panel"><h2>Leads por anúncio</h2><div class="bars">${d.byAd.length ? d.byAd.map(r => barRow(r.title, r.n, maxAd)).join('') : '<span class="phone">Sem leads no período.</span>'}</div></div>
        ${isAdmin() ? `<div class="panel wide"><h2>Corretores</h2><div class="table-wrap"><table class="t"><thead><tr><th>Corretor</th><th class="n">Leads</th><th class="n">Agend.+</th><th class="n">Compras</th><th class="n">1ª resp.</th></tr></thead><tbody>
          ${d.byBroker.map(b => `<tr><td>${esc(b.name)}</td><td class="n">${b.leads}</td><td class="n">${b.avancados}</td><td class="n">${b.vendas}</td><td class="n">${fmtDuration(b.resp)}</td></tr>`).join('') || '<tr><td colspan="5">Cadastre corretores em Configurações.</td></tr>'}
        </tbody></table></div></div>` : ''}
      </div>`;
  }
  const barRow = (label, v, max, color) => `<div class="bar-row"><span class="lbl" title="${esc(label)}">${esc(label)}</span><div class="bar-track"><div class="bar-fill" style="width:${(v / max) * 100}%;${color ? `background:${color}` : ''}"></div></div><span class="v">${v}</span></div>`;
  function sparkSvg(times, days) {
    const today = days === 0;
    const n = today ? 24 : Math.min(days, 30); const counts = new Array(n).fill(0);
    const start = new Date(); start.setHours(0, 0, 0, 0); if (!today) start.setDate(start.getDate() - (n - 1));
    const slot = today ? 36e5 : 864e5; const nowIdx = today ? new Date().getHours() : n - 1;
    times.forEach(t => { const i = Math.floor((t - start) / slot); if (i >= 0 && i < n) counts[i]++; });
    const max = Math.max(1, ...counts); const W = 420, H = 170, pad = 22, bw = (W - pad) / n;
    const nice = max <= 4 ? max : Math.ceil(max / 2) * 2;
    let bars = '';
    counts.forEach((c, i) => {
      const h = (c / nice) * (H - 30);
      bars += `<rect x="${pad + i * bw + 1.5}" y="${H - 18 - h}" width="${Math.max(bw - 3, 2)}" height="${h}" rx="2" fill="var(--accent)" opacity="${i === nowIdx ? 1 : .7}"><title>${today ? `${i}h: ` : ''}${c} lead(s)</title></rect>`;
    });
    const d0 = today ? '0h' : start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="${today ? 'Leads por hora' : 'Leads por dia'}">
      <line x1="${pad}" y1="${H - 18}" x2="${W}" y2="${H - 18}" stroke="var(--line)"/>
      <line x1="${pad}" y1="${12}" x2="${W}" y2="${12}" stroke="var(--line)" stroke-dasharray="3 4"/>
      <text x="0" y="16">${nice}</text><text x="0" y="${H - 18}">0</text>
      ${bars}
      <text x="${pad}" y="${H - 3}">${d0}</text><text x="${W}" y="${H - 3}" text-anchor="end">${today ? '23h' : 'hoje'}</text></svg>`;
  }

  // ================= configurações =================
  function renderConfig() {
    const admin = isAdmin();
    $('#view').innerHTML = `<div class="page"><div class="page-head"><div><h1>Configurações</h1></div></div><div class="settings">
      ${admin ? `<section class="panel"><h2>Conexão do WhatsApp</h2><p>O número conectado aqui é espelhado para toda a equipe. O celular continua funcionando normalmente.</p><div id="wa-box"></div></section>
      <section class="panel"><h2>Equipe</h2><p>Corretores veem a Fila e as conversas deles. Administradores veem tudo.</p><div class="row-list" id="users-list"></div>
        <form class="inline-form" id="user-form"><input class="input" id="u-name" placeholder="Nome" required><input class="input" id="u-email" type="email" placeholder="E-mail" required><input class="input" id="u-pass" type="text" placeholder="Senha inicial" required minlength="6"><select class="input" id="u-role" style="flex:0 0 130px"><option value="corretor">Corretor</option><option value="admin">Administrador</option></select><button class="btn primary" type="submit">${I.plus}Adicionar</button></form></section>
      <section class="panel"><h2>Etiquetas</h2><div class="row-list" id="tags-list"></div>
        <form class="inline-form" id="tag-form"><input class="input" id="t-name" placeholder="Nova etiqueta" required><input type="color" class="input" id="t-color" value="#2F6FFF" aria-label="Cor"><button class="btn primary" type="submit">${I.plus}Adicionar</button></form></section>
      <section class="panel"><h2>Respostas rápidas</h2><p>Na conversa, digite / e o atalho para inserir o texto.</p><div class="row-list" id="qr-list"></div>
        <form class="inline-form" id="qr-form" style="display:grid;grid-template-columns:140px 1fr auto"><input class="input" id="q-short" placeholder="atalho" required><input class="input" id="q-text" placeholder="Texto da resposta" required><button class="btn primary" type="submit">${I.plus}</button></form></section>` : ''}
      <section class="panel"><h2>Como o lead me vê</h2><p>Foto e nome que o cliente vê no WhatsApp.</p><div id="wa-profile"><div class="sys" style="display:inline-block">Carregando…</div></div></section>
      <section class="panel"><h2>Minha conta</h2><p>${esc(S.me.name)} · ${esc(S.me.email)}</p>
        <div style="display:grid;gap:12px">
          <label class="switch"><input type="checkbox" id="snd" ${store.get('sound', true) ? 'checked' : ''}><span>Som ao chegar mensagem</span></label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <button class="btn" id="notif-btn">Ativar notificações do navegador</button>
            <select class="input" id="theme-sel" style="width:auto"><option value="dark">Tema escuro (padrão)</option><option value="light">Tema claro</option></select>
          </div>
          <form class="inline-form" id="pw-form" style="margin:0"><input class="input" id="pw-new" type="password" placeholder="Nova senha" minlength="6" autocomplete="new-password" required><button class="btn" type="submit">Trocar senha</button></form>
          <div><button class="btn danger" id="logout-btn">${I.logout}Sair</button></div>
        </div></section>
    </div></div>`;
    if (admin) { renderWaBox(); refreshWa(); bindAdminConfig(); }
    loadProfile();
    $('#snd').onchange = e => store.set('sound', e.target.checked);
    $('#theme-sel').value = store.get('theme', 'dark') === 'light' ? 'light' : 'dark';
    $('#theme-sel').onchange = e => { store.set('theme', e.target.value); applyTheme(); };
    $('#notif-btn').onclick = async () => {
      if (!('Notification' in window)) return toast('Este navegador não oferece notificações', true);
      const p = await Notification.requestPermission();
      toast(p === 'granted' ? 'Notificações ativadas' : 'Notificações bloqueadas no navegador', p !== 'granted');
    };
    $('#pw-form').onsubmit = async e => { e.preventDefault(); try { await A.patch(`/api/users/${S.me.id}`, { password: $('#pw-new').value }); $('#pw-new').value = ''; toast('Senha alterada'); } catch (err) { toast(err.message, true); } };
    $('#logout-btn').onclick = async () => { if (DEMO) return toast('Na demonstração não há login'); await A.post('/api/logout'); location.reload(); };
  }
  async function loadProfile(fresh) {
    const el = $('#wa-profile'); if (!el) return;
    let p; try { p = await A.get('/api/wa/profile' + (fresh ? '?fresh=1' : '')); } catch (e) { el.innerHTML = `<div class="phone">${esc(e.message)}</div>`; return; }
    if (!$('#wa-profile')) return;
    if (!p.connected) { el.innerHTML = `<div class="phone">${isAdmin() ? 'Conecte o número acima para ver o perfil.' : 'O número do WhatsApp ainda não está conectado.'}</div>`; return; }
    el.innerHTML = `<div class="wp-card" aria-label="Perfil no WhatsApp">
        <div class="wp-photo">${p.picture ? `<img src="${esc(p.picture)}" alt="Foto do perfil" onerror="this.remove()">` : ''}<span>${esc(initials(p.name || 'WhatsApp'))}</span></div>
        <div class="wp-name">${esc(p.name || 'Sem nome no perfil')}</div>
      </div>`;
  }
  async function refreshWa() { try { S.waFull = await A.get('/api/wa/status'); S.wa.state = S.waFull.state; renderWaBox(); renderWaWarn(); } catch (e) { toast(e.message, true); } }
  function renderWaBox() {
    const el = $('#wa-box'); if (!el) return;
    const w = S.waFull || S.wa; const st = w.state;
    const label = { open: 'Conectado', connecting: 'Aguardando leitura do QR Code', close: 'Desconectado', missing: 'Ainda não conectado', offline: 'Servidor do WhatsApp fora do ar', unknown: 'Verificando…' }[st] || st;
    el.innerHTML = `<div class="wa-box">
      <div class="qr-frame">${st === 'open' ? `<div class="ph" style="color:var(--ok)">${I.check.replace('<svg', '<svg style="width:56px;height:56px"')}<br>Número conectado</div>` : (w.qr ? `<img src="${esc(w.qr)}" alt="QR Code para conectar o WhatsApp">` : '<div class="ph">Clique em Gerar QR Code</div>')}</div>
      <div style="display:grid;gap:12px">
        <div><span class="status-pill ${st}"><span class="d"></span>${esc(label)}</span></div>
        ${st === 'open' ? `<p style="margin:0;color:var(--muted)">Tudo certo. As mensagens novas aparecem em Conversas na hora.</p>
          <div><button class="btn danger" id="wa-logout">Desconectar número</button></div>` : `
          <ol class="steps"><li>No celular, abra o WhatsApp Business do número de trabalho.</li><li>Toque em Configurações e depois em Dispositivos conectados.</li><li>Toque em Conectar dispositivo e aponte para o QR Code.</li></ol>
          ${w.pairingCode ? `<div><span class="label">Ou digite este código no celular</span><div class="pairing">${esc(w.pairingCode)}</div></div>` : ''}
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="wa-connect">${w.qr ? 'Gerar novo QR Code' : 'Gerar QR Code'}</button><button class="btn" id="wa-code">${I.phone}Conectar com código</button></div>`}
      </div></div>`;
    const c = $('#wa-connect'); if (c) c.onclick = async () => { c.disabled = true; try { S.waFull = await A.post('/api/wa/connect'); renderWaBox(); } catch (e) { toast(e.message, true); c.disabled = false; } };
    const pc = $('#wa-code'); if (pc) pc.onclick = () => modal(`<h3>Conectar com código</h3><p style="margin:0;color:var(--muted)">Útil quando você está no celular e não dá para ler o QR Code. Informe o número que vai ser conectado.</p>
      <div class="field"><label for="pc-num">Número com DDD</label><input class="input num" id="pc-num" inputmode="tel" placeholder="(11) 91234-5678"></div>
      <div class="modal-actions"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="pc-ok">Gerar código</button></div>`,
      (bg, close) => bg.querySelector('#pc-ok').onclick = async () => {
        let n = bg.querySelector('#pc-num').value.replace(/\D/g, ''); if (n.length <= 11) n = '55' + n;
        try { S.waFull = await A.post('/api/wa/connect', { number: n }); close(); renderWaBox(); } catch (e) { toast(e.message, true); }
      });
    const lo = $('#wa-logout'); if (lo) lo.onclick = () => modal(`<h3>Desconectar o número?</h3><p style="margin:0;color:var(--muted)">A equipe para de receber mensagens aqui até você conectar de novo. O histórico já salvo continua na plataforma.</p>
      <div class="modal-actions"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="lo-ok" style="background:var(--danger);border-color:var(--danger);color:#fff">Desconectar</button></div>`,
      (bg, close) => bg.querySelector('#lo-ok').onclick = async () => { try { S.waFull = await A.post('/api/wa/logout'); close(); renderWaBox(); renderWaWarn(); } catch (e) { toast(e.message, true); } });
  }
  function bindAdminConfig() {
    const ul = $('#users-list');
    ul.innerHTML = S.users.map(u => `<div class="row-item"><div class="avatar sm" style="background:${colorFor('u' + u.id)}">${esc(initials(u.name))}</div>
      <div class="grow"><strong>${esc(u.name)}</strong><small>${esc(u.email)}</small></div>
      <span class="pill ${u.role === 'admin' ? 'admin' : ''} ${u.active ? '' : 'off'}">${u.active ? (u.role === 'admin' ? 'Admin' : 'Corretor') : 'Inativo'}</span>
      ${u.id !== S.me.id ? `<button class="btn sm ghost" data-toggle="${u.id}">${u.active ? 'Desativar' : 'Reativar'}</button><button class="btn sm ghost" data-reset="${u.id}">Nova senha</button>` : ''}</div>`).join('');
    ul.onclick = async e => {
      const t = e.target.closest('[data-toggle]'); const r = e.target.closest('[data-reset]');
      if (t) { const u = userById(Number(t.dataset.toggle)); try { await A.patch(`/api/users/${u.id}`, { active: !u.active }); await reloadBootstrap(); renderConfig(); } catch (err) { toast(err.message, true); } }
      if (r) modal(`<h3>Nova senha</h3><div class="field"><label for="np">Senha (mínimo 6 caracteres)</label><input class="input" id="np" type="text"></div><div class="modal-actions"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="np-ok">Salvar</button></div>`,
        (bg, close) => bg.querySelector('#np-ok').onclick = async () => { try { await A.patch(`/api/users/${r.dataset.reset}`, { password: bg.querySelector('#np').value }); close(); toast('Senha alterada'); } catch (err) { toast(err.message, true); } });
    };
    $('#user-form').onsubmit = async e => {
      e.preventDefault();
      try { await A.post('/api/users', { name: $('#u-name').value, email: $('#u-email').value, password: $('#u-pass').value, role: $('#u-role').value }); await reloadBootstrap(); renderConfig(); toast('Usuário criado. Envie o e-mail e a senha para ele.'); }
      catch (err) { toast(err.message, true); }
    };
    $('#tags-list').innerHTML = S.tags.map(t => `<div class="row-item"><span class="chip"><span class="sw" style="background:${esc(t.color)}"></span>${esc(t.name)}</span><span class="grow"></span><button class="icon-btn" data-deltag="${t.id}" aria-label="Excluir etiqueta">${I.trash}</button></div>`).join('');
    $('#tags-list').onclick = async e => { const b = e.target.closest('[data-deltag]'); if (b) { await A.del(`/api/tags/${b.dataset.deltag}`); await reloadBootstrap(); renderConfig(); } };
    $('#tag-form').onsubmit = async e => { e.preventDefault(); await A.post('/api/tags', { name: $('#t-name').value, color: $('#t-color').value }); await reloadBootstrap(); renderConfig(); };
    $('#qr-list').innerHTML = S.quickReplies.map(r => `<div class="row-item"><div class="grow"><strong class="num">/${esc(r.shortcut)}</strong><small>${esc(r.text)}</small></div><button class="icon-btn" data-delqr="${r.id}" aria-label="Excluir resposta">${I.trash}</button></div>`).join('');
    $('#qr-list').onclick = async e => { const b = e.target.closest('[data-delqr]'); if (b) { await A.del(`/api/quick-replies/${b.dataset.delqr}`); await reloadBootstrap(); renderConfig(); } };
    $('#qr-form').onsubmit = async e => { e.preventDefault(); await A.post('/api/quick-replies', { shortcut: $('#q-short').value.replace(/^\//, ''), text: $('#q-text').value }); await reloadBootstrap(); renderConfig(); };
  }

  // ================= modo demonstração =================
  function demoMedia(m) {
    if (m._src) return m._src;
    if (m.kind === 'image') return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><rect width="320" height="200" fill="#cfe3dc"/><rect x="40" y="70" width="110" height="110" fill="#8fb7a8"/><rect x="160" y="40" width="120" height="140" fill="#6f9e8d"/><g fill="#e8f2ee">${[0, 1, 2, 3].map(r => [0, 1, 2].map(c => `<rect x="${172 + c * 36}" y="${52 + r * 30}" width="24" height="18"/>`).join('')).join('')}</g><text x="16" y="28" font-family="sans-serif" font-size="13" fill="#2c4a40">Planta 2 dorms · 41 m²</text></svg>`);
    return '';
  }
  function demoApi() {
    const now = Date.now(); const min = 60e3; const hr = 60 * min; const day = 24 * hr;
    const users = [
      { id: 1, name: 'Kevin Araujo', email: 'kevin@exemplo.com', role: 'admin', active: true },
      { id: 2, name: 'Ana Paula Ribeiro', email: 'ana@exemplo.com', role: 'corretor', active: true },
      { id: 3, name: 'Rafael Souza', email: 'rafael@exemplo.com', role: 'corretor', active: true },
      { id: 4, name: 'Juliana Lima', email: 'juliana@exemplo.com', role: 'corretor', active: true },
    ];
    const tags = [{ id: 1, name: 'Análise assessoria', color: '#3e6fd0' }, { id: 2, name: 'Fazer follow up', color: '#f5a524' }, { id: 3, name: 'IR 2027', color: '#2A9BC4' }, { id: 4, name: 'Restrição', color: '#e5484d' }, { id: 5, name: 'Perfil de comprador', color: '#8e4ec6' }];
    const qrs = [
      { id: 1, shortcut: 'oi', text: 'Olá! Tudo bem? Aqui é da equipe de parcerias Cury. Vi que você se interessou pelo nosso anúncio. Qual empreendimento chamou sua atenção?' },
      { id: 2, shortcut: 'renda', text: 'Para eu te passar as melhores condições, me conta: qual a sua renda familiar aproximada e se você tem FGTS disponível?' },
      { id: 3, shortcut: 'visita', text: 'Que tal conhecer o decorado pessoalmente? Tenho horários disponíveis esta semana. Qual dia fica melhor para você?' },
    ];
    const stages = [{ id: 'tratativa', name: 'Tratativa' }, { id: 'agendamento', name: 'Agendamento' }, { id: 'documento', name: 'Captar documento' }, { id: 'aprovado', name: 'Aprovado' }, { id: 'comprou', name: 'Comprou' }];
    const outStages = [{ id: 'perdido', name: 'Perdido' }, { id: 'arquivado', name: 'Arquivado' }];
    const ADS = ['Lyne Santo Amaro · 2 dorms', 'Estoque Zona Sul · pronto para morar', 'Lançamento Vila Prudente', null];
    const people = [
      ['Mariana Costa', '5511987654321', 0, 'novo', null, [], 3 * min],
      ['Carlos Eduardo', '5511976543210', 0, 'tratativa', 2, [1, 3], 18 * min],
      ['Fernanda Alves', '5511965432109', 1, 'agendamento', 3, [5], 2 * hr],
      ['João Pedro Martins', '5511954321098', 0, 'tratativa', 4, [2], 5 * hr],
      ['Patrícia Gomes', '5511943210987', 2, 'documento', 2, [1], 1 * day],
      ['Ricardo Nunes', '5511932109876', 1, 'novo', null, [], 40 * min],
      ['Beatriz Santos', '5511921098765', 0, 'comprou', 3, [5], 3 * day],
      ['Lucas Oliveira', '5511910987654', 3, 'perdido', 4, [4], 4 * day],
      ['Amanda Ferreira', '5511998877665', 2, 'aprovado', 2, [3], 26 * hr],
      ['Thiago Rocha', '5511987766554', 0, 'agendamento', 4, [2, 5], 2 * day],
    ];
    const chats = new Map(); const msgs = new Map(); let seq = 1;
    const addMsg = (cid, m) => { const arr = msgs.get(cid) || []; const full = { id: 'm' + (seq++), status: m.from_me ? 'READ' : null, author_id: null, deleted: false, edited: false, mime: null, file_name: null, ...m }; arr.push(full); msgs.set(cid, arr); return full; };
    people.forEach(([name, phone, ad, stage, who, tg, ago], i) => {
      const id = phone + '@s.whatsapp.net'; const created = now - ago - 20 * min;
      const adTitle = ADS[ad];
      const c = { id, lid: null, phone, name: null, push_name: name, avatar: null, stage, tags: tg, assigned_to: who, notes: i === 1 ? 'Renda familiar R$ 5.200, tem FGTS. Quer 2 dorms perto do metrô.' : '', unread: 0, last_text: '', last_at: 0, last_from_me: false, origin: adTitle ? 'anuncio' : 'whatsapp', ad_title: adTitle, ad_body: adTitle ? 'Entrada facilitada e parcelas que cabem no bolso.' : null, ad_url: adTitle ? 'https://fb.me/exemplo-anuncio' : null, ad_id: null, created_at: created, first_reply_at: who ? created + (4 + i * 3) * min : null, stage_changed_at: created };
      chats.set(id, c);
      if (adTitle) addMsg(id, { chat_id: id, from_me: false, kind: 'system', body: `Lead veio do anúncio: ${adTitle}`, ts: created - 1000 });
      addMsg(id, { chat_id: id, from_me: false, kind: 'text', body: 'Olá! Tenho interesse e queria mais informações, por favor.', ts: created });
      if (who) {
        addMsg(id, { chat_id: id, from_me: true, kind: 'text', body: qrs[0].text, ts: c.first_reply_at, author_id: who });
        addMsg(id, { chat_id: id, from_me: false, kind: 'text', body: i % 2 ? 'O de 2 dormitórios. Aceita FGTS na entrada?' : 'Quero saber o valor da parcela e se tem vaga de garagem.', ts: c.first_reply_at + 6 * min });
        if (i === 2) addMsg(id, { chat_id: id, from_me: true, kind: 'image', body: 'Essa é a planta do 2 dorms 😊', ts: c.first_reply_at + 9 * min, author_id: who });
        if (stage === 'agendamento') addMsg(id, { chat_id: id, from_me: true, kind: 'text', body: 'Perfeito! Visita confirmada no decorado sábado às *10h*. Te mando a localização.', ts: now - ago, author_id: who });
        else if (stage === 'comprou') addMsg(id, { chat_id: id, from_me: false, kind: 'text', body: 'Contrato assinado! Muito obrigada pela atenção de vocês 🙏', ts: now - ago });
        else addMsg(id, { chat_id: id, from_me: i % 3 === 0, kind: 'text', body: i % 3 === 0 ? 'Vou te mandar a simulação ainda hoje.' : 'Consegue me ligar depois das 18h?', ts: now - ago, author_id: i % 3 === 0 ? who : null });
      } else if (i === 5) addMsg(id, { chat_id: id, from_me: false, kind: 'text', body: 'Esse apartamento ainda está disponível?', ts: now - ago });
      const arr = msgs.get(id).filter(m => m.kind !== 'system' && m.kind !== 'note'); const last = arr[arr.length - 1];
      c.last_text = last.kind === 'image' ? '📷 ' + last.body : last.body; c.last_at = last.ts; c.last_from_me = last.from_me;
      c.unread = last.from_me ? 0 : (i === 0 ? 2 : i === 3 ? 1 : i === 5 ? 1 : 0);
    });
    // mais alguns leads antigos para o painel
    for (let k = 0; k < 34; k++) {
      const id = `55119${String(10000000 + k * 7919).slice(0, 8)}@s.whatsapp.net`; const t = now - (2 + (k * 7) % 28) * day - k * hr;
      const st = ['tratativa', 'agendamento', 'perdido', 'documento', 'aprovado', 'comprou', 'arquivado', 'tratativa'][k % 8];
      chats.set(id, { id, phone: id.split('@')[0], name: null, push_name: ['Gabriel', 'Larissa', 'Rodrigo', 'Camila', 'Felipe', 'Aline', 'Bruno', 'Vanessa'][k % 8] + ' ' + ['Silva', 'Pereira', 'Melo', 'Dias', 'Barros', 'Teixeira'][k % 6], avatar: null, stage: st, tags: [], assigned_to: 2 + (k % 3), notes: '', unread: 0, last_text: 'Obrigado, vou pensar e te retorno.', last_at: t + 2 * hr, last_from_me: false, origin: k % 4 ? 'anuncio' : 'whatsapp', ad_title: k % 4 ? ADS[k % 3] : null, created_at: t, first_reply_at: t + (5 + (k % 9) * 4) * min, stage_changed_at: t + day });
      msgs.set(id, [{ id: 'old' + k, chat_id: id, from_me: false, kind: 'text', body: 'Olá! Tenho interesse e queria mais informações, por favor.', ts: t }]);
    }
    let me = users[0];
    const queue = { auto: true, order: [2, 3, 4], paused: new Set(), last: 3, reOn: true, reMin: 5 };
    function queueState() {
      const all = queue.order.map(id => users.find(u => u.id === id)).filter(u => u && u.active && u.role === 'corretor');
      const on = all.filter(u => !queue.paused.has(u.id));
      let next = null; const i = all.findIndex(u => u.id === queue.last);
      for (let k = 1; k <= all.length && !next; k++) { const u = all[(i + k + all.length) % all.length]; if (u && !queue.paused.has(u.id)) next = u; }
      if (!next && on.length) next = on[0];
      return { reassignOn: queue.reOn, reassignMin: queue.reMin, auto: queue.auto, nextId: next ? next.id : null, members: all.map(u => ({ id: u.id, name: u.name, on: !queue.paused.has(u.id) })) };
    }
    const visible = (c) => me.role === 'admin' || c.assigned_to == null || c.assigned_to === me.id;
    const restoreStage = (c) => (c.prev_stage && c.prev_stage !== 'perdido' && c.prev_stage !== 'arquivado' ? c.prev_stage : (c.first_reply_at ? 'tratativa' : 'novo'));
    const clone = (o) => JSON.parse(JSON.stringify(o));
    const chatOut = (c) => { const o = clone(c); if (me.role !== 'admin') { o.phone = null; o.phone_hidden = true; } return o; };
    const touch = (c, m) => { c.last_text = m.kind === 'image' ? '📷 ' + (m.body || 'Foto') : m.kind === 'document' ? '📄 ' + m.file_name : m.body; c.last_at = m.ts; c.last_from_me = m.from_me; };
    const emitMsg = (cid, m) => setTimeout(() => onMessageEvent(cid, clone(m)), 0);
    const emitChat = (c) => setTimeout(() => (visible(c) ? onChatEvent(chatOut(c)) : onChatRemoved(c.id)), 0);
    function clientReply(cid, text, delay) {
      setTimeout(() => {
        const c = chats.get(cid); if (!c) return;
        const m = addMsg(cid, { chat_id: cid, from_me: false, kind: 'text', body: text, ts: Date.now() });
        touch(c, m); if (S.current !== cid) c.unread++;
        if (c.stage === 'perdido' || c.stage === 'arquivado') { c.stage = restoreStage(c); c.prev_stage = null; emitMsg(cid, addMsg(cid, { chat_id: cid, from_me: true, kind: 'system', body: 'O cliente voltou a conversar. Lead reativado.', ts: Date.now() })); }
        emitChat(c); emitMsg(cid, m);
      }, delay);
    }
    // um lead novo chega alguns segundos depois de abrir
    setTimeout(() => {
      const id = '5511912345678@s.whatsapp.net'; const t = Date.now();
      const c = { id, phone: '5511912345678', name: null, push_name: 'Renata Moreira', avatar: null, stage: 'novo', tags: [], assigned_to: null, notes: '', unread: 1, last_text: '', last_at: t, last_from_me: false, origin: 'anuncio', ad_title: ADS[0], ad_body: 'Entrada facilitada e parcelas que cabem no bolso.', ad_url: 'https://fb.me/exemplo-anuncio', created_at: t, first_reply_at: null, stage_changed_at: t };
      chats.set(id, c);
      addMsg(id, { chat_id: id, from_me: false, kind: 'system', body: `Lead veio do anúncio: ${ADS[0]}`, ts: t - 1 });
      const m = addMsg(id, { chat_id: id, from_me: false, kind: 'text', body: 'Oi! Vi o anúncio do Lyne Santo Amaro. Qual o valor da entrada?', ts: t });
      touch(c, m); emitChat(c); i18nNotify(id, m);
    }, 9000);

    const err = (m, s = 400) => Promise.reject(new Error(m));
    const routes = {
      'GET /api/bootstrap': () => ({ me: clone(me), users: clone(users), tags: clone(tags), quickReplies: clone(qrs), stages, outStages, settings: { auto_distribute: false }, wa: { state: 'open' } }),
      'GET /api/chats': () => ({ chats: [...chats.values()].filter(visible).map(chatOut) }),
      'GET /api/wa/status': () => ({ state: 'open', qr: null }),
      'POST /api/wa/connect': () => ({ state: 'open' }),
      'POST /api/wa/logout': () => ({ state: 'open' }),
      'GET /api/wa/profile': () => ({ connected: true, name: 'Kevin Araujo | Parceiro Cury', picture: null }),
      'PATCH /api/settings': (b) => ({ settings: { auto_distribute: !!b.auto_distribute } }),
      'GET /api/queue': () => queueState(),
      'PATCH /api/queue': (b) => {
        if (b.auto !== undefined) queue.auto = !!b.auto;
        if (Array.isArray(b.order)) queue.order = b.order.map(Number);
        if (b.member) { if (b.member.on) queue.paused.delete(b.member.id); else queue.paused.add(b.member.id); }
        if (b.reassignOn !== undefined) queue.reOn = !!b.reassignOn;
        if (b.reassignMin !== undefined) queue.reMin = Number(b.reassignMin);
        return queueState();
      },
      'GET /api/dashboard': (b, q) => {
        const days = q.get('days') === '0' ? 0 : (Number(q.get('days')) || 30); const md = new Date(); md.setHours(0, 0, 0, 0); const since = days === 0 ? md.getTime() : Date.now() - days * day; const all = [...chats.values()].filter(c => me.role === 'admin' || c.assigned_to === me.id);
        const inP = all.filter(c => c.created_at >= since);
        const resp = inP.filter(c => c.first_reply_at); const avg = resp.length ? resp.reduce((a, c) => a + (c.first_reply_at - c.created_at), 0) / resp.length : null;
        const byStage = stages.map(s => ({ stage: s.id, n: all.filter(c => c.stage === s.id).length }));
        const adMap = {}; inP.forEach(c => { const k = c.ad_title || 'Sem anúncio'; adMap[k] = (adMap[k] || 0) + 1; });
        const ADV = ['agendamento', 'documento', 'aprovado', 'comprou'];
        return { days, leads: inP.length, fromAds: inP.filter(c => c.origin === 'anuncio').length, sales: all.filter(c => c.stage === 'comprou' && c.stage_changed_at >= since).length, visits: inP.filter(c => ADV.includes(c.stage)).length, lost: all.filter(c => ['perdido', 'arquivado'].includes(c.stage) && c.stage_changed_at >= since).length, waiting: all.filter(c => c.unread > 0 && !c.last_from_me && !['perdido', 'arquivado'].includes(c.stage)).length, avgResponseMs: avg, byStage,
          byAd: Object.entries(adMap).map(([title, n]) => ({ title, n })).sort((a, b) => b.n - a.n),
          byBroker: me.role !== 'admin' ? [] : users.filter(u => u.active).map(u => { const mine = all.filter(c => c.assigned_to === u.id); const r = mine.filter(c => c.first_reply_at && c.created_at >= since); return { id: u.id, name: u.name, leads: mine.filter(c => c.created_at >= since).length, avancados: mine.filter(c => ['agendamento', 'documento', 'aprovado', 'comprou'].includes(c.stage)).length, vendas: mine.filter(c => c.stage === 'comprou').length, resp: r.length ? r.reduce((a, c) => a + (c.first_reply_at - c.created_at), 0) / r.length : null }; }).sort((a, b) => b.leads - a.leads),
          perDay: inP.map(c => c.created_at) };
      },
    };
    async function handle(method, url, body) {
      await new Promise(r => setTimeout(r, 60));
      const u = new URL(url, 'http://x'); const path = u.pathname; const key = `${method} ${path}`;
      if (routes[key]) return routes[key](body || {}, u.searchParams);
      let m;
      if ((m = path.match(/^\/api\/chats\/([^/]+)(\/\w+)?$/))) {
        const id = decodeURIComponent(m[1]); const sub = m[2];
        if (id === 'new' && method === 'POST') {
          let d = String(body.phone || '').replace(/\D/g, ''); if (d.length <= 11) d = '55' + d; if (d.length < 12) return err('Número inválido. Use DDD + número.');
          const cid = d + '@s.whatsapp.net';
          if (!chats.has(cid)) chats.set(cid, { id: cid, phone: d, name: null, push_name: null, avatar: null, stage: 'tratativa', tags: [], assigned_to: me.id, notes: '', unread: 0, last_text: '', last_at: Date.now(), last_from_me: true, origin: 'whatsapp', created_at: Date.now(), first_reply_at: null, stage_changed_at: Date.now() });
          const c = chats.get(cid); const msg = addMsg(cid, { chat_id: cid, from_me: true, kind: 'text', body: body.text, ts: Date.now(), author_id: me.id, status: 'SERVER_ACK' }); touch(c, msg);
          return { chat: chatOut(c) };
        }
        const c = chats.get(id); if (!c || !visible(c)) return err('Conversa não encontrada', 404);
        if (!sub && method === 'PATCH' && body.assigned_to !== undefined && me.role !== 'admin' && c.assigned_to != null && c.assigned_to !== me.id) return err('Sem permissão');
        if (!sub && method === 'GET') { const arr = msgs.get(id) || []; const before = Number(u.searchParams.get('before')) || Infinity; const list = arr.filter(x => x.ts < before); return { chat: chatOut(c), messages: clone(list.slice(-150)), hasMore: list.length > 150 }; }
        if (sub === '/read') { c.unread = 0; return { ok: true }; }
        if (!sub && method === 'PATCH') {
          const sys = [];
          const OUT = ['perdido', 'arquivado'];
          if (body.restore && OUT.includes(c.stage)) { c.stage = restoreStage(c); c.prev_stage = null; c.stage_changed_at = Date.now(); sys.push(`${me.name} reativou o lead`); }
          else if (body.stage && body.stage !== c.stage) {
            const wasOut = OUT.includes(c.stage); const out = OUT.includes(body.stage);
            if (out && !wasOut) c.prev_stage = c.stage;
            if (out) sys.push(body.stage === 'perdido' ? `${me.name} marcou como perdido` : `${me.name} arquivou o lead`);
            else if (wasOut) sys.push(`${me.name} reativou o lead`);
            c.stage = body.stage; c.stage_changed_at = Date.now();
          }
          if (body.tags) c.tags = body.tags;
          if (body.notes !== undefined) c.notes = body.notes;
          if (body.name !== undefined) c.name = body.name || null;
          if (body.assigned_to !== undefined && body.assigned_to !== c.assigned_to) {
            const t = users.find(x => x.id === body.assigned_to);
            sys.push(t ? (t.id === me.id ? `${me.name} assumiu o atendimento` : `${me.name} transferiu para ${t.name}`) : `${me.name} devolveu para a fila`);
            c.assigned_to = body.assigned_to;
          }
          sys.forEach(s => addMsg(id, { chat_id: id, from_me: true, kind: 'system', body: s, ts: Date.now() }));
          return { chat: chatOut(c) };
        }
        if (sub === '/send' || sub === '/media' || sub === '/note') {
          const kind = sub === '/note' ? 'note' : sub === '/media' ? (body.mime.startsWith('image/') ? 'image' : 'document') : 'text';
          const msg = addMsg(id, { chat_id: id, from_me: true, kind, body: sub === '/media' ? body.caption : body.text, file_name: body.fileName || null, ts: Date.now(), author_id: me.id, status: kind === 'note' ? null : 'SERVER_ACK' });
          if (kind === 'image' && body.base64) msg._src = body.base64;
          if (kind !== 'note') {
            touch(c, msg); if (!c.first_reply_at) c.first_reply_at = Date.now();
            if (c.assigned_to == null) { c.assigned_to = me.id; addMsg(id, { chat_id: id, from_me: true, kind: 'system', body: `${me.name} assumiu o atendimento`, ts: Date.now() }); }
            if (c.stage === 'novo') c.stage = 'tratativa';
            setTimeout(() => { msg.status = 'DELIVERY_ACK'; emitMsg(id, msg); }, 900);
            setTimeout(() => { msg.status = 'READ'; emitMsg(id, msg); }, 2200);
            const replies = ['Entendi! E qual seria o valor da parcela?', 'Pode ser sábado de manhã?', 'Tenho FGTS sim, uns 18 mil.', 'Ótimo, me manda mais detalhes por favor 😊'];
            clientReply(id, replies[seq % replies.length], 4200);
          }
          emitChat(c); emitMsg(id, msg);
          return { message: clone(msg) };
        }
      }
      if (path.startsWith('/api/users')) { if (method === 'POST') { const nu = { id: users.length + 1, name: body.name, email: body.email, role: body.role, active: true }; users.push(nu); if (nu.role === 'corretor') queue.order.push(nu.id); return { user: nu }; } const uid = Number(path.split('/').pop()); const usr = users.find(x => x.id === uid); if (usr && body.active !== undefined) usr.active = body.active; return { ok: true }; }
      if (path.startsWith('/api/tags')) { if (method === 'POST') tags.push({ id: tags.length + 10, name: body.name, color: body.color }); if (method === 'DELETE') { const i = tags.findIndex(t => t.id === Number(path.split('/').pop())); if (i >= 0) tags.splice(i, 1); } return { ok: true }; }
      if (path.startsWith('/api/quick-replies')) { if (method === 'POST') qrs.push({ id: qrs.length + 10, shortcut: body.shortcut, text: body.text }); if (method === 'DELETE') { const i = qrs.findIndex(t => t.id === Number(path.split('/').pop())); if (i >= 0) qrs.splice(i, 1); } return { ok: true }; }
      if (path === '/api/logout' || path === '/api/login') return { ok: true };
      return err('Indisponível na demonstração');
    }
    return { get: (u) => handle('GET', u), post: (u, b) => handle('POST', u, b), patch: (u, b) => handle('PATCH', u, b), del: (u) => handle('DELETE', u), setMe: (id) => { me = users.find(u => u.id === id) || users[0]; } };
  }

  // ================= arranque =================
  if (DEMO) boot();
  else fetch('/api/bootstrap', { credentials: 'same-origin' }).then(r => (r.status === 401 ? showLogin() : boot())).catch(() => showLogin());
})();
