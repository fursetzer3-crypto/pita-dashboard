# Swarm Protocols — @mention Routing & Model Strategy

## 1. @mention Routing (Adopted from 11-Agent Architecture)

**Every message between agents MUST @mention the recipient.** No exceptions.

### Format
```
@agent_id: message text. Context: {brief}. Deadline: {time}. Escalate: {condition}.
```

### Route Table

| Prefix | Routes To | Purpose |
|--------|-----------|---------|
| `@main` or `@pita` | PITA (Chief of Staff) | Orchestration, routing, user-facing |
| `@memorykeeper` | Memory Keeper | Vault read/write, memory search |
| `@knowledgescout` | Knowledge Scout | Research, transcript pull, evidence |
| `@correctnessauditor` | Correctness Auditor | Pre-delivery verification |
| `@scanlite` | ScanLite | Connectivity, file I/O, diagnostics |
| `@aisubscriptionmanager` | AI Subscription Manager | Model routing, API keys, cost optimization |
| `@chatreader` | Chat Reader | Chat history analysis |
| `@openclawconnectivity` | Connectivity | Node pairing, gateway health |
| `@orchestrationplanner` | Orchestration Planner | Resource allocation, task sequencing |
| `@duplicatecleanup` | Duplicate Cleanup | File deduplication |
| `@subscriptionaudit` | Subscription Audit | Recurring charge tracking |
| `@innovation` | Innovation Scout | YouTube scanning, trend analysis |
| `@journal` | Journaler | Daily log processing |

### Handoff Protocol
1. **Context**: What's been done, what's known, what's outstanding (2-3 sentences max)
2. **Deadline**: When the result is needed (ISO time or relative)
3. **Escalation**: If condition X not met by deadline, route to @pita

**Rule:** "Inconsistent enforcement is worse than no architecture." Every message must comply. If an agent sends without @mention, @pita logs it and rejects.

## 2. Three-Tier Model Strategy

| Tier | Role | Model | Context | When Used |
|------|------|-------|---------|-----------|
| **1 — Strategy** | Cross-domain reasoning, orchestration planning | DeepSeek v4 Pro | 1M tokens | Complex multi-step tasks, business decisions |
| **2 — Execution** | Day-to-day agent work, research, coding | DeepSeek v4 Flash | 1M tokens | **Default tier.** Most agent tasks |
| **3 — Image/Vision** | Screenshot reading, visual analysis | Nvidia Nemo (Llama 3.2 90B Vision) | 128k | When images are uploaded, visual data needed |

### Routing Rules
- **DeepSeek Flash = default for all text work.** Fast, cheap, 1M context.
- **DeepSeek Pro = fallback** when Flash isn't enough.
- **Nvidia Nemo = image only.** Triggered by image tool or when user sends pictures.
- **No mixing.** DeepSeek doesn't do images. Nvidia doesn't have 1M context. Choose by task.

## 3. CRM — Gmail Contact Auto-Discovery

**Future implementation pattern:**
- Gmail skill scans inbox for: new contacts, vendor relationships, grant contacts, real estate agents
- Extracts: name, email, company, relationship type, last contact date
- Saves to: vault CRM index

*Implementation pending Gmail skill integration.*

## 4. Escalation Ladder

| Level | Who | When |
|-------|-----|------|
| L1 | Agent self-heals | Minor errors, retries, rate limits |
| L2 | @pita notified | Pattern failures, resource conflicts |
| L3 | Professor Falken | Money, irreversibility, external accounts |

## 5. Zero-Question Protocol

If you're blocked on something another agent or tool can solve:
1. **Spawn the relevant agent** — knowledgescout for research, aisubscriptionmanager for API keys
2. **Do not ask Professor Falken** for config, keys, model selection, or troubleshooting
3. **Only escalate** for money decisions, irreversible actions, or external account access
