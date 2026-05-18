/**
 * PITA Dashboard v2 - Sidebar folder navigation, project views, recent conversations
 */
class PitaDashboard {
    constructor() {
        this.agentConfigs = [];
        this.conversations = {};        // {folderId: [{role, text, time}]}
        this.activeFolder = 'pita';
        this.settings = {
            autoRefresh: true,
            soundNotifs: true,
            maxMessages: 50
        };
        this.init();
    }

    async init() {
        await this.loadAgentConfig();
        this.loadConversations();
        this.loadSettings();
        this.renderAgentFolders();
        this.bindEvents();
        this.showView('pita');

        if (this.settings.autoRefresh) {
            this.startAutoRefresh();
        }

        this.toast('PITA Dashboard ready', 'success');
        document.getElementById('statusDot').className = 'status-dot live';
        this.updateRecentCount();
    }

    /* ===== DATA LOADING ===== */

    async loadAgentConfig() {
        try {
            const r = await fetch('agents_config.json');
            const data = await r.json();
            this.agentConfigs = Array.isArray(data.agents) ? data.agents : [];
        } catch (e) {
            console.warn('Failed to load agent config, using defaults:', e.message);
            this.agentConfigs = [
                { id: 'pita-main', name: 'PITA (Main)', type: 'main', status: 'ACTIVE', icon: '🏠', description: 'Primary agent' },
                { id: 'scanlite', name: 'ScanLite', type: 'spawned', status: 'READY', icon: '🔍', description: 'Lightweight scanner' },
                { id: 'memorykeeper', name: 'Memory Keeper', type: 'spawned', status: 'READY', icon: '🧠', description: 'Memory and context' },
                { id: 'knowledgescout', name: 'Knowledge Scout', type: 'spawned', status: 'READY', icon: '🔎', description: 'Vault search' },
                { id: 'correctnessauditor', name: 'Correctness Auditor', type: 'spawned', status: 'READY', icon: '✅', description: 'Output verification' },
                { id: 'orchestrationplanner', name: 'Orchestration Planner', type: 'spawned', status: 'READY', icon: '📋', description: 'Resource planning' },
                { id: 'aisubscriptionmanager', name: 'AI Subscription Manager', type: 'spawned', status: 'READY', icon: '💰', description: 'Model cost optimization' },
                { id: 'chatreader', name: 'Chat Reader', type: 'spawned', status: 'READY', icon: '📖', description: 'Chat history analysis' },
                { id: 'openclawconnectivity', name: 'Connectivity', type: 'spawned', status: 'READY', icon: '🔗', description: 'Connection diagnostics' },
                { id: 'duplicatecleanup', name: 'Duplicate Cleanup', type: 'spawned', status: 'QUEUED', icon: '🧹', description: 'File deduplication' },
                { id: 'subscriptionaudit', name: 'Subscription Audit', type: 'spawned', status: 'QUEUED', icon: '📊', description: 'Subscription tracking' }
            ];
        }
    }

    loadConversations() {
        try {
            const stored = localStorage.getItem('pita_dashboard_conversations');
            this.conversations = stored ? JSON.parse(stored) : {};
            // Ensure all project folders exist
            const folders = ['pita', 'recent', 'maye', 'barrett', 'abby', 'business', 'ebay', 'grants'];
            folders.forEach(f => { if (!this.conversations[f]) this.conversations[f] = []; });
            // Ensure agent folders
            this.agentConfigs.forEach(a => {
                if (!this.conversations[a.id]) this.conversations[a.id] = [];
            });
        } catch (e) {
            this.conversations = {};
        }
    }

    saveConversations() {
        localStorage.setItem('pita_dashboard_conversations', JSON.stringify(this.conversations));
    }

    loadSettings() {
        try {
            const s = localStorage.getItem('pita_dashboard_settings');
            if (s) this.settings = { ...this.settings, ...JSON.parse(s) };
        } catch (e) {}
        // Apply
        const ar = document.getElementById('autoRefresh');
        const sn = document.getElementById('soundNotifs');
        const mm = document.getElementById('maxMessages');
        if (ar) ar.checked = this.settings.autoRefresh;
        if (sn) sn.checked = this.settings.soundNotifs;
        if (mm) mm.value = this.settings.maxMessages;
    }

    saveSettings() {
        this.settings.autoRefresh = document.getElementById('autoRefresh')?.checked ?? true;
        this.settings.soundNotifs = document.getElementById('soundNotifs')?.checked ?? true;
        this.settings.maxMessages = parseInt(document.getElementById('maxMessages')?.value) || 50;
        localStorage.setItem('pita_dashboard_settings', JSON.stringify(this.settings));
    }

    /* ===== RENDERING ===== */

    renderAgentFolders() {
        const group = document.getElementById('agentsGroup');
        if (!group) return;
        group.innerHTML = this.agentConfigs
            .filter(a => a.type !== 'main')
            .map(a => `
                <div class="folder" data-folder="${a.id}" data-agent-id="${a.id}">
                    <span class="folder-icon">${a.icon || '🤖'}</span>
                    <span>${a.name}</span>
                    <span class="status-dot" style="background:${this.statusColor(a.status)}"></span>
                </div>
            `).join('');

        // Provider badge
        const badge = document.getElementById('providerBadge');
        if (badge) badge.textContent = 'DeepSeek V4';
    }

    statusColor(status) {
        const map = {
            'ACTIVE': 'var(--status-active)',
            'RUNNING': 'var(--status-running)',
            'COMPLETE': 'var(--status-complete)',
            'READY': 'var(--status-ready)',
            'QUEUED': 'var(--status-queued)',
            'ERROR': 'var(--status-error)',
            'WAITING': 'var(--status-waiting)'
        };
        return map[status] || 'var(--text-muted)';
    }

    /* ===== VIEW SWITCHING ===== */

    showView(folderId) {
        // Hide all views
        document.querySelectorAll('.folder-view').forEach(v => v.style.display = 'none');
        // Hide project/agent views
        ['pitaView', 'recentView', 'projectView', 'agentChatView', 'settingsView'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        // Update sidebar active
        document.querySelectorAll('.folder').forEach(f => f.classList.remove('active'));
        const sidebarEntry = document.querySelector(`.folder[data-folder="${folderId}"]`);
        if (sidebarEntry) sidebarEntry.classList.add('active');

        this.activeFolder = folderId;

        // Show the right view
        const projectFolders = ['maye', 'barrett', 'abby', 'business', 'ebay', 'grants'];
        const agentIds = this.agentConfigs.filter(a => a.type !== 'main').map(a => a.id);

        if (folderId === 'pita') {
            const v = document.getElementById('pitaView');
            if (v) v.style.display = 'flex';
            this.renderMessages('pita', 'pitaMessages');
        } else if (folderId === 'recent') {
            const v = document.getElementById('recentView');
            if (v) v.style.display = 'flex';
            this.renderRecentView();
        } else if (projectFolders.includes(folderId)) {
            const v = document.getElementById('projectView');
            if (v) v.style.display = 'flex';
            const title = document.getElementById('projectViewTitle');
            const names = { maye: 'Dawnn Maye', barrett: 'Jennifer Barrett', abby: 'Abby', business: 'Business', ebay: 'eBay', grants: 'Grants' };
            if (title) title.textContent = `📁 ${names[folderId] || folderId}`;
            this.renderMessages(folderId, 'projectMessages');
        } else if (agentIds.includes(folderId)) {
            const v = document.getElementById('agentChatView');
            if (v) v.style.display = 'flex';
            const agent = this.agentConfigs.find(a => a.id === folderId);
            if (agent) {
                const title = document.getElementById('agentChatViewTitle');
                const status = document.getElementById('agentChatStatus');
                if (title) title.textContent = `${agent.icon || '🤖'} ${agent.name}`;
                if (status) {
                    status.textContent = agent.status;
                    status.className = `status-badge status-${agent.status.toLowerCase()}`;
                }
                this.renderMessages(folderId, 'agentChatMessages');
            }
        } else if (folderId === 'settings') {
            const v = document.getElementById('settingsView');
            if (v) v.style.display = 'flex';
        }
    }

    renderMessages(folderId, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const msgs = this.conversations[folderId] || [];
        const max = this.settings.maxMessages;
        const display = msgs.slice(-max);
        container.innerHTML = display.length === 0
            ? '<div class="message system"><span>No messages yet. Start a conversation.</span></div>'
            : display.map(m => this.formatMessage(m, folderId)).join('');
        container.scrollTop = container.scrollHeight;
    }

    renderRecentView() {
        const container = document.getElementById('recentMessages');
        if (!container) return;

        // Collect recent messages across all folders
        let all = [];
        Object.entries(this.conversations).forEach(([folder, msgs]) => {
            msgs.slice(-5).forEach(m => {
                all.push({ ...m, folder });
            });
        });
        all.sort((a, b) => (b.time || 0) - (a.time || 0));
        all = all.slice(0, this.settings.maxMessages);

        container.innerHTML = all.length === 0
            ? '<div class="message system"><span>No recent conversations yet. Messages from all folders will appear here.</span></div>'
            : all.map(m => this.formatMessage(m, m.folder)).join('');
        container.scrollTop = container.scrollHeight;
    }

    formatMessage(m, folderId) {
        const timeStr = m.time ? new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const folderLabel = folderId ? this.folderLabel(folderId) : '';
        const folderTag = (m.role !== 'system' && folderLabel) 
            ? `<span class="msg-folder">${folderLabel}</span>` : '';
        return `
            <div class="message ${m.role}">
                ${folderTag}
                <span>${this.escapeHtml(m.text)}</span>
                ${timeStr ? `<span class="msg-time">${timeStr}</span>` : ''}
            </div>`;
    }

    folderLabel(id) {
        const map = {
            'pita': 'PITA', 'recent': 'Recent', 'maye': 'Maye', 'barrett': 'Barrett',
            'abby': 'Abby', 'business': 'Business', 'ebay': 'eBay', 'grants': 'Grants'
        };
        if (map[id]) return map[id];
        const agent = this.agentConfigs.find(a => a.id === id);
        return agent ? agent.name : id;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /* ===== ACTIONS ===== */

    addMessage(folderId, role, text) {
        if (!this.conversations[folderId]) this.conversations[folderId] = [];
        this.conversations[folderId].push({ role, text, time: Date.now() });
        this.saveConversations();
        this.updateRecentCount();

        // Re-render current view
        const projectFolders = ['maye', 'barrett', 'abby', 'business', 'ebay', 'grants'];
        const agentIds = this.agentConfigs.filter(a => a.type !== 'main').map(a => a.id);

        if (folderId === 'pita') this.renderMessages('pita', 'pitaMessages');
        else if (folderId === 'recent') this.renderRecentView();
        else if (projectFolders.includes(folderId)) this.renderMessages(folderId, 'projectMessages');
        else if (agentIds.includes(folderId)) this.renderMessages(folderId, 'agentChatMessages');
    }

    updateRecentCount() {
        let total = 0;
        Object.values(this.conversations).forEach(msgs => { total += msgs.length; });
        const el = document.getElementById('recentCount');
        if (el) el.textContent = total;
    }

    sendMessage(folderId, inputElId) {
        const input = document.getElementById(inputElId);
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;

        this.addMessage(folderId, 'user', text);
        input.value = '';

        // Simulate/route response
        if (folderId === 'pita') {
            this.addMessage(folderId, 'assistant', `[PITA] Acknowledged: "${text}" — routing to agents as needed.`);
        } else {
            const agent = this.agentConfigs.find(a => a.id === folderId);
            if (agent) {
                this.addMessage(folderId, 'assistant', `[${agent.name}] Received: "${text}"`);
            } else {
                const names = { maye: 'Maye', barrett: 'Barrett', abby: 'Abby', business: 'Business', ebay: 'eBay', grants: 'Grants' };
                const label = names[folderId] || folderId;
                this.addMessage(folderId, 'assistant', `[${label}] Noted: "${text}"`);
            }
        }

        if (this.settings.soundNotifs) this.beep();
    }

    beep() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 800;
            gain.gain.value = 0.05;
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } catch (e) {}
    }

    /* ===== EVENTS ===== */

    bindEvents() {
        // Sidebar folder clicks
        document.querySelectorAll('.folder[data-folder]').forEach(f => {
            f.addEventListener('click', () => {
                const id = f.dataset.folder;
                if (id) this.showView(id);
            });
        });

        // Agents group toggle
        const toggle = document.getElementById('agentsGroupToggle');
        const group = document.getElementById('agentsGroup');
        if (toggle && group) {
            toggle.addEventListener('click', () => {
                group.style.display = group.style.display === 'none' ? 'block' : 'none';
            });
        }

        // PITA send
        const pitaBtn = document.getElementById('pitaSendBtn');
        const pitaInput = document.getElementById('pitaInput');
        if (pitaBtn) pitaBtn.addEventListener('click', () => this.sendMessage('pita', 'pitaInput'));
        if (pitaInput) pitaInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage('pita', 'pitaInput'); }
        });

        // Project send
        const projBtn = document.getElementById('projectSendBtn');
        const projInput = document.getElementById('projectInput');
        if (projBtn) projBtn.addEventListener('click', () => this.sendMessage(this.activeFolder, 'projectInput'));
        if (projInput) projInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(this.activeFolder, 'projectInput'); }
        });

        // Agent chat send
        const agentBtn = document.getElementById('agentChatSendBtn');
        const agentInput = document.getElementById('agentChatInput');
        if (agentBtn) agentBtn.addEventListener('click', () => this.sendMessage(this.activeFolder, 'agentChatInput'));
        if (agentInput) agentInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(this.activeFolder, 'agentChatInput'); }
        });

        // Settings
        document.getElementById('autoRefresh')?.addEventListener('change', () => this.saveSettings());
        document.getElementById('soundNotifs')?.addEventListener('change', () => this.saveSettings());
        document.getElementById('maxMessages')?.addEventListener('change', () => {
            this.saveSettings();
            this.showView(this.activeFolder);
        });

        // Export
        document.getElementById('exportAllBtn')?.addEventListener('click', () => this.exportAll());

        // Clear
        document.getElementById('clearAllBtn')?.addEventListener('click', () => {
            if (confirm('Delete ALL conversations? This cannot be undone.')) {
                this.conversations = {};
                this.saveConversations();
                this.updateRecentCount();
                this.showView(this.activeFolder);
                this.toast('All conversations cleared', 'warn');
            }
        });

        document.getElementById('clearRecentBtn')?.addEventListener('click', () => {
            this.conversations = {};
            this.saveConversations();
            this.updateRecentCount();
            this.showView('recent');
            this.toast('Recent conversations cleared', 'warn');
        });

        // Search (Ctrl+F)
        document.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                this.openSearch();
            }
        });
        document.getElementById('closeSearchBtn')?.addEventListener('click', () => this.closeSearch());
        document.getElementById('searchInput')?.addEventListener('input', () => this.performSearch());
    }

    /* ===== SEARCH ===== */

    openSearch() {
        const overlay = document.getElementById('searchOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            document.getElementById('searchInput')?.focus();
        }
    }

    closeSearch() {
        const overlay = document.getElementById('searchOverlay');
        if (overlay) overlay.style.display = 'none';
    }

    performSearch() {
        const input = document.getElementById('searchInput');
        const results = document.getElementById('searchResults');
        if (!input || !results) return;

        const q = input.value.toLowerCase().trim();
        if (q.length < 2) { results.innerHTML = ''; return; }

        let hits = [];
        Object.entries(this.conversations).forEach(([folder, msgs]) => {
            msgs.forEach((m, i) => {
                if (m.text.toLowerCase().includes(q)) {
                    hits.push({ folder, text: m.text, idx: i, time: m.time, label: this.folderLabel(folder) });
                }
            });
        });

        hits.sort((a, b) => (b.time || 0) - (a.time || 0));
        hits = hits.slice(0, 30);

        results.innerHTML = hits.length === 0
            ? '<div class="search-result" style="text-align:center;color:var(--text-muted)">No results</div>'
            : hits.map(h => `
                <div class="search-result" data-folder="${h.folder}">
                    <span class="sr-folder">${h.label}</span>
                    <div class="sr-text">${this.escapeHtml(h.text.substring(0, 150))}</div>
                </div>
            `).join('');

        results.querySelectorAll('.search-result[data-folder]').forEach(el => {
            el.addEventListener('click', () => {
                this.closeSearch();
                this.showView(el.dataset.folder);
            });
        });
    }

    /* ===== EXPORT ===== */

    exportAll() {
        const data = JSON.stringify(this.conversations, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pita_conversations_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.toast('All conversations exported', 'success');
    }

    /* ===== AUTO-REFRESH ===== */

    startAutoRefresh() {
        if (this._refreshInterval) clearInterval(this._refreshInterval);
        this._refreshInterval = setInterval(() => this.refreshStatus(), 5000);
    }

    async refreshStatus() {
        // In live mode, would hit /api/agents. For now, keep agent states as-is.
        // Update status dot
        const dot = document.getElementById('statusDot');
        if (dot) dot.className = 'status-dot live';
    }

    /* ===== TOAST ===== */

    toast(text, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.textContent = text;
        container.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
    }
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
    window.pitaDashboard = new PitaDashboard();
});
