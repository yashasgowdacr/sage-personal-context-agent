import React from 'react';
import type { AgentStatusType } from '../types/sage';

interface HeaderProps {
  status: AgentStatusType;
  username?: string;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  username,
  onLogout,
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
            <p className="brand-subtitle">Your private workspace for context and action</p>
          </div>
        </div>
        <div className="brand-tagline">
          <span>Context</span> • <span>Clarity</span> • <span>Momentum</span>
        </div>
      </div>

      <div className="header-actions">
        <div className="header-user">{username || 'User'}</div>
        {/* Agent Status Indicator */}
        <div className={`status-indicator ${statusClass}`} id="agent-status-badge">
          <span className="status-symbol">{statusIcon}</span>
          <span className="status-label">{statusText}</span>
        </div>
        <button type="button" className="logout-button" onClick={onLogout} title="Log out of this account">Logout</button>

      </div>
    </header>
  );
};
