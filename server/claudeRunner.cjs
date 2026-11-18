const crypto = require('crypto');

// Claude conversation cache for multi-turn continuity
const claudeConversations = new Map();

function isClaudeModel(modelName) {
    return typeof modelName === 'string' && modelName.toLowerCase().includes('claude');
}

function cleanModelId(modelName, fallback = 'claude-sonnet-4-6') {
    if (!modelName) return fallback;
    return String(modelName).replace(/^models\//, '').trim() || fallback;
}

function isTemperatureDeprecatedModel(modelId) {
    const id = String(modelId || '').toLowerCase();
    return id.includes('claude-opus-4-7') || id.includes('claude-opus-4.7');
}

async function callAnthropicMessages(apiKey, payload) {
    const headers = {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
    };

    const finalPayload = { ...payload };
    if (isTemperatureDeprecatedModel(finalPayload.model)) {
        delete finalPayload.temperature;
    }

    const doFetch = async (bodyObj) => {
        const MAX_ATTEMPTS = 4;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                return await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(bodyObj)
                });
            } catch (netErr) {
                if (attempt < MAX_ATTEMPTS) {
                    console.warn(`[Anthropic API] Network transient error (${netErr.message}), retrying (${attempt + 1}/${MAX_ATTEMPTS})...`);
                    await new Promise(r => setTimeout(r, attempt * 1200));
                } else {
                    throw netErr;
                }
            }
        }
    };

    let res = await doFetch(finalPayload);
    let data = await res.json().catch(() => ({}));

    if (!res.ok && data?.error?.message && data.error.message.includes('temperature') && 'temperature' in finalPayload) {
        delete finalPayload.temperature;
        res = await doFetch(finalPayload);
        data = await res.json().catch(() => ({}));
    }

    if (!res.ok && data?.error?.message && data.error.message.includes('max_tokens') && finalPayload.max_tokens > 4096) {
        const matchLimit = data.error.message.match(/maximum.*?(?:is|:)\s*(\d+)/i) || data.error.message.match(/<=\s*(\d+)/);
        const fallbackMax = matchLimit ? parseInt(matchLimit[1], 10) : (finalPayload.max_tokens > 8192 ? 8192 : 4096);
        finalPayload.max_tokens = fallbackMax;
        res = await doFetch(finalPayload);
        data = await res.json().catch(() => ({}));
    }

    if (!res.ok) {
        const errMsg = data?.error?.message || `Anthropic API Error (${res.status})`;
        throw new Error(errMsg);
    }
    return data;
}

function normalizeClaudeUsage(usage) {
    if (!usage) return null;
    const inputTokens = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
    const outputTokens = usage.output_tokens || 0;
    return {
        promptTokenCount: inputTokens,
        candidatesTokenCount: outputTokens,
        totalTokenCount: inputTokens + outputTokens,
        input_tokens: inputTokens,
        output_tokens: outputTokens
    };
}

function extractTextFromClaudeContent(contentBlocks) {
    if (!Array.isArray(contentBlocks)) return '';
    return contentBlocks
        .filter(b => b && b.type === 'text' && typeof b.text === 'string')
        .map(b => b.text)
        .join('\n')
        .trim();
}

function convertMcpToolsToClaudeFormat(mcpTools = []) {
    const claudeTools = [];
    for (const t of mcpTools) {
        if (!t || !t.name) continue;
        const rawSchema = t.parameters || t.inputSchema || { type: 'object', properties: {} };
        claudeTools.push({
            name: t.name,
            description: t.description || `Execute MCP tool ${t.name}`,
            input_schema: {
                type: 'object',
                properties: rawSchema.properties || {},
                required: Array.isArray(rawSchema.required) ? rawSchema.required : []
            }
        });
    }
    return claudeTools;
}

async function runClaudeMcpWorkflow({
    apiKey,
    model,
    user,
    message,
    previous_interaction_id,
    mcpTools = [],
    callMcpTool,
    systemInstruction = '',
    maxTurns = 15,
    onProgress,
    checkCancelled,
    req
}) {
    const targetModel = cleanModelId(model, 'claude-sonnet-4-6');
    const claudeTools = convertMcpToolsToClaudeFormat(mcpTools);

    let sessionMessages = [];
    if (previous_interaction_id && claudeConversations.has(previous_interaction_id)) {
        sessionMessages = [...claudeConversations.get(previous_interaction_id)];
    }

    sessionMessages.push({
        role: 'user',
        content: message
    });

    const artifacts = [];
    let turnCount = 0;
    let remainingTurns = maxTurns;
    let finalResponseText = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    if (onProgress) {
        onProgress(`Claude (${targetModel}) にリクエストを送信し、実行計画を策定中...`, 0);
    }

    while (remainingTurns > 0) {
        if (checkCancelled && await checkCancelled()) {
            throw new Error('タスクがユーザーによりキャンセルされました');
        }

        remainingTurns--;
        turnCount++;

        const payload = {
            model: targetModel,
            max_tokens: 16384,
            temperature: 0.2,
            system: systemInstruction,
            messages: sessionMessages
        };

        if (claudeTools.length > 0 && remainingTurns > 0) {
            payload.tools = claudeTools;
        }

        const response = await callAnthropicMessages(apiKey, payload);
        if (response.usage) {
            const u = normalizeClaudeUsage(response.usage);
            totalInputTokens += u.promptTokenCount;
            totalOutputTokens += u.candidatesTokenCount;
        }

        const contentBlocks = Array.isArray(response.content) ? response.content : [];
        const currentText = extractTextFromClaudeContent(contentBlocks);
        if (currentText) {
            finalResponseText = currentText;
        }

        sessionMessages.push({
            role: 'assistant',
            content: contentBlocks
        });

        const toolUseBlocks = contentBlocks.filter(b => b && b.type === 'tool_use');
        if (response.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
            break;
        }

        const toolNames = toolUseBlocks.map(b => b.name).join(', ');
        if (onProgress) {
            onProgress(`MCPツール「${toolNames}」を実行中...`, turnCount);
        }

        const toolResultsContent = [];
        for (const call of toolUseBlocks) {
            const funcName = call.name;
            const funcArgs = call.input || {};
            const toolUseId = call.id;

            try {
                const result = await callMcpTool(funcName, funcArgs, user?.allowed_widgets || [], user, req, message);
                artifacts.push({ tool: funcName, args: funcArgs, result });
                const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
                toolResultsContent.push({
                    type: 'tool_result',
                    tool_use_id: toolUseId,
                    content: resultStr.substring(0, 50000)
                });
            } catch (err) {
                toolResultsContent.push({
                    type: 'tool_result',
                    tool_use_id: toolUseId,
                    is_error: true,
                    content: JSON.stringify({ error: err.message })
                });
            }
        }

        sessionMessages.push({
            role: 'user',
            content: toolResultsContent
        });

        if (onProgress) {
            onProgress(`ツールの実行結果を Claude (${targetModel}) に反映中...`, turnCount);
        }
    }

    if (!finalResponseText && artifacts.length > 0) {
        if (onProgress) onProgress('ツール実行結果を元にダッシュボードと回答を合成中...', turnCount + 1);
        const artifactsContext = artifacts.map((a, idx) => {
            const queryInfo = a.args?.query || a.args?.sql || JSON.stringify(a.args);
            const resultStr = typeof a.result === 'string' ? a.result : JSON.stringify(a.result);
            return `### クエリ ${idx + 1} (${a.tool})\n実行パラメータ: ${queryInfo}\n取得データ:\n${resultStr.substring(0, 15000)}`;
        }).join('\n\n');

        const synthRes = await callAnthropicMessages(apiKey, {
            model: targetModel,
            max_tokens: 16384,
            temperature: 0.2,
            system: systemInstruction,
            messages: [{
                role: 'user',
                content: `ユーザーからの要求:\n「${message}」\n\nMCPツールにより取得された以下の結果を参照してください:\n\n${artifactsContext}\n\n上記の取得実データを詳細に分析し、インタラクティブなHTMLダッシュボード（\`\`\`html ... \`\`\`コードブロック内）と詳細な解説を必ず日本語で出力してください。`
            }]
        });
        finalResponseText = extractTextFromClaudeContent(synthRes.content || []);
        if (synthRes.usage) {
            const u = normalizeClaudeUsage(synthRes.usage);
            totalInputTokens += u.promptTokenCount;
            totalOutputTokens += u.candidatesTokenCount;
        }
    }

    const interactionId = `claude_mcp_${crypto.randomUUID()}`;
    claudeConversations.set(interactionId, sessionMessages);
    if (claudeConversations.size > 100) {
        const firstKey = claudeConversations.keys().next().value;
        claudeConversations.delete(firstKey);
    }

    return {
        response: finalResponseText,
        interaction_id: interactionId,
        artifacts,
        usageMetadata: {
            promptTokenCount: totalInputTokens,
            candidatesTokenCount: totalOutputTokens,
            totalTokenCount: totalInputTokens + totalOutputTokens
        }
    };
}

module.exports = {
    isClaudeModel,
    runClaudeMcpWorkflow
};
