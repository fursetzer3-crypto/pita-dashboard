/**
 * OpenClaw Agent Dashboard
 * Main interactivity and state management
 */

class AgentDashboard {
    constructor() {
        this.agents = [];
        this.agentsConfig = {};
        this.currentAgent = null;
        this.conversations = {};
        this.activeFilters = [];
        this.autoRefreshInterval = null;
        this.refreshTasks = new Map();
        this.settings = {
            autoRefresh: true,
            soundNotifs: true,
            maxMessages: 50
        };
        this.openClawLive = false;
        this.liveAgentIds = new Set();
        this.providerStrategy = [];
        this.providerStatus = null;
        this.providerAutoSelected = false;
        this.nextRefreshAt = null;
        this.statusBarTimer = null;
        
        this.init();
    }

    async init() {
        await this.loadConfig();
        this.initializeAgents();
        this.loadSettings();
        this.loadConversations();
        this.loadRefreshTasks();
        this.setupEventListeners();
        this.renderAgentsList();
        this.setupKeyboardShortcuts();
        
        if (this.settings.autoRefresh) {
            this.startAutoRefresh();
        }
        
        this.showToast('Dashboard initialized', 'success');
    }

    /**
     * Load agent configuration
     */
    async loadConfig() {
        try {
            const response = await fetch('agents_config.json');
            this.agentsConfig = await response.json();
            this.agents = Array.isArray(this.agentsConfig.agents) ? this.agentsConfig.agents : [];
            this.providerStrategy = Array.isArray(this.agentsConfig.providerStrategy)
                ? this.agentsConfig.providerStrategy
                : this.defaultProviderStrategy();
            this.ensureRefreshAgent();
            await this.loadLiveState();
            await this.loadProviderStatus();
            this.renderProviderStrategy();
            this.updateStatusBar();
        } catch (error) {
            console.error('Failed to load config:', error);
            this.agents = this.agents || [];
            this.showToast('Failed to load agent configuration; using dashboard fallback', 'error');
        }
    }

    /**
     * Load live OpenClaw agent state from API
     */
    async loadLiveState() {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
            const response = await fetch('/api/agents', { signal: controller.signal });
            if (!response.ok) {
                throw new Error(`API status ${response.status}`);
            }
            const payload = await response.json();
            const liveAgents = this.normalizeLiveAgentPayload(payload);
            if (!Array.isArray(liveAgents)) {
                throw new Error('Invalid OpenClaw agent payload');
            }
            this.liveAgentIds = new Set(liveAgents.map(agent => agent.id));
            this.openClawLive = true;
            this.mergeLiveAgents(liveAgents);
            this.showToast('Live OpenClaw agent state loaded', 'success');
        } catch (error) {
            console.warn('Live OpenClaw state unavailable:', error);
            this.openClawLive = false;
            this.applyFallbackAgentState();
            this.showToast('Live OpenClaw unavailable; using dashboard-created agents', 'warn');
        } finally {
            clearTimeout(timeout);
        }
    }

    normalizeLiveAgentPayload(payload) {
        if (Array.isArray(payload)) {
            return payload;
        }
        if (payload && Array.isArray(payload.agents)) {
            return payload.agents;
        }
        if (payload && Array.isArray(payload.data)) {
            return payload.data;
        }
        return [];
    }

    defaultProviderStrategy() {
        return [
            {
                id: 'gemini',
                name: 'Gemini',
                type: 'free-first',
                description: 'Prefer Gemini mini first for lower-cost or free access.',
                preferredModels: ['gemini-mini']
            },
            {
                id: 'openai',
                name: 'ChatGPT / OpenAI',
                type: 'cheap-paid',
                description: 'Use OpenAI 3.5 first, avoiding 4.x models unless necessary.',
                preferredModels: ['gpt-3.5-turbo']
            },
            {
                id: 'claude',
                name: 'Claude (Anthropic)',
                type: 'paid',
                description: 'Use Claude haiku 3.5 if cheaper providers are unavailable.',
                preferredModels: ['claude-haiku-3-5']
            },
            {
                id: 'anthropic',
                name: 'Anthropic API',
                type: 'paid',
                description: 'Fallback to Anthropic haiku 3.5 only after the above providers are exhausted.',
                preferredModels: ['claude-3.5-haiku-latest']
            }
        ];
    }

    ensureRefreshAgent() {
        const existing = this.agents.find(agent => agent.id === 'refresh-agent');
        if (!existing) {
            this.agents.unshift({
                id: 'refresh-agent',
                name: 'Refresh Agent',
                type: 'spawned',
                status: 'READY',
                progress: 0,
                description: 'Automatically retries waiting API calls and refreshes provider selection after cooldowns.',
                icon: '⏳',
                priority: 15
            });
        } else {
            existing.type = 'spawned';
            existing.description = existing.description || 'Automatically retries waiting API calls.';
            existing.progress = typeof existing.progress === 'number' ? existing.progress : 0;
            existing.priority = 15;
        }
        this.prioritizeSubscriptionAgent();
    }

    getProviderModeLabel() {
        if (!this.providerStatus) {
            return 'unknown';
        }
        if (this.providerStatus.fallback) {
            return 'fallback';
        }
        if (this.providerStatus.recommendedPaid && this.providerStatus.modelsStatus?.resolvedDefault === this.providerStatus.recommendedPaid) {
            return 'max-paid';
        }
        if (this.providerStatus.recommended && this.providerStatus.modelsStatus?.resolvedDefault === this.providerStatus.recommended) {
            return 'cheap-first';
        }
        return 'custom';
    }

    renderProviderStrategy() {
        const container = document.getElementById('providerStrategyList');
        if (!container) return;

        const liveStatus = this.providerStatus?.fallback
            ? 'LOCAL MODE (OpenClaw unavailable)'
            : this.openClawLive
                ? 'LIVE MODE'
                : 'FALLBACK MODE';
        const providerMode = this.getProviderModeLabel();

        const statusHtml = this.providerStatus ? `
            <div class="provider-status-summary">
                <div class="provider-status-line"><strong>Mode:</strong> ${liveStatus}</div>
                <div class="provider-status-line"><strong>Strategy active:</strong> ${providerMode}</div>
                <div class="provider-status-line"><strong>Current model:</strong> ${this.providerStatus.modelsStatus?.defaultModel || 'unknown'}</div>
                <div class="provider-status-line"><strong>Resolved model:</strong> ${this.providerStatus.modelsStatus?.resolvedDefault || 'unknown'}</div>
                <div class="provider-status-line"><strong>Recommended (cheap-first):</strong> ${this.providerStatus.recommended || 'none available'}</div>
                <div class="provider-status-line"><strong>Recommended (max-paid):</strong> ${this.providerStatus.recommendedPaid || 'none available'}</div>
                <div class="provider-action-row">
                    <button id="applyProviderSelectionBtn" class="provider-action-btn">Optimize provider selection</button>
                    <button id="maxPaidProviderSelectionBtn" class="provider-action-btn secondary">Maximize paid model</button>
                </div>
            </div>
        ` : '<div class="provider-status-summary">Provider status unavailable.</div>';

        const strategyHtml = this.providerStrategy.map(provider => `
            <div class="provider-item">
                <div class="provider-name">${provider.name}</div>
                <div class="provider-desc">${provider.description}</div>
                <div class="provider-models">Preferred: ${provider.preferredModels.join(', ')}</div>
            </div>
        `).join('');

        container.innerHTML = statusHtml + strategyHtml;
        const button = document.getElementById('applyProviderSelectionBtn');
        if (button) {
            button.addEventListener('click', () => this.applyProviderSelection());
        }
        const maxPaidButton = document.getElementById('maxPaidProviderSelectionBtn');
        if (maxPaidButton) {
            maxPaidButton.addEventListener('click', () => this.applyProviderSelection({ strategy: 'max-paid' }));
        }
    }

    scheduleRefreshTask(agentId, seconds, payloadText, reason) {
        const taskKey = `${agentId}:${Date.now()}`;
        const task = {
            agentId,
            retryAfter: seconds,
            payloadText,
            reason: reason || 'rate-limit',
            retries: 0,
            startedAt: Date.now()
        };
        this.refreshTasks.set(taskKey, task);
        this.saveRefreshTasks();

        const refreshAgent = this.agents.find(agent => agent.id === 'refresh-agent');
        if (refreshAgent) {
            refreshAgent.status = 'WAITING';
            refreshAgent.progress = 0;
            refreshAgent.description = `Waiting ${seconds}s to retry ${agentId} (${reason || 'rate-limit'})`;
            this.renderAgentsList();
        }

        setTimeout(() => this.executeRefreshTask(taskKey), seconds * 1000);
        this.showToast(`Refresh Agent scheduled retry in ${seconds}s`, 'info');
    }

    async executeRefreshTask(taskKey) {
        const task = this.refreshTasks.get(taskKey);
        if (!task) return;

        this.refreshTasks.delete(taskKey);
        this.saveRefreshTasks();
        const refreshAgent = this.agents.find(agent => agent.id === 'refresh-agent');
        if (refreshAgent) {
            refreshAgent.status = 'RUNNING';
            refreshAgent.description = `Retrying ${task.agentId} now...`;
            this.renderAgentsList();
        }

        if (!this.openClawLive) {
            await this.refreshAgentStatus();
            if (refreshAgent) {
                refreshAgent.status = 'READY';
                refreshAgent.description = 'Refresh completed after wait.';
                this.renderAgentsList();
            }
            return;
        }

        const targetAgent = this.agents.find(agent => agent.id === task.agentId);
        if (!targetAgent) {
            if (refreshAgent) {
                refreshAgent.status = 'ERROR';
                refreshAgent.description = `Agent ${task.agentId} not found.`;
                this.renderAgentsList();
            }
            return;
        }

        const result = await this.sendLiveAgentMessage(task.agentId, task.payloadText);
        if (result.providerIssue) {
            const handled = await this.handleProviderIssue(result.providerIssue, task.payloadText, task.agentId);
            if (handled) {
                if (refreshAgent) {
                    refreshAgent.status = 'WAITING';
                    refreshAgent.description = 'Provider issue detected; retry queued after optimization.';
                    this.renderAgentsList();
                }
                return;
            }
        }

        if (result.retryAfter) {
            const retrySeconds = Math.max(5, result.retryAfter);
            this.scheduleRefreshTask(task.agentId, retrySeconds, task.payloadText, 'retry-after');
            if (refreshAgent) {
                refreshAgent.description = `Next retry in ${retrySeconds}s due to rate limit.`;
                this.renderAgentsList();
            }
            return;
        }

        if (!result.success) {
            const fallbackDelay = 10;
            this.scheduleRefreshTask(task.agentId, fallbackDelay, task.payloadText, 'retry-fallback');
            if (refreshAgent) {
                refreshAgent.status = 'WAITING';
                refreshAgent.description = `Retry failed; scheduling another attempt in ${fallbackDelay}s.`;
                this.renderAgentsList();
            }
            return;
        }

        if (result.success) {
            if (!this.conversations[task.agentId]) {
                this.conversations[task.agentId] = [];
            }
            this.conversations[task.agentId].push({
                type: 'agent',
                text: `Auto-retry response: ${result.reply}`,
                timestamp: new Date().toISOString()
            });
            this.saveConversations();
        }

        if (refreshAgent) {
            refreshAgent.status = 'COMPLETE';
            refreshAgent.description = 'Last retry succeeded.';
            refreshAgent.progress = 100;
            this.renderAgentsList();
        }
    }

    prioritizeSubscriptionAgent() {
        this.agents.sort((a, b) => {
            const aPriority = typeof a.priority === 'number' ? a.priority : 0;
            const bPriority = typeof b.priority === 'number' ? b.priority : 0;
            if (aPriority !== bPriority) return bPriority - aPriority;
            return a.name.localeCompare(b.name);
        });
    }
    mergeLiveAgents(liveAgents) {
        const configById = new Map(this.agents.map(agent => [agent.id, agent]));
        const mergedAgents = [];

        liveAgents.forEach(liveAgent => {
            if (configById.has(liveAgent.id)) {
                const agent = configById.get(liveAgent.id);
                agent.status = 'ACTIVE';
                agent.type = 'live';
                mergedAgents.push(agent);
                configById.delete(liveAgent.id);
            } else if (liveAgent.id === 'main') {
                // Keep existing PITA agent as the main live agent
                const pita = this.agents.find(a => a.id === 'pita-main');
                if (pita) {
                    pita.status = 'ACTIVE';
                    pita.type = 'live';
                    mergedAgents.push(pita);
                } else {
                    mergedAgents.push({
                        id: 'main',
                        name: 'Main OpenClaw Agent',
                        type: 'live',
                        status: 'ACTIVE',
                        description: 'OpenClaw main agent',
                        icon: '🤖'
                    });
                }
            } else {
                mergedAgents.push({
                    id: liveAgent.id,
                    name: liveAgent.id,
                    type: 'live',
                    status: 'ACTIVE',
                    description: 'Live OpenClaw agent',
                    icon: '🤖'
                });
            }
        });

        // Keep any config-only agents that were not present in live state
        configById.forEach(agent => mergedAgents.push(agent));
        this.agents = mergedAgents;
    }

    /**
     * Return whether an agent ID represents a live OpenClaw agent
     */
    isLiveAgent(agentId) {
        return agentId === 'pita-main' || this.liveAgentIds.has(agentId);
    }

    applyFallbackAgentState() {
        this.agents = this.agents.map((agent, index) => ({
            ...agent,
            status: agent.status === 'COMPLETE' ? 'COMPLETE' : 'RUNNING',
            progress: typeof agent.progress === 'number' ? agent.progress : Math.min(100, 15 + index * 5),
            type: 'spawned'
        }));
        this.renderAgentsList();
    }

    initializeAgents() {
        this.agents = this.agents.map((agent, index) => ({
            ...agent,
            type: agent.type || 'spawned',
            status: agent.status || 'RUNNING',
            progress: typeof agent.progress === 'number' ? agent.progress : Math.min(100, 10 + index * 5),
            description: agent.description || 'No description available',
            icon: agent.icon || '🤖'
        }));
    }

    /**
     * Send a live message to an OpenClaw agent through the API
     */
    async sendLiveAgentMessage(agentId, text) {
        const cliAgentId = agentId === 'pita-main' ? 'main' : agentId;
        try {
            const response = await fetch(`/api/agents/${encodeURIComponent(cliAgentId)}/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: text })
            });

            const payload = await response.json().catch(() => ({}));
            const retryAfter = typeof payload.retryAfter === 'number' ? payload.retryAfter : null;
            const providerIssue = typeof payload.providerIssue === 'string' ? payload.providerIssue : null;
            if (!response.ok) {
                return {
                    success: false,
                    error: payload.error || response.statusText,
                    retryAfter,
                    providerIssue,
                    reply: payload.reply || payload.output || payload.message || JSON.stringify(payload),
                    payload
                };
            }

            return {
                success: true,
                reply: payload.reply || payload.output || payload.message || JSON.stringify(payload),
                retryAfter,
                payload,
                providerIssue
            };
        } catch (error) {
            console.error('Live agent send failed:', error);
            return {
                success: false,
                error: error.message,
                retryAfter: null,
                providerIssue: null,
                reply: `Live send failed: ${error.message}`
            };
        }
    }

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        const saved = localStorage.getItem('dashboardSettings');
        if (saved) {
            this.settings = JSON.parse(saved);
            document.getElementById('autoRefresh').checked = this.settings.autoRefresh;
            document.getElementById('soundNotifs').checked = this.settings.soundNotifs;
            document.getElementById('maxMessages').value = this.settings.maxMessages;
        }
    }

    /**
     * Load conversations from localStorage
     */
    loadConversations() {
        const saved = localStorage.getItem('conversations');
        if (saved) {
            this.conversations = JSON.parse(saved);
        } else {
            // Initialize empty conversations for each agent
            this.agents.forEach(agent => {
                this.conversations[agent.id] = [];
            });
        }
    }

    /**
     * Save conversations to localStorage
     */
    saveConversations() {
        localStorage.setItem('conversations', JSON.stringify(this.conversations));
    }

    /**
     * Load refresh task queue from localStorage
     */
    loadRefreshTasks() {
        const saved = localStorage.getItem('refreshTasks');
        if (!saved) {
            return;
        }
        try {
            const tasks = JSON.parse(saved);
            if (Array.isArray(tasks)) {
                tasks.forEach(task => {
                    const taskKey = `${task.agentId}:${task.startedAt}`;
                    this.refreshTasks.set(taskKey, task);
                    const delayMs = Math.max(0, (task.retryAfter * 1000) - (Date.now() - task.startedAt));
                    if (delayMs > 0) {
                        setTimeout(() => this.executeRefreshTask(taskKey), delayMs);
                    } else {
                        this.executeRefreshTask(taskKey);
                    }
                });
            }
        } catch (error) {
            console.warn('Failed to load refresh tasks:', error);
            this.refreshTasks.clear();
        }
    }

    /**
     * Save refresh task queue to localStorage
     */
    saveRefreshTasks() {
        const tasks = Array.from(this.refreshTasks.values());
        localStorage.setItem('refreshTasks', JSON.stringify(tasks));
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Header controls
        document.getElementById('searchToggle').addEventListener('click', () => this.openSearchModal());
        document.getElementById('settingsToggle').addEventListener('click', () => this.openSettingsModal());
        document.getElementById('refreshBtn').addEventListener('click', () => this.refreshAgentStatus());
        
        // PITA messaging
        document.getElementById('pitaSendBtn').addEventListener('click', () => this.sendPitaMessage());
        document.getElementById('pitaInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendPitaMessage();
            }
        });

        // Broadcast command
        const broadcastInput = document.getElementById('broadcastInput');
        const broadcastBtn = document.getElementById('broadcastSendBtn');
        if (broadcastBtn && broadcastInput) {
            broadcastBtn.addEventListener('click', () => this.broadcastMessage());
            broadcastInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.broadcastMessage();
                }
            });
        }
        
        // Modal controls
        document.getElementById('closeModalBtn').addEventListener('click', () => this.closeAgentModal());
        document.getElementById('closeSearchBtn').addEventListener('click', () => this.closeSearchModal());
        document.getElementById('closeSettingsBtn').addEventListener('click', () => this.closeSettingsModal());
        
        // Agent modal messaging
        document.getElementById('agentSendBtn').addEventListener('click', () => this.sendAgentMessage());
        document.getElementById('agentInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendAgentMessage();
            }
        });
        
        // Modal buttons
        document.getElementById('exportBtn').addEventListener('click', () => this.exportAgentConversation());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearAgentHistory());
        
        // Settings
        document.getElementById('autoRefresh').addEventListener('change', (e) => {
            this.settings.autoRefresh = e.target.checked;
            this.saveSettings();
            if (e.target.checked) {
                this.startAutoRefresh();
            } else {
                this.stopAutoRefresh();
            }
        });
        
        document.getElementById('soundNotifs').addEventListener('change', (e) => {
            this.settings.soundNotifs = e.target.checked;
            this.saveSettings();
        });
        
        document.getElementById('maxMessages').addEventListener('change', (e) => {
            this.settings.maxMessages = parseInt(e.target.value);
            this.saveSettings();
        });
        
        document.getElementById('exportAllBtn').addEventListener('click', () => this.exportAllConversations());
        document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAllData());
        
        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => this.performSearch(e.target.value));
        
        // Filter toggle
        document.getElementById('filterBtn').addEventListener('click', () => this.toggleFilterPanel());
        
        // Status filters
        document.querySelectorAll('.status-filter').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.applyFilters());
        });
    }

    /**
     * Render agents list
     */
    renderAgentsList() {
        const list = document.getElementById('agentsList');
        const visibleAgents = this.agents.filter(a => {
            return (a.type === 'spawned' || a.type === 'live') && a.id !== 'pita-main' && a.id !== 'main';
        }).sort((a, b) => {
            const aPriority = typeof a.priority === 'number' ? a.priority : 0;
            const bPriority = typeof b.priority === 'number' ? b.priority : 0;
            if (aPriority !== bPriority) return bPriority - aPriority;
            return a.name.localeCompare(b.name);
        });
        
        list.innerHTML = '';
        visibleAgents.forEach((agent) => {
            const agentEl = this.createAgentElement(agent);
            list.appendChild(agentEl);
        });
        
        document.getElementById('agentCount').textContent = `${visibleAgents.length} agents`;

        if (visibleAgents.length === 0) {
            list.innerHTML = '<div class="message system">No spawned OpenClaw agents are currently available.</div>';
        }
    }

    /**
     * Create agent list item element
     */
    createAgentElement(agent) {
        const div = document.createElement('div');
        div.className = 'agent-item collapsed';
        div.setAttribute('data-agent-id', agent.id);
        
        const statusClass = `status-${agent.status.toLowerCase()}`;
        const statusBadge = `<span class="status-badge ${statusClass}">${agent.status}</span>`;
        
        let spinner = '';
        if (agent.status === 'RUNNING') {
            spinner = '<span class="spinner"></span>';
        }
        
        div.innerHTML = `
            <div class="agent-header">
                <span class="agent-name">
                    <span class="expand-icon">▶</span>
                    <span class="agent-icon">${agent.icon}</span>
                    <span>${agent.name}</span>
                </span>
                <div>${spinner} ${statusBadge}</div>
            </div>
            <div class="agent-details">
                <p class="agent-description">${agent.description}</p>
                <div class="progress-row">
                    <div class="progress-bar"><div class="progress-fill" style="width: ${agent.progress}%"></div></div>
                    <span class="progress-label">${agent.progress}%</span>
                </div>
                <div class="agent-actions">
                    <button class="agent-btn open-btn" data-agent-id="${agent.id}">Open</button>
                    <button class="agent-btn history-btn" data-agent-id="${agent.id}">History</button>
                    <button class="agent-btn close-btn danger" data-agent-id="${agent.id}">Close</button>
                </div>
            </div>
        `;
        
        // Toggle expansion
        div.querySelector('.agent-header').addEventListener('click', () => {
            div.classList.toggle('collapsed');
        });
        
        // Open agent modal
        div.querySelector('.open-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.openAgentModal(agent.id);
        });
        
        // Show history
        div.querySelector('.history-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.showToast(`Viewing history for ${agent.name}`, 'info');
        });
        
        // Close agent
        div.querySelector('.close-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Close agent "${agent.name}"?`)) {
                agent.status = 'IDLE';
                this.renderAgentsList();
                this.showToast(`${agent.name} closed`, 'success');
            }
        });
        
        return div;
    }

    /**
     * Open agent chat modal
     */
    openAgentModal(agentId) {
        const agent = this.agents.find(a => a.id === agentId);
        if (!agent) return;
        
        this.currentAgent = agent;
        
        // Update modal header
        document.getElementById('modalAgentIcon').textContent = agent.icon;
        document.getElementById('modalAgentName').textContent = agent.name;
        document.getElementById('modalAgentDesc').textContent = agent.description;
        
        const statusClass = `status-${agent.status.toLowerCase()}`;
        const statusBadge = document.getElementById('modalStatus');
        statusBadge.textContent = agent.status;
        statusBadge.className = `status-badge ${statusClass}`;
        
        // Load messages
        this.loadAgentMessages();
        
        // Show modal
        document.getElementById('agentModal').classList.add('active');
        document.getElementById('agentInput').focus();
    }

    /**
     * Close agent modal
     */
    closeAgentModal() {
        document.getElementById('agentModal').classList.remove('active');
        this.currentAgent = null;
        document.getElementById('agentInput').value = '';
    }

    /**
     * Load and display agent messages
     */
    loadAgentMessages() {
        const container = document.getElementById('agentMessages');
        const messages = this.conversations[this.currentAgent.id] || [];
        
        container.innerHTML = '';
        
        if (messages.length === 0) {
            container.innerHTML = '<div class="message system">No messages yet. Start a conversation!</div>';
            return;
        }
        
        // Show last N messages based on settings
        const displayMessages = messages.slice(-this.settings.maxMessages);
        displayMessages.forEach(msg => {
            const msgEl = document.createElement('div');
            msgEl.className = `message ${msg.type}`;
            msgEl.textContent = msg.text;
            container.appendChild(msgEl);
        });
        
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    /**
     * Send message to agent
     */
    async sendAgentMessage() {
        const input = document.getElementById('agentInput');
        const text = input.value.trim();
        
        if (!text || !this.currentAgent) return;
        
        if (!this.conversations[this.currentAgent.id]) {
            this.conversations[this.currentAgent.id] = [];
        }
        
        this.conversations[this.currentAgent.id].push({
            type: 'user',
            text: text,
            timestamp: new Date().toISOString()
        });
        
        input.value = '';
        this.loadAgentMessages();
        this.saveConversations();
        
        if (this.openClawLive && this.isLiveAgent(this.currentAgent.id)) {
            const result = await this.sendLiveAgentMessage(this.currentAgent.id, text);
            if (result.providerIssue) {
                const handled = await this.handleProviderIssue(result.providerIssue, text, this.currentAgent.id);
                if (handled) {
                    this.conversations[this.currentAgent.id].push({
                        type: 'agent',
                        text: `Detected provider issue. Queued retry after provider optimization.`,
                        timestamp: new Date().toISOString()
                    });
                    this.loadAgentMessages();
                    this.saveConversations();
                    return;
                }
            }
            if (result.retryAfter) {
                this.scheduleRefreshTask(this.currentAgent.id, result.retryAfter, text, 'throttle');
                this.conversations[this.currentAgent.id].push({
                    type: 'agent',
                    text: `Throttle detected. Auto-retrying in ${result.retryAfter}s...`,
                    timestamp: new Date().toISOString()
                });
                this.loadAgentMessages();
                this.saveConversations();
                return;
            }
            const replyText = result.success ? result.reply : `Live send failed: ${result.error}`;
            this.conversations[this.currentAgent.id].push({
                type: 'agent',
                text: replyText,
                timestamp: new Date().toISOString()
            });
            this.updateAgentProgress(this.currentAgent.id, result.success ? 20 : 0);
            this.loadAgentMessages();
            this.saveConversations();
            return;
        }
        
        setTimeout(() => {
            const simulatedReply = `Agent ${this.currentAgent.name} received: "${text}"`;
            this.conversations[this.currentAgent.id].push({
                type: 'agent',
                text: simulatedReply,
                timestamp: new Date().toISOString()
            });
            this.updateAgentProgress(this.currentAgent.id, 20);
            this.loadAgentMessages();
            this.saveConversations();
        }, 500);
    }

    /**
     * Send message to PITA
     */
    async sendPitaMessage() {
        const input = document.getElementById('pitaInput');
        const text = input.value.trim();
        
        if (!text) return;
        
        const container = document.getElementById('pitaMessages');
        const userMsg = document.createElement('div');
        userMsg.className = 'message user';
        userMsg.textContent = text;
        container.appendChild(userMsg);
        
        input.value = '';
        container.scrollTop = container.scrollHeight;
        
        if (this.openClawLive) {
            const result = await this.sendLiveAgentMessage('main', text);
            if (result.providerIssue) {
                const handled = await this.handleProviderIssue(result.providerIssue, text, 'main');
                if (handled) {
                    const agentMsg = document.createElement('div');
                    agentMsg.className = 'message agent';
                    agentMsg.textContent = 'PITA: Provider issue detected; retry queued after optimization.';
                    container.appendChild(agentMsg);
                    container.scrollTop = container.scrollHeight;
                    return;
                }
            }
            if (result.retryAfter) {
                const agentMsg = document.createElement('div');
                agentMsg.className = 'message agent';
                agentMsg.textContent = `PITA: Throttle detected. Auto-retrying in ${result.retryAfter}s...`;
                container.appendChild(agentMsg);
                container.scrollTop = container.scrollHeight;
                this.scheduleRefreshTask('main', result.retryAfter, text, 'throttle');
                return;
            }
            const replyText = result.success ? result.reply : `PITA live send failed: ${result.error}`;
            const agentMsg = document.createElement('div');
            agentMsg.className = 'message agent';
            agentMsg.textContent = replyText;
            container.appendChild(agentMsg);
            container.scrollTop = container.scrollHeight;
            return;
        }
        
        setTimeout(() => {
            const agentMsg = document.createElement('div');
            agentMsg.className = 'message agent';
            agentMsg.textContent = `PITA: Received message "${text}"`;
            container.appendChild(agentMsg);
            container.scrollTop = container.scrollHeight;
        }, 300);
    }

    async broadcastMessage() {
        const input = document.getElementById('broadcastInput');
        const text = input.value.trim();
        if (!text) return;
        
        const agents = this.agents.filter(a => a.id !== 'pita-main' && a.id !== 'main');
        agents.forEach(agent => {
            if (!this.conversations[agent.id]) {
                this.conversations[agent.id] = [];
            }
            this.conversations[agent.id].push({
                type: 'user',
                text: text,
                timestamp: new Date().toISOString()
            });
            this.updateAgentProgress(agent.id, 10);
            if (!this.openClawLive) {
                this.conversations[agent.id].push({
                    type: 'agent',
                    text: `Broadcast to ${agent.name}: "${text}"`,
                    timestamp: new Date().toISOString()
                });
            }
        });
        input.value = '';
        this.saveConversations();
        this.renderAgentsList();
        this.showToast('Broadcast sent to all agents', 'success');
    }

    /**
     * Export agent conversation
     */
    exportAgentConversation() {
        if (!this.currentAgent) return;
        
        const messages = this.conversations[this.currentAgent.id] || [];
        const content = messages.map(m => `[${m.type.toUpperCase()}] ${m.text}`).join('\n');
        const filename = `${this.currentAgent.name}_${new Date().toISOString().slice(0, 10)}.txt`;
        
        this.downloadFile(content, filename);
        this.showToast(`Exported ${messages.length} messages`, 'success');
    }

    /**
     * Clear agent history
     */
    clearAgentHistory() {
        if (!this.currentAgent || !confirm('Clear history for this agent?')) return;
        
        this.conversations[this.currentAgent.id] = [];
        this.saveConversations();
        this.loadAgentMessages();
        this.showToast('History cleared', 'success');
    }

    updateAgentProgress(agentId, delta) {
        const agent = this.agents.find(a => a.id === agentId);
        if (!agent) return;
        agent.progress = Math.min(100, Math.max(0, (agent.progress || 0) + delta));
        if (agent.progress >= 100) {
            agent.status = 'COMPLETE';
        } else if (agent.progress > 0) {
            agent.status = 'RUNNING';
        }
        this.renderAgentsList();
    }

    async loadProviderStatus() {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
            const response = await fetch('/api/provider-status', { signal: controller.signal });
            if (!response.ok) {
                throw new Error(`Provider status API returned ${response.status}`);
            }
            this.providerStatus = await response.json();
            if (!this.openClawLive || this.providerStatus?.fallback) {
                this.openClawLive = false;
            }
            if (this.openClawLive && this.providerStatus?.recommended &&
                this.providerStatus.modelsStatus?.resolvedDefault !== this.providerStatus.recommended &&
                !this.providerAutoSelected) {
                await this.applyProviderSelection({ auto: true });
            }
        } catch (error) {
            console.warn('Failed to load provider status:', error);
            this.providerStatus = null;
        } finally {
            clearTimeout(timeout);
        }
    }

    async applyProviderSelection(options = {}) {
        try {
            const body = options.strategy ? { strategy: options.strategy } : null;
            const response = await fetch('/api/provider-select', {
                method: 'POST',
                headers: body ? { 'Content-Type': 'application/json' } : undefined,
                body: body ? JSON.stringify(body) : undefined
            });
            if (!response.ok) {
                throw new Error(`Provider selection API returned ${response.status}`);
            }
            const result = await response.json();
            if (result.selectedModel) {
                this.providerStatus = result.providerStatus || this.providerStatus;
                this.providerAutoSelected = true;
                this.renderProviderStrategy();
                const strategyLabel = result.strategy === 'max-paid' ? 'max-paid' : 'optimized';
                this.showToast(`Provider selection updated to ${result.selectedModel} (${strategyLabel})`, 'success');
                if (options.auto && result.strategy !== 'max-paid') {
                    this.showToast('Auto-applied cheapest available model.', 'info');
                }
                if (options.auto && result.strategy === 'max-paid') {
                    this.showToast('Auto-applied higher-cost paid model to reduce throttles.', 'info');
                }
            } else if (result.reason === 'local-fallback') {
                this.providerStatus = result.providerStatus || this.providerStatus;
                this.providerAutoSelected = true;
                this.renderProviderStrategy();
                this.showToast('Provider optimization simulated locally.', 'info');
            }
            return result;
        } catch (error) {
            console.error('Provider selection failed:', error);
            this.showToast('Provider optimization failed. See console for details.', 'error');
            return { error: error.message };
        }
    }

    async handleProviderIssue(issue, text, agentId) {
        if (issue !== 'upgrade-plan' || !this.openClawLive) {
            return false;
        }

        this.showToast('Upgrade/plan issue detected; switching to paid provider strategy...', 'warn');
        const result = await this.applyProviderSelection({ auto: true, strategy: 'max-paid' });
        if (result && result.selectedModel) {
            this.scheduleRefreshTask(agentId, 5, text, 'provider-selection');
            return true;
        }

        this.showToast('Paid provider switch failed; waiting before retry.', 'error');
        this.scheduleRefreshTask(agentId, 10, text, 'provider-selection');
        return true;
    }

    /**
     * Export all conversations
     */
    exportAllConversations() {
        const timestamp = new Date().toISOString().slice(0, 10);
        const data = {};
        
        this.agents.forEach(agent => {
            const messages = this.conversations[agent.id] || [];
            data[agent.name] = messages.map(m => `[${m.type.toUpperCase()}] ${m.text}`).join('\n');
        });
        
        const content = JSON.stringify(data, null, 2);
        this.downloadFile(content, `all_conversations_${timestamp}.json`);
        this.showToast('Exported all conversations', 'success');
    }

    /**
     * Clear all data
     */
    clearAllData() {
        if (!confirm('Clear all conversations and settings? This cannot be undone.')) return;
        
        this.conversations = {};
        this.agents.forEach(agent => {
            this.conversations[agent.id] = [];
        });
        this.saveConversations();
        this.loadAgentMessages();
        this.renderAgentsList();
        this.showToast('All data cleared', 'success');
    }

    /**
     * Open search modal
     */
    openSearchModal() {
        document.getElementById('searchModal').classList.add('active');
        document.getElementById('searchInput').focus();
    }

    /**
     * Close search modal
     */
    closeSearchModal() {
        document.getElementById('searchModal').classList.remove('active');
        document.getElementById('searchInput').value = '';
        document.getElementById('searchResults').innerHTML = '';
    }

    /**
     * Perform search across conversations
     */
    performSearch(query) {
        if (query.length < 2) {
            document.getElementById('searchResults').innerHTML = '';
            return;
        }
        
        const results = [];
        const lowerQuery = query.toLowerCase();
        
        this.agents.forEach(agent => {
            const messages = this.conversations[agent.id] || [];
            messages.forEach((msg, idx) => {
                if (msg.text.toLowerCase().includes(lowerQuery)) {
                    results.push({
                        agentId: agent.id,
                        agentName: agent.name,
                        agentIcon: agent.icon,
                        messageIndex: idx,
                        message: msg
                    });
                }
            });
        });
        
        this.renderSearchResults(results);
    }

    /**
     * Render search results
     */
    renderSearchResults(results) {
        const container = document.getElementById('searchResults');
        
        if (results.length === 0) {
            container.innerHTML = '<div class="message system">No results found</div>';
            return;
        }
        
        container.innerHTML = results.map(result => `
            <div class="search-result" data-agent-id="${result.agentId}">
                <div class="search-result-agent">${result.agentIcon} ${result.agentName}</div>
                <div class="search-result-text">${this.escapeHtml(result.message.text)}</div>
            </div>
        `).join('');
        
        container.querySelectorAll('.search-result').forEach(el => {
            el.addEventListener('click', () => {
                const agentId = el.getAttribute('data-agent-id');
                this.closeSearchModal();
                this.openAgentModal(agentId);
            });
        });
    }

    /**
     * Open settings modal
     */
    openSettingsModal() {
        document.getElementById('settingsModal').classList.add('active');
    }

    /**
     * Close settings modal
     */
    closeSettingsModal() {
        document.getElementById('settingsModal').classList.remove('active');
    }

    /**
     * Toggle filter panel
     */
    toggleFilterPanel() {
        const panel = document.getElementById('filterControls');
        if (panel.style.display === 'none') {
            panel.style.display = 'flex';
        } else {
            panel.style.display = 'none';
        }
    }

    /**
     * Apply status filters
     */
    applyFilters() {
        this.activeFilters = Array.from(document.querySelectorAll('.status-filter:checked'))
            .map(el => el.value);
        
        document.querySelectorAll('.agent-item').forEach(item => {
            const agentId = item.getAttribute('data-agent-id');
            const agent = this.agents.find(a => a.id === agentId);
            
            if (this.activeFilters.length === 0) {
                item.style.display = '';
            } else {
                item.style.display = this.activeFilters.includes(agent.status) ? '' : 'none';
            }
        });
    }

    /**
     * Save settings to localStorage
     */
    saveSettings() {
        localStorage.setItem('dashboardSettings', JSON.stringify(this.settings));
    }

    /**
     * Refresh agent status (live or simulated)
     */
    async refreshAgentStatus() {
        if (this.openClawLive) {
            await this.loadLiveState();
            await this.loadProviderStatus();
            this.showToast('Live OpenClaw status refreshed', 'success');
        } else {
            this.simulateAgentActivity();
            this.showToast('Dashboard agent activity refreshed', 'success');
        }
        
        this.renderAgentsList();
    }

    /**
     * Auto-refresh agent status
     */
    startAutoRefresh() {
        if (this.autoRefreshInterval) return;
        
        const intervalMs = this.agentsConfig.settings.pollInterval || 3000;
        this.nextRefreshAt = Date.now() + intervalMs;
        this.startStatusCountdown();
        this.autoRefreshInterval = setInterval(() => {
            this.refreshAgentStatus();
        }, intervalMs);
        this.updateStatusBar();
    }

    simulateAgentActivity() {
        this.agents = this.agents.map(agent => {
            if (agent.status === 'COMPLETE') {
                return agent;
            }
            const nextProgress = Math.min(100, (agent.progress || 0) + Math.ceil(Math.random() * 15));
            return {
                ...agent,
                progress: nextProgress,
                status: nextProgress >= 100 ? 'COMPLETE' : 'RUNNING'
            };
        });
    }

    /**
     * Stop auto-refresh
     */
    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
        this.stopStatusCountdown();
        this.nextRefreshAt = null;
        this.updateStatusBar();
    }

    /**
     * Setup keyboard shortcuts
     */
    updateStatusBar() {
        const statusTextEl = document.getElementById('dashboardStatusText');
        const countdownEl = document.getElementById('refreshCountdown');
        if (statusTextEl) {
            statusTextEl.textContent = this.openClawLive
                ? `OpenClaw live: ${this.providerStatus?.modelsStatus?.resolvedDefault || 'model unknown'} active.`
                : 'Fallback dashboard: OpenClaw unavailable; using simulated agents.';
        }
        if (countdownEl) {
            countdownEl.textContent = this.autoRefreshInterval
                ? `Next refresh in ${this.getSecondsToRefresh()}s`
                : 'Auto-refresh is paused';
        }
    }

    getSecondsToRefresh() {
        if (!this.nextRefreshAt) {
            return 0;
        }
        return Math.max(0, Math.ceil((this.nextRefreshAt - Date.now()) / 1000));
    }

    startStatusCountdown() {
        if (this.statusBarTimer) return;
        this.statusBarTimer = setInterval(() => {
            this.updateStatusBar();
        }, 500);
    }

    stopStatusCountdown() {
        if (this.statusBarTimer) {
            clearInterval(this.statusBarTimer);
            this.statusBarTimer = null;
        }
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+F = Search
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                this.openSearchModal();
            }
            
            // Ctrl+1 = PITA
            if (e.ctrlKey && e.key === '1') {
                e.preventDefault();
                this.closeAgentModal();
                document.getElementById('pitaInput').focus();
            }
            
            // Ctrl+2-9 = Agents with shortcuts
            if (e.ctrlKey && e.key >= '2' && e.key <= '9') {
                e.preventDefault();
                const shortcutNum = parseInt(e.key);
                const agent = this.agents.find(a => a.shortcut === shortcutNum);
                if (agent) {
                    this.openAgentModal(agent.id);
                }
            }
            
            // Escape = Close modals
            if (e.key === 'Escape') {
                this.closeAgentModal();
                this.closeSearchModal();
                this.closeSettingsModal();
            }
        });
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    /**
     * Download file helper
     */
    downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new AgentDashboard();
});
