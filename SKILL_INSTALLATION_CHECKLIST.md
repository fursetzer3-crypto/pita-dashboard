# Skill Installation Checklist

## Before Installing ANY Skill
Every agent must complete this checklist and report to @pita before install.

### ✅ Step 1 — Official Approval
- [ ] Is the skill in the official OpenClaw registry?
- [ ] Does it have the "verified" or "official" badge?
- [ ] Has the skill been reviewed by OpenClaw maintainers?

### ✅ Step 2 — Community Sentiment
- [ ] Searched r/OpenClaw for this skill name + "malware" + "issue" + "review"
- [ ] Searched Discord for same
- [ ] Searched ClawHub reviews/ratings (minimum 4.0/5.0 required)
- [ ] Any reports of data exfiltration, unauthorized API calls, or suspicious behavior?

### ✅ Step 3 — Code Audit (if open-source)
- [ ] No obfuscated code
- [ ] No unexpected network calls to unknown hosts
- [ ] No API keys or hardcoded secrets
- [ ] Only requests permissions it actually needs

### ✅ Step 4 — Report
Format:
```
SKILL INVESTIGATION REPORT
Skill: [name]
Official: [yes/no — verified badge?]
ClawHub Rating: [X.X/5.0]
Reddit Sentiment: [positive/negative/mixed — key threads]
Discord Sentiment: [same]
Code Review: [clean/suspicious/not available]
Verdict: [APPROVED / DENIED / NEEDS CLARIFICATION]
```

## Known Risks (from May 2026 community analysis)
- **50% of community skills are estimated malicious** (from OpenCode integration video)
- **Claw Hub malware incidents documented** in OpenClaw subreddit
- **8,000+ exposed OpenClaw instances** online with default configs
- Skills requesting `exec` or `file_write` without explanation are high risk

## Blocked Until Approved
- No skill may be installed until the investigation report is filed AND @pita approves it.
- Installing without investigation is a governance violation.
