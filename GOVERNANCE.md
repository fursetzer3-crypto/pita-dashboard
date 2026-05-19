# Governance Loop — Deny-by-Default Policy + Auto-Issue Filing

## Architecture

```
Agent needs new capability
        │
        ▼
  ⚠️ Check policy file → ALLOWED? → Execute. Done.
        │ DENIED
        ▼
  📝 File GitHub issue in pita-dashboard repo
        │
        ▼
  🧑 Human reviews (Professor Falken or PITA)
        │
        ├─ APPROVED → Merge policy change → Agent retries
        └─ DENIED   → Agent logs workaround or stops
```

## Policy File: `GOVERNANCE_POLICY.md`

This file lives at the vault root and lists every allowed capability. Everything not listed is DENIED by default.

## Issue Template: `.github/ISSUE_TEMPLATE/capability-request.md`

Auto-filed when an agent hits a blocked capability.

## How Agents Use It

1. Before accessing ANY external resource (API, file path, network, tool), check the policy.
2. If the action is listed → proceed.
3. If not listed → file issue using `gh issue create`, then wait.

## Escalation Timing

- Normal: reviewed at PITA's next check-in
- Urgent: `@pita` mention in the issue itself
