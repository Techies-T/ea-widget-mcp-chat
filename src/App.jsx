import React, { useEffect, useState, useCallback } from 'react';
import McpChat from './apps/McpChat';

export default function App() {
  const [context, setContext] = useState(() => ({
    user: window.__EA_HOST_CONTEXT__?.user || null,
    capabilities: window.__EA_HOST_CONTEXT__?.capabilities || ['capability:knowledge-store'],
    initialBriefingReport: null
  }));

  useEffect(() => {
    const onZtaReady = (e) => {
      const detail = e.detail || {};
      setContext((prev) => ({
        ...prev,
        user: detail.user || prev.user,
        capabilities: Array.isArray(detail.capabilities) ? detail.capabilities : prev.capabilities
      }));
    };

    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'EA_WIDGET_PROPS' && msg.props) {
        setContext((prev) => ({
          ...prev,
          initialBriefingReport: msg.props.initialBriefingReport ?? prev.initialBriefingReport,
          capabilities: Array.isArray(msg.props.capabilities) ? msg.props.capabilities : prev.capabilities
        }));
      }
    };

    window.addEventListener('ea-zta-ready', onZtaReady);
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('ea-zta-ready', onZtaReady);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleOpenApp = useCallback((windowId, appType, title, props = {}) => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        { type: 'EA_OPEN_APP', payload: { windowId, appType, title, props } },
        window.location.origin
      );
    }
  }, []);

  return (
    <div className="w-full h-full overflow-hidden">
      <McpChat
        user={context.user}
        capabilities={context.capabilities}
        initialBriefingReport={context.initialBriefingReport}
        onOpen={handleOpenApp}
      />
    </div>
  );
}
