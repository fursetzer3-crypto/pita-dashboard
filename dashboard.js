/**
 * PITA Portfolio Dashboard — unified JS
 * Sidebar navigation + portfolio + chat + project views + recent conversations
 */

(function() {
  'use strict';

  // ========== CONFIG ==========
  const CONTROL_UI_BASE = 'http://127.0.0.1:18891';
  const GATEWAY_TOKEN = 'e7edc4b4d17e1f43a4b70bfedfc94714862d3c3328bf6418';

  const AGENTS = [
    { id: 'pita', name: 'PITA', icon: '🚨', type: 'main' },
    { id: 'memorykeeper', name: 'Memory Keeper', icon: '🧠', type: 'spawned' },
    { id: 'scanlite', name: 'ScanLite', icon: '🔍', type: 'spawned' },
    { id: 'knowledgescout', name: 'Knowledge Scout', icon: '🔎', type: 'spawned' },
    { id: 'correctnessauditor', name: 'Correctness Auditor', icon: '✅', type: 'spawned' },
    { id: 'orchestrationplanner', name: 'Orchestration Planner', icon: '📋', type: 'spawned' },
    { id: 'chatreader', name: 'Chat Reader', icon: '📖', type: 'spawned' },
    { id: 'openclawconnectivity', name: 'Connectivity', icon: '🔗', type: 'spawned' }
  ];

  // ========== PORTFOLIO DATA ==========
  const PORTFOLIO = {
    joseph: {
      label: 'Joseph — Individual', cash: 0.65,
      holdings: [
        { ticker: 'ACHV', shares: 681 }, { ticker: 'TYGO', shares: 611 },
        { ticker: 'VELO', shares: 14 }, { ticker: 'ONDS', shares: 114 },
        { ticker: 'NOK', shares: 34 }, { ticker: 'FRVO', shares: 0, isNew: true },
        { ticker: 'BXDC', shares: 0, isNew: true }, { ticker: 'DNN', shares: 0, isNew: true },
        { ticker: 'WOLF', shares: 0, isNew: true }, { ticker: 'QBTS', shares: 0, isNew: true },
        { ticker: 'QTUM', shares: 0, isNew: true }, { ticker: 'SMPIX', shares: 0, isNew: true }
      ]
    },
    tradIRA: {
      label: 'Amanda — Traditional IRA', cash: 2136,
      holdings: [
        { ticker: 'TYGO', shares: 1302 }, { ticker: 'ACHV', shares: 857 },
        { ticker: 'DNN', shares: 500 }, { ticker: 'ONDS', shares: 188 },
        { ticker: 'URG', shares: 650, sold: true }
      ]
    },
    rothIRA: {
      label: 'Amanda — Roth IRA', cash: 1544,
      holdings: [
        { ticker: 'SMPIX', shares: 36 }, { ticker: 'ACHV', shares: 519 },
        { ticker: 'TYGO', shares: 639 }, { ticker: 'QTUM', shares: 15 },
        { ticker: 'ONDS', shares: 146 }, { ticker: 'QBTS', shares: 50 }
      ]
    }
  };

  const WOLF_KILLER = {
    'FRVO': { label: 'WOLFSPEED', cls: 'wk-wolfspeed' },
    'BXDC': { label: '?', cls: 'wk-unknown' },
    'ONDS': { label: 'TRADE', cls: 'wk-trade' },
    'QBTS': { label: '?', cls: 'wk-unknown' },
    'TYGO': { label: 'SURVIVABLE', cls: 'wk-survivable' },
    'ACHV': { label: 'VALID SPEC', cls: 'wk-valid-spec' },
    'DNN': { label: 'SURVIVABLE', cls: 'wk-survivable' },
    'URG': { label: 'SOLD', cls: 'wk-sold' },
    'WOLF': { label: 'WOLFSPEED', cls: 'wk-wolfspeed' },
    'VELO': { label: '?', cls: 'wk-unknown' },
    'NOK': { label: '?', cls: 'wk-unknown' },
    'QTUM': { label: '?', cls: 'wk-unknown' },
    'SMPIX': { label: '?', cls: 'wk-unknown' }
  };

  const ALL_TICKERS = ['FRVO','BXDC','ONDS','TYGO','ACHV','DNN','WOLF','VELO','NOK','QBTS','QTUM','SMPIX','URG'];

  // ========== STATE ==========
  let prices = {};
  let priceChanges = {};
  let conversations = {};  // {folderId: [{role,text,time}]}
  let activeView = 'portfolio';
  let activeProject = null;
  let priceTimer = null;
  let clockTimer = null;
  let secondsUntilRefresh = 60;

  // ========== INIT ==========
  function init() {
    loadConversations();
    renderAgentFolders();
    bindEvents();
    updateClock();
    clockTimer = setInterval(updateClock, 10000);
    fetchLivePrices();
    priceTimer = setInterval(refreshTick, 1000);
    checkGateway();
    addJournal('IDEA', 'Dashboard loaded');
    updateRecentCount();
  }

  // ========== SIDEBAR ==========
  function renderAgentFolders() {
    const group = document.getElementById('agentGroup');
    if (!group) return;
    group.innerHTML = AGENTS.filter(a => a.type !== 'main').map(a =>
      `<div class="folder" data-view="agent-${a.id}"><span class="folder-icon">${a.icon}</span><span>${a.name}</span></div>`
    ).join('');
    // Re-bind agent folders
    group.querySelectorAll('.folder').forEach(f => {
      f.addEventListener('click', () => switchView(f.dataset.view));
    });
  }

  function bindEvents() {
    // Sidebar navigation
    document.querySelectorAll('.folder[data-view]').forEach(f => {
      f.addEventListener('click', () => switchView(f.dataset.view));
    });

    // Agents toggle
    const toggle = document.getElementById('agentsToggle');
    const group = document.getElementById('agentGroup');
    if (toggle && group) {
      toggle.addEventListener('click', () => {
        group.style.display = group.style.display === 'none' ? 'block' : 'none';
      });
    }

    // Chat send
    const sendBtn = document.getElementById('sendChatBtn');
    const chatInput = document.getElementById('chatInput');
    if (sendBtn && chatInput) {
      sendBtn.addEventListener('click', () => sendChat());
      chatInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
      });
    }

    // Project send
    const projBtn = document.getElementById('sendProjectBtn');
    const projInput = document.getElementById('projectInput');
    if (projBtn && projInput) {
      projBtn.addEventListener('click', () => sendProject());
      projInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendProject(); }
      });
    }

    // Keyboard: Ctrl+F for search
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        // Simple inline search - jump to portfolio view chat
        switchView('portfolio');
        const input = document.getElementById('chatInput');
        if (input) input.focus();
      }
    });
  }

  function switchView(view) {
    activeView = view;

    // Sidebar active state
    document.querySelectorAll('.folder').forEach(f => f.classList.remove('active'));
    const sb = document.querySelector(`.folder[data-view="${view}"]`);
    if (sb) sb.classList.add('active');

    // Portfolio view
    const portfolioView = document.getElementById('portfolioView');
    const projectView = document.getElementById('projectView');
    const recentView = document.getElementById('recentView');

    if (portfolioView) portfolioView.style.display = 'none';
    if (projectView) projectView.style.display = 'none';
    if (recentView) recentView.style.display = 'none';

    const projectFolders = ['maye', 'barrett', 'abby', 'business', 'ebay', 'grants'];

    if (view === 'portfolio') {
      if (portfolioView) portfolioView.style.display = 'flex';
      activeProject = null;
    } else if (view === 'recent') {
      if (recentView) recentView.style.display = 'flex';
      renderRecent();
      activeProject = null;
    } else if (projectFolders.includes(view)) {
      if (projectView) projectView.style.display = 'flex';
      activeProject = view;
      const names = { maye: 'Dawnn Maye / Her Route Inc.', barrett: 'Jennifer Barrett / Excellence Learning',
        abby: 'Abby / Nextwave Digital', business: 'Business / Drop Engines', ebay: 'eBay Sales', grants: 'Grants & Nonprofit' };
      const hdr = document.getElementById('projectHeader');
      if (hdr) hdr.innerHTML = `📁 ${names[view] || view}`;
      renderProject(view);
    } else if (view.startsWith('agent-')) {
      // Agent view - switch to portfolio with agent selected
      const agentId = view.replace('agent-', '');
      switchView('portfolio');
      const sel = document.getElementById('agentSelect');
      if (sel) sel.value = agentId;
    }
  }

  // ========== CHAT ==========
  function sendChat() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    const agent = document.getElementById('agentSelect')?.value || 'pita';
    addMsg('portfolio', 'user', text);
    input.value = '';
    // Simulate response
    setTimeout(() => {
      const agentName = AGENTS.find(a => a.id === agent)?.name || agent;
      addMsg('portfolio', 'assistant', `[${agentName}] Acknowledged. Full chat available in Control UI.`);
    }, 300);
  }

  function sendProject() {
    const input = document.getElementById('projectInput');
    if (!input || !activeProject) return;
    const text = input.value.trim();
    if (!text) return;
    addMsg(activeProject, 'user', text);
    input.value = '';
    const names = { maye: 'Maye', barrett: 'Barrett', abby: 'Abby', business: 'Business', ebay: 'eBay', grants: 'Grants' };
    setTimeout(() => addMsg(activeProject, 'assistant', `[${names[activeProject] || activeProject}] Noted: "${text}"`), 200);
  }

  function addMsg(folderId, role, text) {
    if (!conversations[folderId]) conversations[folderId] = [];
    conversations[folderId].push({ role, text, time: Date.now() });
    saveConversations();
    updateRecentCount();
    // Re-render
    if (folderId === 'portfolio') renderChatLog();
    else if (folderId === 'recent') renderRecent();
    else if (activeProject === folderId) renderProject(folderId);
  }

  function renderChatLog() {
    const log = document.getElementById('chatLog');
    if (!log) return;
    const msgs = conversations['portfolio'] || [];
    log.innerHTML = msgs.length === 0
      ? '<div class="chat-msg assistant">Dashboard ready. Chat with PITA or select an agent above.</div>'
      : msgs.slice(-50).map(m => `<div class="chat-msg ${m.role}">${esc(m.text)}</div>`).join('');
    log.scrollTop = log.scrollHeight;
  }

  function renderProject(folderId) {
    const log = document.getElementById('projectLog');
    if (!log) return;
    const msgs = conversations[folderId] || [];
    log.innerHTML = msgs.length === 0
      ? '<div class="chat-msg assistant">No messages yet. Start a conversation in this folder.</div>'
      : msgs.slice(-50).map(m => `<div class="chat-msg ${m.role}">${esc(m.text)}</div>`).join('');
    log.scrollTop = log.scrollHeight;
  }

  function renderRecent() {
    const log = document.getElementById('recentLog');
    if (!log) return;
    let all = [];
    Object.entries(conversations).forEach(([folder, msgs]) =>
      msgs.slice(-10).forEach(m => all.push({ ...m, folder }))
    );
    all.sort((a, b) => (b.time || 0) - (a.time || 0));
    all = all.slice(0, 100);
    log.innerHTML = all.length === 0
      ? '<div class="chat-msg assistant">Recent conversations will appear here.</div>'
      : all.map(m => `<div class="chat-msg ${m.role}">${esc(m.text)}<div style="font-size:10px;color:#64748b;margin-top:2px;">${folderLabel(m.folder)}</div></div>`).join('');
    log.scrollTop = log.scrollHeight;
  }

  function folderLabel(id) {
    const map = { portfolio: 'PITA Chat', recent: 'Recent', maye: 'Maye', barrett: 'Barrett', abby: 'Abby', business: 'Business', ebay: 'eBay', grants: 'Grants' };
    return map[id] || id;
  }

  function updateRecentCount() {
    let total = 0;
    Object.values(conversations).forEach(m => total += m.length);
    const el = document.getElementById('recentCount');
    if (el) el.textContent = total;
  }

  function loadConversations() {
    try { const s = localStorage.getItem('pita_portfolio_conversations'); if (s) conversations = JSON.parse(s); }
    catch(e) {}
  }
  function saveConversations() { localStorage.setItem('pita_portfolio_conversations', JSON.stringify(conversations)); }

  // ========== PORTFOLIO DISPLAY ==========
  function renderPortfolio(acct, containerId, subId) {
    const container = document.getElementById(containerId);
    const sub = document.getElementById(subId);
    if (!container) return;
    const data = PORTFOLIO[acct];
    let totalValue = data.cash;

    let html = '';
    // Group: holdings with shares, then new/watchlist
    const active = data.holdings.filter(h => h.shares > 0);
    const watch = data.holdings.filter(h => h.shares === 0);

    active.forEach(h => {
      const p = prices[h.ticker] || 0;
      const val = p * h.shares;
      totalValue += val;
      const pc = priceChanges[h.ticker];
      const chgCls = pc && pc.changePercent > 0 ? 'price-up' : pc && pc.changePercent < 0 ? 'price-down' : 'price-flat';
      const chgStr = pc ? (pc.changePercent >= 0 ? '+' : '') + pc.changePercent.toFixed(1) + '%' : '—';
      const wk = WOLF_KILLER[h.ticker];
      html += `<div class="pp-row${h.sold ? ' pp-urg-sold' : ''}">
        <span class="pp-ticker">${h.ticker}</span>
        <span class="pp-shares">${h.shares}</span>
        ${wk ? `<span class="wk-verdict ${wk.cls}" title="${wk.label}">${wk.label}</span>` : ''}
        <span class="pp-price">$${p ? p.toFixed(2) : '—'}</span>
        <span class="pp-chg ${chgCls}">${chgStr}</span>
        <span class="pp-value">$${val.toFixed(0)}</span>
      </div>`;
    });

    if (watch.length > 0) {
      html += `<div class="pp-acct-name">Watchlist</div>`;
      watch.forEach(h => {
        const p = prices[h.ticker] || 0;
        const pc = priceChanges[h.ticker];
        const chgCls = pc && pc.changePercent > 0 ? 'price-up' : pc && pc.changePercent < 0 ? 'price-down' : 'price-flat';
        const chgStr = pc ? (pc.changePercent >= 0 ? '+' : '') + pc.changePercent.toFixed(1) + '%' : '—';
        html += `<div class="pp-row">
          <span class="pp-ticker">${h.ticker}</span>
          <span class="tag-new">NEW</span>
          <span class="pp-price" style="margin-left:auto;">$${p ? p.toFixed(2) : '—'}</span>
          <span class="pp-chg ${chgCls}">${chgStr}</span>
        </div>`;
      });
    }

    html += `<div class="pp-acct-footer">Cash: <strong>$${data.cash.toLocaleString()}</strong> &nbsp;|&nbsp; Est. Total: <strong>$${totalValue.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:0})}</strong></div>`;
    container.innerHTML = html;
    if (sub) sub.textContent = `$${totalValue.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:0})}`;
    return totalValue;
  }

  function updateAllPortfolios() {
    const jv = renderPortfolio('joseph', 'portfolioJoseph', 'josephSub');
    const tv = renderPortfolio('tradIRA', 'portfolioTradIRA', 'tradSub');
    const rv = renderPortfolio('rothIRA', 'portfolioRothIRA', 'rothSub');
    const total = (jv || 0) + (tv || 0) + (rv || 0);
    const tvEl = document.getElementById('totalValue');
    const jvEl = document.getElementById('josephValue');
    const avEl = document.getElementById('amandaValue');
    if (tvEl) tvEl.textContent = '$' + total.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:0});
    if (jvEl) jvEl.textContent = '$' + (jv || 0).toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:0});
    if (avEl) avEl.textContent = '$' + ((tv || 0) + (rv || 0)).toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:0});
  }

  function updateWatchlist() {
    const container = document.getElementById('watchlistAll');
    if (!container) return;
    const tickers = new Set();
    Object.values(PORTFOLIO).forEach(acct => acct.holdings.forEach(h => tickers.add(h.ticker)));
    let liveCount = 0;
    let html = '';
    [...tickers].sort().forEach(t => {
      const p = prices[t];
      if (p > 0) liveCount++;
      const pc = priceChanges[t];
      const chgCls = pc && pc.changePercent > 0 ? 'price-up' : pc && pc.changePercent < 0 ? 'price-down' : 'price-flat';
      const chgStr = pc ? (pc.changePercent >= 0 ? '+' : '') + pc.changePercent.toFixed(1) + '%' : '—';
      html += `<div class="vw-row">
        <span class="vw-ticker">${t}</span>
        <span class="vw-price">$${p ? p.toFixed(2) : '—'}</span>
        <span class="vw-chg ${chgCls}">${chgStr}</span>
      </div>`;
    });
    container.innerHTML = html;
    const pcEl = document.getElementById('priceCount');
    if (pcEl) pcEl.textContent = `${liveCount}/${tickers.size} live`;
  }

  // ========== YAHOO FINANCE ==========
  async function fetchYahooPrice(ticker) {
    try {
      const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) return null;
      const d = await r.json();
      const result = d?.chart?.result?.[0];
      if (!result) return null;
      const meta = result.meta;
      const price = meta?.regularMarketPrice;
      const prev = meta?.chartPreviousClose || meta?.previousClose;
      if (!price || price <= 0) return null;
      let change, changePercent;
      if (prev && prev > 0) {
        change = price - prev;
        changePercent = ((price - prev) / prev) * 100;
      }
      return { ticker, price, change, changePercent };
    } catch(e) { return null; }
  }

  async function fetchLivePrices() {
    const spinner = document.getElementById('priceSpinner');
    if (spinner) spinner.classList.add('active');
    for (const ticker of ALL_TICKERS) {
      const r = await fetchYahooPrice(ticker);
      if (r && r.price > 0) {
        prices[r.ticker] = r.price;
        if (r.changePercent !== undefined) priceChanges[r.ticker] = { change: r.change, changePercent: r.changePercent };
      }
    }
    updateAllPortfolios();
    updateWatchlist();
    updateMarketStatus();
    secondsUntilRefresh = 60;
    const lr = document.getElementById('lastRefresh');
    if (lr) lr.textContent = 'Just refreshed';
    if (spinner) spinner.classList.remove('active');
  }

  function refreshTick() {
    secondsUntilRefresh--;
    if (secondsUntilRefresh <= 0) {
      fetchLivePrices();
      secondsUntilRefresh = 60;
    }
    const lr = document.getElementById('lastRefresh');
    if (lr && secondsUntilRefresh > 0) lr.textContent = `Next refresh in ${secondsUntilRefresh}s`;
  }

  function updateMarketStatus() {
    const now = new Date();
    const hour = now.getHours();
    const min = now.getMinutes();
    const day = now.getDay();
    const isWeekday = day >= 1 && day <= 5;
    const marketOpen = isWeekday && ((hour === 9 && min >= 30) || (hour >= 10 && hour < 16));
    const dot = document.getElementById('marketDot');
    const status = document.getElementById('marketStatus');
    if (dot) dot.style.background = marketOpen ? '#22c55e' : '#eab308';
    if (status) status.textContent = marketOpen ? 'Market Open' : 'Market Closed';
  }

  // ========== GATEWAY ==========
  async function checkGateway() {
    try {
      const r = await fetch(`${CONTROL_UI_BASE}/health`, { signal: AbortSignal.timeout(3000) });
      const dot = document.getElementById('gatewayHealthDot');
      const txt = document.getElementById('gatewayHealthText');
      if (r.ok) {
        if (dot) { dot.className = 'connection-dot ok'; dot.style.background = '#22c55e'; }
        if (txt) txt.textContent = 'Gateway online';
      } else {
        if (dot) dot.className = 'connection-dot warn';
        if (txt) txt.textContent = 'Gateway degraded';
      }
    } catch(e) {
      const dot = document.getElementById('gatewayHealthDot');
      if (dot) { dot.className = 'connection-dot bad'; dot.style.background = '#ef4444'; }
      const txt = document.getElementById('gatewayHealthText');
      if (txt) txt.textContent = 'Gateway unreachable';
    }
  }

  // ========== CLOCK ==========
  function updateClock() {
    const el = document.getElementById('clockDisplay');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  // ========== JOURNAL ==========
  function addJournal(tag, text) {
    const container = document.getElementById('journalEntries');
    const countEl = document.getElementById('journalCount');
    if (!container) return;
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tagClsMap = { IDEA: 'tag id', ACTION: 'tag ac', QUESTION: 'tag q', BUG: 'tag b', DECISION: 'tag id' };
    const tagCls = tagClsMap[tag] || 'tag id';
    const entry = document.createElement('div');
    entry.className = 'j-entry';
    entry.innerHTML = `<span class="t">${time}</span><span class="${tagCls}">${tag}</span><span class="txt">${esc(text)}</span>`;
    container.insertBefore(entry, container.firstChild);
    // Keep max 50 entries displayed
    while (container.children.length > 50) container.removeChild(container.lastChild);
    if (countEl) countEl.textContent = `${container.children.length} events`;
  }

  // ========== HELPERS ==========
  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  // ========== BOOT ==========
  document.addEventListener('DOMContentLoaded', init);
})();
