import React from 'react';
import type { AgentStatusType } from '../types/sage';

interface HeaderProps {
  status: AgentStatusType;
  onResetDemo: () => void;
  isResetting?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  onResetDemo,
  isResetting = false,
}) => {
  // Format Agent Status badge
  let statusClass = 'status-online';
  let statusText = 'SAGE ONLINE';
  let statusIcon = '●';

  if (status === 'thinking') {
    statusClass = 'status-thinking';
    statusText = 'SAGE THINKING';
    statusIcon = '◌';
  } else if (status === 'verified') {
    statusClass = 'status-verified';
    statusText = 'ACTION VERIFIED';
    statusIcon = '✓';
  } else if (status === 'offline') {
    statusClass = 'status-offline';
    statusText = 'SAGE OFFLINE';
    statusIcon = '✕';
  }

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
              <span className="brand-badge">Command Center</span>
            </div>
            <p className="brand-subtitle">Personal Context & Action Agent</p>
          </div>
        </div>
        <div className="brand-tagline">
          <span>Listen</span> • <span>Remember</span> • <span>Reason</span> • <span>Act</span>
        </div>
      </div>

      <div className="header-actions">
        {/* Agent Status Indicator */}
        <div className={`status-indicator ${statusClass}`} id="agent-status-badge">
          <span className="status-symbol">{statusIcon}</span>
          <span className="status-label">{statusText}</span>
        </div>

        {/* Demo Reset Button */}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          id="btn-reset-demo"
          onClick={onResetDemo}
          disabled={isResetting}
          title="Reset memories, tasks, and actions for clean demo"
        >
          {isResetting ? (
            <span className="btn-spinner" />
          ) : (
            <span className="btn-icon">↺</span>
          )}
          <span>Reset Demo</span>
        </button>
      </div>
    </header>
  );
};
