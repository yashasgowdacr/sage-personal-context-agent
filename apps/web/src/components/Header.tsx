import React from 'react';

interface HeaderProps {
  isConnected: boolean;
  isContextOpen: boolean;
  onToggleContext: () => void;
  onResetDemo: () => void;
  isResetting?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  isConnected,
  isContextOpen,
  onToggleContext,
  onResetDemo,
  isResetting = false,
}) => {
  return (
    <header className="sage-header" id="sage-header">
      <div className="header-brand">
        <div className="logo-container">
          <div className="logo-gem">
            <span className="logo-spark">✧</span>
          </div>
          <div>
            <div className="brand-title-row">
              <h1 className="brand-title">SAGE</h1>
              <span className="brand-badge">Agentic AI</span>
            </div>
            <p className="brand-subtitle">Personal Context & Action Agent</p>
          </div>
        </div>
        <div className="brand-tagline">
          <span>Listen</span> • <span>Remember</span> • <span>Reason</span> • <span>Act</span>
        </div>
      </div>

      <div className="header-actions">
        <div
          className={`status-indicator ${isConnected ? 'status-online' : 'status-offline'}`}
          id="connection-status"
          title={isConnected ? 'Connected to SAGE Orchestrator' : 'Backend Disconnected'}
        >
          <span className="status-dot" />
          <span className="status-text">{isConnected ? 'Online' : 'Offline'}</span>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          id="reset-demo-button"
          onClick={onResetDemo}
          disabled={isResetting}
          title="Clear memories and tasks to reset demo state"
        >
          {isResetting ? (
            <span className="btn-spinner" />
          ) : (
            <span className="btn-icon">↺</span>
          )}
          <span>Reset Demo</span>
        </button>

        <button
          type="button"
          className={`btn btn-icon-only ${isContextOpen ? 'btn-active' : 'btn-secondary'}`}
          id="context-toggle"
          onClick={onToggleContext}
          title="Toggle Context Panel (Memories & Tasks)"
          aria-label="Toggle Context Panel"
        >
          <span className="icon">🧠</span>
          <span className="context-btn-label">Context</span>
        </button>
      </div>
    </header>
  );
};
