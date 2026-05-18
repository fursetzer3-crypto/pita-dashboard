# OpenClaw Agent Dashboard

A visual dashboard for managing multi-agent conversations in OpenClaw. See PITA (main agent) at the top, browse spawned agents below, and switch between conversations without losing context.

## Features

✨ **Core Functionality**
- **PITA Agent Panel** — Main conversation area at the top
- **Agent List** — View all spawned agents with status indicators
- **Agent Modals** — Open separate chat windows for each agent
- **Multi-Agent Support** — Run conversations with multiple agents simultaneously
- **Real-time Status** — See agent status (ACTIVE, RUNNING, COMPLETE, QUEUED, ERROR, IDLE)

🎯 **Key Capabilities**
- **Persistent Sessions** — Conversations saved in browser localStorage
- **Search** — Find messages across all agent conversations (Ctrl+F)
- **Export** — Download individual or all conversations as files
- **Filtering** — Filter agents by status
- **Keyboard Shortcuts** — Quick navigation with hotkeys
- **Paid Model Optimization** — Switch between cheap-first and max-paid provider selection to reduce throttle and rate-limit issues
- **Dark Theme** — Professional, low-eye-strain design
- **Responsive Layout** — Works on desktop, tablet, and mobile

## Files

- **dashboard.html** — Main UI (standalone, self-contained)
- **dashboard.css** — Dark theme styles (responsive, professional)
- **dashboard.js** — Interactivity and state management
- **agents_config.json** — Configuration for all 11 agents
- **README_DASHBOARD.md** — This file

## Quick Start

### 1. Run the live dashboard server

1. Open a terminal in `C:\Users\Fursetzer\Documents\MyVault\dashboard`
2. Run `node server.js`
3. Open `http://localhost:3689/dashboard.html` in your browser
4. The dashboard will load actual OpenClaw agent state when available

### 2. Open in Browser

1. Open `dashboard.html` in any modern web browser (Chrome, Firefox, Safari, Edge)
2. Dashboard loads with default configuration
3. PITA panel ready for messages at top
4. Agent list below with all spawned agents

### 3. Test with Demo Agents

All 11 agents are pre-configured:

| Agent | Status | Shortcut |
|-------|--------|----------|
| Chat Reader | COMPLETE | Ctrl+2 |
| OpenClaw Connectivity | READY | Ctrl+3 |
| Duplicate Cleanup | QUEUED | Ctrl+4 |
| Subscription Audit | QUEUED | Ctrl+5 |
| Excel → CSV Tool | QUEUED | Ctrl+6 |
| Scanner & Label Maker | QUEUED | Ctrl+7 |
| eBay Business Monitor | QUEUED | Ctrl+8 |
| Zip File Handler | QUEUED | Ctrl+9 |
| Stock Tracker | QUEUED | — |
| Business Tracker | QUEUED | — |
| Abby Tracker | QUEUED | — |

## Usage

### PITA Panel (Main Agent)

1. Type a message in the input box
2. Press Enter or click "Send"
3. Messages appear in chat history
4. Conversations auto-save to browser

### Agent Conversations

1. **Expand Agent** — Click agent row to expand details
2. **Open Agent** — Click [Open] to show full conversation modal
3. **Send Message** — Type and press Enter in modal
4. **View History** — Click [History] to see past messages
5. **Close Agent** — Click [Close] to stop conversation

### Search

- Press **Ctrl+F** or click 🔍 button
- Type search term (min 2 characters)
- Results show agent + matching messages
- Click result to open that agent

### Status Updates

- **ACTIVE** — Currently running (green)
- **RUNNING** — In progress, processing (blue)
- **COMPLETE** — Finished, results ready (green)
- **READY** — Available, waiting for input (light blue)
- **QUEUED** — Pending spawn/execution (gray)
- **ERROR** — Failed (red)
- **IDLE** — Closed, not active (gray)

### Filters

1. Click ▼ button in Agents panel
2. Check/uncheck status types to filter
3. Agents list updates in real-time
4. Click again to hide filter panel

### Settings (⚙️)

**Auto-Refresh** — Enable/disable automatic status polling (default: on, 3s interval)

**Sound Notifications** — Alert when agents complete (default: on)

**Max Messages** — Limit conversation display (default: 50, range: 10-500)

**Export All** — Download all conversations as JSON

**Clear All** — Erase all conversations and settings (⚠️ irreversible)

### Export

**Agent Level**
- Open agent modal
- Click 💾 (export button)
- Saves as `AgentName_YYYY-MM-DD.txt`

**Dashboard Level**
- Settings → [Export All Conversations]
- Saves as `all_conversations_YYYY-MM-DD.json`

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+F | Open search modal |
| Ctrl+1 | Focus PITA agent |
| Ctrl+2–9 | Open agent 1–8 (when available) |
| Escape | Close all modals |
| Enter | Send message (in any input) |

## Data Persistence

All data is stored in **browser localStorage**:
- `conversations` — All message histories
- `dashboardSettings` — User preferences

### Clear Data

**Locally:**
1. Open browser DevTools (F12)
2. Application → Local Storage → Select site
3. Delete entries

**Via Dashboard:**
1. ⚙️ → Settings
2. Click "Clear All Data"
3. Confirm when prompted

## Configuration

Edit `agents_config.json` to customize:

```json
{
  "agents": [
    {
      "id": "agent-1",
      "name": "Chat Reader",
      "type": "spawned",
      "status": "COMPLETE",
      "description": "...",
      "icon": "📖",
      "shortcut": 2
    }
  ],
  "settings": {
    "theme": "dark",
    "pollInterval": 3000,
    "maxHistoryMessages": 50,
    "autoSaveInterval": 2000
  }
}
```

**Fields:**
- `id` — Unique agent identifier
- `name` — Display name
- `type` — "main" or "spawned"
- `status` — Initial status (ACTIVE, RUNNING, COMPLETE, READY, QUEUED, ERROR, IDLE)
- `description` — Short description
- `icon` — Emoji or symbol
- `shortcut` — Keyboard shortcut number (2–9) or null

## Integration with OpenClaw

### Current (Mock Mode)

Dashboard works **standalone** using browser localStorage. Perfect for:
- Visual prototyping
- User feedback
- Testing layout and flows
- Demonstrating agent management

### Future (Real Integration)

To connect with actual OpenClaw sessions:

1. **Backend API** — Expose session endpoints
   ```
   GET /api/agents — List agents
   GET /api/agents/:id/messages — Get conversation
   POST /api/agents/:id/message — Send message
   WS /api/agents/status — Real-time status updates
   ```

2. **Fetch Config** — Replace hardcoded JSON
   ```javascript
   const response = await fetch('http://openclaw-api/agents');
   this.agents = await response.json();
   ```

3. **WebSocket Status** — Real-time updates
   ```javascript
   const ws = new WebSocket('ws://openclaw-api/status');
   ws.onmessage = (event) => {
     const agent = JSON.parse(event.data);
     this.updateAgentStatus(agent.id, agent.status);
   };
   ```

4. **Message Sync** — Send/receive via API
   ```javascript
   async sendMessage(agentId, text) {
     const response = await fetch(`/api/agents/${agentId}/message`, {
       method: 'POST',
       body: JSON.stringify({ text })
     });
     const message = await response.json();
     this.addMessage(agentId, message);
   }
   ```

## Remote Desktop / Background Access

Use remote desktop tools to keep dashboard and OpenClaw processes running while you work from another machine.

Recommended steps:
- Enable remote access with **Microsoft Remote Desktop** or **Chrome Remote Desktop** on the host machine.
- Ensure the dashboard server is started with `node server.js` and accessible on port `3689`.
- If needed, forward port `3689` or use an SSH tunnel to expose the dashboard to your remote client.
- Keep the browser tab open to preserve session state and localStorage while agents are active.

For more details, see `REMOTE_DESKTOP_SETUP.md`.

## Troubleshooting

### Dashboard Won't Load

- Check browser console (F12) for errors
- Ensure `agents_config.json` is in same folder
- Try clearing browser cache (Ctrl+Shift+Delete)

### Messages Not Saving

- Check if localStorage is enabled
- Open Settings → Clear All → Reload
- Try in private/incognito window

### Keyboard Shortcuts Not Working

- Some apps/browsers may intercept Ctrl keys
- Try Alt+number or custom keybindings
- Check Settings for disabled shortcuts

### Performance Issues

- Reduce `maxHistoryMessages` in settings (default: 50)
- Close unused agent modals
- Disable auto-refresh if not needed
- Clear old conversations

## Browser Support

| Browser | Support |
|---------|---------|
| Chrome 90+ | ✅ Full |
| Firefox 88+ | ✅ Full |
| Safari 14+ | ✅ Full |
| Edge 90+ | ✅ Full |
| Mobile Chrome | ✅ Full (responsive) |
| Mobile Safari | ✅ Full (responsive) |

## Development

### Customize Theme

Edit CSS variables in `dashboard.css`:

```css
:root {
    --bg-primary: #0d1117;        /* Main background */
    --bg-secondary: #161b22;      /* Secondary background */
    --accent-primary: #58a6ff;    /* Primary accent */
    --status-active: #3fb950;     /* Active status color */
    /* ... more variables ... */
}
```

### Add New Agent

1. Edit `agents_config.json`
2. Add entry to `agents` array
3. Dashboard auto-loads new agent
4. Click [Open] to start conversation

### Extend Functionality

Main class: `AgentDashboard` in `dashboard.js`

Key methods:
- `loadConfig()` — Load agents
- `openAgentModal(agentId)` — Show agent chat
- `sendAgentMessage()` — Send/receive messages
- `performSearch()` — Search conversations
- `exportAgentConversation()` — Export data

## Next Steps

1. ✅ **Static Prototype** — Current state (ready)
2. 🔲 **OpenClaw Integration** — Connect real sessions
3. 🔲 **WebSocket Updates** — Real-time status
4. 🔲 **Database Persistence** — Server-side history
5. 🔲 **Advanced Features** — Collaboration, role-based access

## Support

For issues or feature requests:
1. Check browser console (F12) for errors
2. Review this README for solutions
3. Test in different browser if possible
4. Report with:
   - Browser/version
   - Steps to reproduce
   - Expected vs actual behavior

## License

Part of OpenClaw. Use freely within your OpenClaw workspace.

---

**Version:** 1.0  
**Last Updated:** 2026-04-19  
**Status:** MVP Ready
