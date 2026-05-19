@echo off
REM Auto-file a governance capability request
REM Usage: file-governance-request.bat "agent-id" "what was blocked" "why needed"
set AGENT=%1
set BLOCKED=%2
set REASON=%3
set TITLE=[CAPABILITY] %BLOCKED%
set BODY=Agent: %AGENT%%0AWhat: %BLOCKED%%0AWhy: %REASON%%0AUrgency: ASAP
gh issue create --repo fursetzer3-crypto/pita-dashboard --title "%TITLE%" --body "%BODY%" --label governance,capability-request
