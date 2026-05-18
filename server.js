const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3689;
let PORT = DEFAULT_PORT;
const PUBLIC_DIR = path.resolve(__dirname);
const defaultOpenClawPath = path.join(process.env.APPDATA || '', 'npm', 'openclaw.cmd');
const OPENCLAW_CMD = process.env.OPENCLAW_CMD || (process.platform === 'win32' && fs.existsSync(defaultOpenClawPath) ? defaultOpenClawPath : 'openclaw');
const CLI_TIMEOUT = 120000;

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain'
};

function quoteCmdArg(value) {
    const str = String(value);
    if (/["]|\s/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };
}

function sendJson(res, payload, status = 200) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        ...corsHeaders()
    });
    res.end(JSON.stringify(payload));
}

function sendError(res, status, message) {
    sendJson(res, { error: message }, status);
}

function extractRetryAfter(text) {
    if (!text) {
        return null;
    }
    const source = String(text).toLowerCase();
    const minutePatterns = [
        /try again in\s*(\d+)\s*minutes?/, 
        /wait(?:ing)?(?: for)?\s*(\d+)\s*minutes?/, 
        /please wait\s*(\d+)\s*minutes?/
    ];
    for (const pattern of minutePatterns) {
        const match = source.match(pattern);
        if (match) {
            return Number(match[1]) * 60;
        }
    }
    const patterns = [
        /retry-after[:=]?\s*(\d+)/i,
        /wait(?:ing)?(?: for)?\s*(\d+)\s*(?:seconds|secs|s)?/i,
        /try again in\s*(\d+)\s*(?:seconds|secs|s)?/i,
        /please wait\s*(\d+)\s*(?:seconds|secs|s)?/i,
        /try again in\s*(\d+)\s*mins?/i,
        /wait(?:ing)?(?: for)?\s*(\d+)\s*mins?/i
    ];
    for (const pattern of patterns) {
        const match = source.match(pattern);
        if (match) {
            return Number(match[1]);
        }
    }
    if (/try again later/i.test(source) || /please try again/i.test(source) || /wait a bit/i.test(source)) {
        return 45;
    }
    return null;
}

function loadDashboardConfig() {
    try {
        const configPath = path.join(PUBLIC_DIR, 'agents_config.json');
        const configData = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(configData);
    } catch (err) {
        console.warn('Failed to load dashboard config:', err.message);
        return {};
    }
}

function loadAgentConfig() {
    const config = loadDashboardConfig();
    return Array.isArray(config.agents) ? config.agents : [];
}

function runOpenClawJson(args, callback) {
    runOpenClaw(args, (err, stdout, stderr) => {
        if (err) {
            callback(err, null, stderr || stdout);
            return;
        }
        try {
            const data = JSON.parse(stdout);
            callback(null, data, stderr);
        } catch (parseErr) {
            callback(parseErr, null, stderr);
        }
    });
}

function extractProviderIssue(text) {
    if (!text) return null;
    const source = String(text);
    const patterns = [
        /upgrade\s*plan/i,
        /upgrade your plan/i,
        /plan required/i,
        /quota/i,
        /subscription/i,
        /paid plan/i,
        /not available/i,
        /rate limit/i
    ];
    return patterns.some(pattern => pattern.test(source)) ? 'upgrade-plan' : null;
}

function choosePreferredModel(providerStrategy, modelStatus) {
    if (!modelStatus || !Array.isArray(modelStatus.allowed)) {
        return null;
    }
    const allowed = modelStatus.allowed.map(String);
    for (const provider of providerStrategy) {
        if (!Array.isArray(provider.preferredModels)) continue;
        for (const model of provider.preferredModels) {
            if (allowed.includes(model)) {
                return {
                    provider: provider.id,
                    model
                };
            }
        }
    }
    return null;
}

function chooseMaxPaidModel(providerStrategy, modelStatus) {
    if (!modelStatus || !Array.isArray(modelStatus.allowed)) {
        return null;
    }
    const allowed = modelStatus.allowed.map(String);
    const reversed = [...providerStrategy].reverse();
    for (const provider of reversed) {
        if (!Array.isArray(provider.preferredModels)) continue;
        for (const model of provider.preferredModels) {
            if (allowed.includes(model)) {
                return {
                    provider: provider.id,
                    model
                };
            }
        }
    }
    return null;
}

function getProviderStatus(callback) {
    const dashboardConfig = loadDashboardConfig();
    const providerStrategy = Array.isArray(dashboardConfig.providerStrategy)
        ? dashboardConfig.providerStrategy
        : [];

    runOpenClawJson(['models', 'status', '--json'], (err, modelsStatus) => {
        if (err) {
            const preferred = providerStrategy.length > 0 && providerStrategy[0].preferredModels
                ? providerStrategy[0].preferredModels[0]
                : null;
            callback(null, {
                modelsStatus: {
                    defaultModel: null,
                    resolvedDefault: null,
                    allowed: []
                },
                config: null,
                providerStrategy,
                recommended: preferred,
                selectedProvider: providerStrategy.length > 0 ? providerStrategy[0].id : null,
                recommendedPaid: preferred,
                selectedPaidProvider: providerStrategy.length > 0 ? providerStrategy[0].id : null,
                fallback: true,
                error: err.message
            });
            return;
        }

        runOpenClawJson(['config', 'get', '--json'], (configErr, config) => {
            const preferred = choosePreferredModel(providerStrategy, modelsStatus);
            const paid = chooseMaxPaidModel(providerStrategy, modelsStatus);
            callback(null, {
                modelsStatus,
                config: config || null,
                providerStrategy,
                recommended: preferred ? preferred.model : null,
                selectedProvider: preferred ? preferred.provider : null,
                recommendedPaid: paid ? paid.model : null,
                selectedPaidProvider: paid ? paid.provider : null,
                fallback: false,
                error: configErr ? configErr.message : null
            });
        });
    });
}

function setDefaultModel(model, callback) {
    if (!model) {
        callback(new Error('Model name is required')); 
        return;
    }
    runOpenClaw(['models', 'set', model], callback);
}

function applyPreferredModel(strategy, callback) {
    if (typeof strategy === 'function') {
        callback = strategy;
        strategy = 'default';
    }
    getProviderStatus((err, status) => {
        if (err) {
            callback(err);
            return;
        }
        const selection = strategy === 'max-paid'
            ? { model: status.recommendedPaid, provider: status.selectedPaidProvider }
            : { model: status.recommended, provider: status.selectedProvider };

        const recommended = selection.model;
        if (!recommended) {
            callback(new Error('No recommended model available for selected strategy')); 
            return;
        }
        if (status.fallback) {
            callback(null, {
                model: recommended,
                applied: false,
                reason: 'local-fallback',
                fallback: true,
                strategy
            });
            return;
        }
        if (status.modelsStatus && status.modelsStatus.resolvedDefault === recommended) {
            callback(null, {
                model: recommended,
                applied: false,
                reason: 'already-current',
                strategy
            });
            return;
        }
        setDefaultModel(recommended, (setErr) => {
            if (setErr) {
                callback(setErr);
                return;
            }
            callback(null, { model: recommended, applied: true, strategy });
        });
    });
}

function enrichFallbackAgents(agents) {
    return agents.map((agent, index) => ({
        ...agent,
        type: 'spawned',
        status: agent.status === 'COMPLETE' ? 'COMPLETE' : 'RUNNING',
        progress: typeof agent.progress === 'number' ? agent.progress : Math.min(100, 15 + index * 6)
    }));
}

function serveStatic(req, res) {
    let filePath = req.url.split('?')[0];
    if (filePath === '/') {
        filePath = '/dashboard.html';
    }

    const resolvedPath = path.join(PUBLIC_DIR, decodeURIComponent(filePath));
    if (!resolvedPath.startsWith(PUBLIC_DIR)) {
        sendError(res, 400, 'Invalid request path');
        return;
    }

    fs.stat(resolvedPath, (err, stats) => {
        if (err) {
            sendError(res, 404, 'Resource not found');
            return;
        }

        let targetPath = resolvedPath;
        if (stats.isDirectory()) {
            targetPath = path.join(resolvedPath, 'dashboard.html');
        }

        fs.readFile(targetPath, (readErr, data) => {
            if (readErr) {
                sendError(res, 500, 'Failed to read resource');
                return;
            }
            const ext = path.extname(targetPath).toLowerCase();
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            res.writeHead(200, {
                'Content-Type': contentType,
                ...corsHeaders()
            });
            res.end(data);
        });
    });
}

function runOpenClaw(args, callback) {
    const isWindows = process.platform === 'win32';
    const spawnOptions = {
        timeout: CLI_TIMEOUT,
        windowsHide: true,
        shell: false
    };

    if (isWindows) {
        const child = spawn('cmd.exe', ['/c', OPENCLAW_CMD, ...args], spawnOptions);
        let stdout = '';
        let stderr = '';

        if (process.env.DEBUG_OPENCLAW) {
            console.log('OpenClaw spawn:', 'cmd.exe', ['/c', OPENCLAW_CMD, ...args].join(' '));
        }

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });
        child.on('error', (err) => {
            callback(err, null, stderr || err.message);
        });
        child.on('close', (code) => {
            if (code !== 0) {
                callback(new Error(`OpenClaw exited with code ${code}`), null, stderr || stdout);
                return;
            }
            callback(null, stdout, stderr);
        });
        return;
    }

    const child = spawn(OPENCLAW_CMD, args, spawnOptions);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
    });
    child.on('error', (err) => {
        callback(err, null, stderr || err.message);
    });
    child.on('close', (code) => {
        if (code !== 0) {
            callback(new Error(`OpenClaw exited with code ${code}`), null, stderr || stdout);
            return;
        }
        callback(null, stdout, stderr);
    });
}

function parseJsonBody(req, callback) {
    let body = '';
    req.on('data', (chunk) => {
        body += chunk.toString();
    });
    req.on('end', () => {
        try {
            callback(null, JSON.parse(body || '{}'));
        } catch (err) {
            callback(err);
        }
    });
}

const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders());
        res.end();
        return;
    }

    if (req.url === '/api/provider-status' && req.method === 'GET') {
        getProviderStatus((err, status) => {
            if (err) {
                sendError(res, 500, `Unable to read provider status: ${err.message}`);
                return;
            }
            sendJson(res, status);
        });
        return;
    }

    if (req.url === '/api/provider-select' && req.method === 'POST') {
        parseJsonBody(req, (bodyErr, body) => {
            if (bodyErr) {
                sendError(res, 400, 'Invalid JSON body');
                return;
            }
            const strategy = body && body.strategy === 'max-paid' ? 'max-paid' : 'default';
            applyPreferredModel(strategy, (err, result) => {
                if (err) {
                    sendError(res, 500, `Provider selection failed: ${err.message}`);
                    return;
                }
                getProviderStatus((statusErr, status) => {
                    const responsePayload = {
                        selectedModel: result.model,
                        applied: result.applied,
                        reason: result.reason || null,
                        fallback: result.fallback || false,
                        strategy: result.strategy || strategy,
                        providerStatus: status || null
                    };
                    if (statusErr) {
                        responsePayload.providerStatusError = statusErr.message;
                    }
                    sendJson(res, responsePayload);
                });
            });
        });
        return;
    }

    if (req.url === '/api/provider-maximize' && req.method === 'POST') {
        applyPreferredModel('max-paid', (err, result) => {
            if (err) {
                sendError(res, 500, `Provider maximize failed: ${err.message}`);
                return;
            }
            getProviderStatus((statusErr, status) => {
                const responsePayload = {
                    selectedModel: result.model,
                    applied: result.applied,
                    reason: result.reason || null,
                    fallback: result.fallback || false,
                    strategy: result.strategy || 'max-paid',
                    providerStatus: status || null
                };
                if (statusErr) {
                    responsePayload.providerStatusError = statusErr.message;
                }
                sendJson(res, responsePayload);
            });
        });
        return;
    }

    if (req.url === '/api/agents' && req.method === 'GET') {
        runOpenClaw(['agents', 'list', '--json'], (err, stdout, stderr) => {
            if (err) {
                const fallback = loadAgentConfig();
                if (fallback.length > 0) {
                    console.warn('Returning fallback agents list due to OpenClaw error:', err.message);
                    sendJson(res, fallback);
                    return;
                }
                sendError(res, 500, `OpenClaw error: ${stderr || err.message}`);
                return;
            }
            try {
                const data = JSON.parse(stdout);
                sendJson(res, data);
            } catch (parseErr) {
                const fallback = loadAgentConfig();
                if (fallback.length > 0) {
                    console.warn('Returning fallback agents list due to parse error:', parseErr.message);
                    sendJson(res, fallback);
                    return;
                }
                sendError(res, 500, 'Failed to parse OpenClaw JSON response');
            }
        });
        return;
    }

    if (req.url.startsWith('/api/agents/') && req.method === 'POST') {
        const agentId = decodeURIComponent(req.url.split('/')[3] || '').trim();
        if (!agentId) {
            sendError(res, 400, 'Agent id required');
            return;
        }

        parseJsonBody(req, (bodyErr, body) => {
            if (bodyErr) {
                sendError(res, 400, 'Invalid JSON body');
                return;
            }

            const message = typeof body.message === 'string' ? body.message.trim() : '';
            if (!message) {
                sendError(res, 400, 'Message text is required');
                return;
            }

            const cliAgentId = agentId === 'pita-main' ? 'main' : agentId;
            const args = ['agent', '--agent', cliAgentId, '--message', message, '--json'];

            runOpenClaw(args, (err, stdout, stderr) => {
                if (err) {
                    const output = stderr || stdout || err.message;
                    const retryAfter = extractRetryAfter(output);
                    const providerIssue = extractProviderIssue(output);
                    const statusCode = retryAfter ? 429 : 500;
                    console.warn('OpenClaw send failed, retryAfter=', retryAfter, 'providerIssue=', providerIssue, 'error=', err.message);
                    sendJson(res, {
                        error: `OpenClaw error: ${output}`,
                        retryAfter: retryAfter || undefined,
                        providerIssue: providerIssue || undefined,
                        suggestedAction: providerIssue ? 'select-cheapest-model' : undefined,
                        reply: `Refresh scheduled${retryAfter ? ` in ${retryAfter}s` : ''} for ${cliAgentId}`
                    }, statusCode);
                    return;
                }
                try {
                    const data = JSON.parse(stdout);
                    sendJson(res, data);
                } catch (parseErr) {
                    const output = stderr || stdout || parseErr.message;
                    const retryAfter = extractRetryAfter(output);
                    const providerIssue = extractProviderIssue(output);
                    console.warn('Failed to parse OpenClaw agent response, return fallback reply:', parseErr.message);
                    sendJson(res, {
                        error: 'Failed to parse OpenClaw agent response',
                        retryAfter: retryAfter || undefined,
                        providerIssue: providerIssue || undefined,
                        suggestedAction: providerIssue ? 'select-cheapest-model' : undefined,
                        reply: `Simulated response from ${cliAgentId}: ${message}`
                    }, retryAfter ? 429 : 200);
                }
            });
        });
        return;
    }

    serveStatic(req, res);
});

let triedFallbackPort = false;

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && !process.env.PORT && !triedFallbackPort) {
        triedFallbackPort = true;
        PORT = DEFAULT_PORT + 1;
        console.warn(`Port ${DEFAULT_PORT} is already in use. Trying fallback port ${PORT}...`);
        server.listen(PORT);
        return;
    }
    console.error('Server error:', err);
    process.exit(1);
});

server.listen(PORT, () => {
    console.log(`OpenClaw dashboard server running at http://localhost:${PORT}`);
    console.log('Open the dashboard in your browser at http://localhost:' + PORT + '/dashboard.html');
});
