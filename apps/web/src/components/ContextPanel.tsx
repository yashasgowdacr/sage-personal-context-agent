import React from 'react';
import type { SageContextSummary } from '../types/sage';

interface ContextPanelProps {
  isOpen: boolean;
  onClose: () => void;
  contextSummary: SageContextSummary;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const ContextPanel: React.FC<ContextPanelProps> = ({
  isOpen,
  onClose,
  contextSummary,
  onRefresh,
  isRefreshing = false,
}) => {
  if (!isOpen) return null;

  const memories = contextSummary.retrievedMemories || [];
  const tasks = contextSummary.pendingTasks || [];
  const actions = contextSummary.recentActions || [];

  return (
    <aside className="context-panel" id="context-panel" aria-label="Context Panel">
      <div className="context-header">
        <div className="context-title-row">
          <span className="context-icon">🧠</span>
          <h2 className="context-title">Personal Context</h2>
        </div>
        <div className="context-header-actions">
          {onRefresh && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh context"
              aria-label="Refresh context"
            >
              {isRefreshing ? '...' : '↻'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm context-close-btn"
            id="close-context-panel"
            onClick={onClose}
            aria-label="Close Context Panel"
          >
            ✕
          </button>
        </div>
      </div>

      <p className="context-disclaimer">
        High-level state retrieved for decision making. Private thoughts remain confidential.
      </p>

      <div className="context-body">
        {/* Active Tasks Section */}
        <section className="context-section">
          <div className="section-title-row">
            <span className="section-icon">📋</span>
            <h3 className="section-title">Pending Tasks ({tasks.length})</h3>
          </div>
          {tasks.length === 0 ? (
            <div className="empty-context-item">No pending tasks recorded.</div>
          ) : (
            <ul className="context-list">
              {tasks.map((task) => (
                <li key={task.id} className="context-card task-card">
                  <div className="task-title-row">
                    <span className="task-bullet">•</span>
                    <span className="task-title">{task.title}</span>
                  </div>
                  {task.dueAt && (
                    <span className="task-due-badge">Due: {task.dueAt}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Semantic Memories Section */}
        <section className="context-section">
          <div className="section-title-row">
            <span className="section-icon">💾</span>
            <h3 className="section-title">Retrieved Memories ({memories.length})</h3>
          </div>
          {memories.length === 0 ? (
            <div className="empty-context-item">
              No matching memories for latest interaction.
            </div>
          ) : (
            <ul className="context-list">
              {memories.map((mem, idx) => (
                <li key={idx} className="context-card memory-card">
                  <p className="memory-content">"{mem.content}"</p>
                  {mem.score !== undefined && (
                    <span className="memory-score-badge">
                      Relevance: {(mem.score * 100).toFixed(0)}%
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent Actions Section */}
        <section className="context-section">
          <div className="section-title-row">
            <span className="section-icon">⚡</span>
            <h3 className="section-title">Recent Activity</h3>
          </div>
          {actions.length === 0 ? (
            <div className="empty-context-item">No recent actions logged.</div>
          ) : (
            <ul className="context-list">
              {actions.slice(-4).map((action, idx) => (
                <li key={idx} className="context-card action-card">
                  <span className="action-dot" />
                  <span className="action-text">{action}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
};
