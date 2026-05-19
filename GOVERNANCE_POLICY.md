# Governance Policy — Deny by Default

## Principle
Every capability is DENIED unless explicitly listed below. Agents must file a GitHub issue to request new entries.

## ✅ ALLOWED CAPABILITIES

### Core System
- [ ] Read/write files in `C:\Users\Fursetzer\Documents\MyVault\`
- [ ] Read from `C:\Users\Fursetzer\.openclaw\config\*`
- [ ] Execute OpenClaw CLI commands (`openclaw *`)
- [ ] Read/parse `YOUTUBE_VIDEO_LOG.md`

### API & Network
- [ ] DeepSeek API (env: DEEPSEEK_API_KEY)
- [ ] Nvidia Nemo API (env: NVIDIA_API_KEY)
- [ ] Google Gemini API (env: GOOGLE_GEMINI_API_KEY) — text only
- [ ] Mistral API (env: MISTRAL_API_KEY)
- [ ] Oracle API (env: ORACLE_API_KEY)
- [ ] GitHub CLI (`gh`) — repo access only
- [ ] Yahoo Finance — read-only public data
- [ ] YouTube transcript extraction (read-only)
- [ ] Tactiq transcript generation (read-only)

### External Services (Read-Only)
- [ ] DigitalOcean API — status checks, read-only
- [ ] Freeimage.host — temporary image uploads

### Git & Deployment
- [ ] `git push/pull/commit` to `fursetzer3-crypto/pita-dashboard`
- [ ] GitHub issue creation/reading (`gh issue *`)

## ❌ BLOCKED (requires new issue)
- Any external API not listed above
- Any write to external accounts (email, eBay, bank)
- Any credit card or payment API
- Any SSH to machines not listed in CLOUD_INSTANCE.md
- Direct access to Google/Gmail APIs (pending CRM pipeline)

## How to Request
File an issue in `fursetzer3-crypto/pita-dashboard` using the capability request template.
