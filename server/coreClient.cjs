const DEFAULT_EA_CORE_URL = (process.env.EA_CORE_INTERNAL_URL || 'http://localhost:8080').replace(/\/$/, '');

async function callCoreHostApi(endpointPath, agentToken, { method = 'GET', body = undefined, hostUrl = '' } = {}) {
    const baseUrl = (hostUrl || DEFAULT_EA_CORE_URL).replace(/\/$/, '');
    const headers = {
        Authorization: `Bearer ${agentToken}`
    };
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${baseUrl}/api/core/host${endpointPath}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined
    });

    if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        const err = new Error(errPayload.error || `Core Host API ${endpointPath} returned HTTP ${res.status}`);
        err.status = res.status;
        throw err;
    }

    return res.json();
}

async function fetchMcpMeta(agentToken, hostUrl) {
    return callCoreHostApi('/mcp/meta', agentToken, { hostUrl });
}

async function fetchMcpTools(agentToken, { message = '', serverIds = null, pipelineDomain = '' } = {}, hostUrl) {
    return callCoreHostApi('/mcp/tools', agentToken, {
        method: 'POST',
        body: { message, serverIds, pipelineDomain },
        hostUrl
    });
}

async function callMcpToolViaCore(agentToken, { funcName, funcArgs, userMessage = '' }, hostUrl) {
    const data = await callCoreHostApi('/mcp/call', agentToken, {
        method: 'POST',
        body: { funcName, funcArgs, userMessage },
        hostUrl
    });
    return data.result;
}

async function fetchMcpConfig(agentToken, hostUrl) {
    return callCoreHostApi('/mcp/config', agentToken, { hostUrl });
}

async function fetchPodsViaCore(agentToken, hostUrl) {
    return callCoreHostApi('/pods', agentToken, { hostUrl });
}

async function publishKnowledgeReportViaCore(agentToken, payload, hostUrl) {
    return callCoreHostApi('/knowledge/publish', agentToken, {
        method: 'POST',
        body: payload,
        hostUrl
    });
}

async function saveKnowledgeArticleViaCore(agentToken, payload, hostUrl) {
    return callCoreHostApi('/knowledge', agentToken, {
        method: 'POST',
        body: payload,
        hostUrl
    });
}

module.exports = {
    DEFAULT_EA_CORE_URL,
    fetchMcpMeta,
    fetchMcpTools,
    callMcpToolViaCore,
    fetchMcpConfig,
    fetchPodsViaCore,
    publishKnowledgeReportViaCore,
    saveKnowledgeArticleViaCore
};
