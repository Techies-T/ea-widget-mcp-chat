import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Rewrite /api/* calls and attach ZTA Agent JWT when running behind EA-Core /plugin-proxy/mcp-chat/
const proxyMatch = window.location.pathname.match(/^(\/plugin-proxy\/[^/]+)/);
const proxyPrefix = proxyMatch ? proxyMatch[1] : '';

let currentZtaToken = null;
let resolveTokenReady = null;
const tokenReadyPromise = new Promise((resolve) => {
  resolveTokenReady = resolve;
});

window.__EA_HOST_CONTEXT__ = {
  user: null,
  capabilities: ['capability:knowledge-store'],
  widgetLevel: 'execute'
};

window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return;
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'ZTA_AUTH_TOKEN' && msg.payload?.token) {
    currentZtaToken = msg.payload.token;
    window.__EA_HOST_CONTEXT__ = {
      user: msg.payload.user || null,
      capabilities: Array.isArray(msg.payload.capabilities)
        ? msg.payload.capabilities
        : ['capability:knowledge-store'],
      widgetLevel: msg.payload.widgetLevel || 'execute'
    };
    if (resolveTokenReady) {
      resolveTokenReady(currentZtaToken);
      resolveTokenReady = null;
    }
    window.dispatchEvent(new CustomEvent('ea-zta-ready', { detail: window.__EA_HOST_CONTEXT__ }));
  }
});

if (window.parent && window.parent !== window) {
  window.parent.postMessage({ type: 'EA_PLUGIN_READY', widgetId: 'mcp-chat' }, window.location.origin);
}

const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  if (typeof input === 'string' && input.startsWith('/api/')) {
    // Wait briefly for ZTA token from PluginHostFrame when embedded
    if (!currentZtaToken && window.parent && window.parent !== window) {
      await Promise.race([
        tokenReadyPromise,
        new Promise((r) => setTimeout(r, 3000))
      ]);
    }

    let rewritten = input;
    if (rewritten === '/api/config') {
      rewritten = '/api/mcp/config';
    } else if (rewritten === '/api/pods') {
      rewritten = '/api/mcp/pods';
    } else if (rewritten.startsWith('/api/knowledge')) {
      rewritten = rewritten.replace(/^\/api\/knowledge/, '/api/mcp/knowledge');
    }

    const headers = new Headers(init?.headers || {});
    if (currentZtaToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${currentZtaToken}`);
    }

    return originalFetch(`${proxyPrefix}${rewritten}`, { ...init, headers });
  }
  return originalFetch(input, init);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
