const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();
if (fs.existsSync('/app/data/development.env')) {
    dotenv.config({ path: '/app/data/development.env', override: false });
}
const colocatedDevEnv = path.resolve(__dirname, '../../EmployeeAgent-Core/server/development.env');
if (process.env.NODE_ENV !== 'production' && fs.existsSync(colocatedDevEnv)) {
    dotenv.config({ path: colocatedDevEnv, override: false });
}

const { initDb } = require('./db.cjs');
const { requireZtaAgentAuth } = require('./ztaVerifier.cjs');
const coreClient = require('./coreClient.cjs');
const mcpChatRouter = require('./routes/mcpChat.cjs');

const app = express();
const PORT = parseInt(process.env.PORT || '8092', 10);

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check (unauthenticated for Docker/ALB/Store probe)
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        plugin: 'mcp-chat',
        version: '1.1.0',
        timestamp: new Date().toISOString()
    });
});

// Plugin context endpoint (returns user info & capabilities from ZTA Agent JWT)
app.get('/api/mcp/context', requireZtaAgentAuth('read'), (req, res) => {
    res.json({
        user: req.user,
        capabilities: Array.isArray(req.agentAuth?.capabilities)
            ? req.agentAuth.capabilities
            : ['capability:knowledge-store']
    });
});

// Safe client config (mcpQuickPrompts etc.) proxied via EA-Core Host API
app.get('/api/mcp/config', requireZtaAgentAuth('read'), async (req, res) => {
    try {
        const cfg = await coreClient.fetchMcpConfig(req.agentToken, req.eaHostUrl);
        res.json({
            mcpQuickPrompts: Array.isArray(cfg.mcpQuickPrompts) ? cfg.mcpQuickPrompts : []
        });
    } catch (err) {
        console.error('[MCP Plugin] Failed to fetch config from core:', err.message);
        res.json({ mcpQuickPrompts: [] });
    }
});

// Knowledge saving proxies for SaveToKnowledgeModal
app.get('/api/mcp/pods', requireZtaAgentAuth('read'), async (req, res) => {
    try {
        const data = await coreClient.fetchPodsViaCore(req.agentToken, req.eaHostUrl);
        res.json(Array.isArray(data.pods) ? data.pods : (Array.isArray(data) ? data : []));
    } catch (err) {
        console.error('[MCP Plugin] Failed to fetch pods:', err.message);
        res.status(err.status || 500).json({ error: err.message });
    }
});

app.post('/api/mcp/knowledge/publish', requireZtaAgentAuth('execute'), async (req, res) => {
    try {
        const data = await coreClient.publishKnowledgeReportViaCore(req.agentToken, req.body, req.eaHostUrl);
        res.json(data);
    } catch (err) {
        console.error('[MCP Plugin] Failed to publish knowledge report:', err.message);
        res.status(err.status || 500).json({ error: err.message });
    }
});

app.post('/api/mcp/knowledge', requireZtaAgentAuth('execute'), async (req, res) => {
    try {
        const data = await coreClient.saveKnowledgeArticleViaCore(req.agentToken, req.body, req.eaHostUrl);
        res.status(201).json(data);
    } catch (err) {
        console.error('[MCP Plugin] Failed to save knowledge article:', err.message);
        res.status(err.status || 500).json({ error: err.message });
    }
});

// MCP Chat, Tasks & Meta endpoints (ZTA Agent JWT verified)
app.use('/api/mcp/chat', requireZtaAgentAuth('execute'), mcpChatRouter);
app.use('/api/mcp/tasks', requireZtaAgentAuth('execute'), mcpChatRouter);
app.use('/api/mcp/meta', requireZtaAgentAuth('read'), mcpChatRouter);

// Serve static Vite build
const distDir = path.resolve(__dirname, '../dist');
if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/.*/, (req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
    });
}

initDb()
    .then(() => {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🔌 [ea-widget-mcp-chat] Plugin service listening on http://0.0.0.0:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('❌ [ea-widget-mcp-chat] Failed to initialize SQLite DB:', err);
        process.exit(1);
    });
