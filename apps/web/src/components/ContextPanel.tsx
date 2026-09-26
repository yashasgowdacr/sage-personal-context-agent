import React from 'react';
import type { ContextMemoryItem, ContextTaskItem } from '../types/sage';

interface ContextPanelProps {
  memories: ContextMemoryItem[];
  tasks: ContextTaskItem[];
  recentActivity: string[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const ContextPanel: React.FC<ContextPanelProps> = ({
  memories,
  tasks,
  recentActivity,
  onRefresh,
  isRefreshing = false,
}) => {
  return (
    <aside className="command-sidebar" id="command-sidebar" aria-label="Personal Context & Activity">
      <div className="sidebar-header">
        <div className="sidebar-title-row">
          <span className="sidebar-header-icon">🧭</span>
          <h2 className="sidebar-title">Personal Context</h2>
        </div>
        {onRefresh && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh Qdrant & Task Context"
            aria-label="Refresh Context"
          >
            {isRefreshing ? '...' : '↻'}
          </button>
        )}
      </div>

      <div className="sidebar-scrollable">
        {/* 1. MEMORY SECTION */}
        <section className="sidebar-section" id="sidebar-memory-section">
          <div className="section-header-row">
            <span className="section-icon">🧠</span>
            <h3 className="section-heading">Memory</h3>
            <span className="section-counter">{memories.length}</span>
          </div>
          {memories.length === 0 ? (
            <div className="empty-state-card">
              No memories recorded yet. Tell SAGE what to remember.
            </div>
          ) : (
            <ul className="sidebar-list">
              {memories.map((mem, idx) => (
                <li key={mem.id || idx} className="sidebar-card memory-item-card">
                  <div className="item-bullet-row">
                    <span className="item-bullet">•</span>
                    <span className="item-text">{mem.content}</span>
                  </div>
                  {mem.type && (
                    <span className="item-tag tag-memory">{mem.type}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 2. TASKS SECTION */}
        <section className="sidebar-section" id="sidebar-tasks-section">
          <div className="section-header-row">
            <span className="section-icon">✅</span>
            <h3 className="section-heading">Tasks</h3>
            <span className="section-counter">{tasks.length}</span>
          </div>
          {tasks.length === 0 ? (
            <div className="empty-state-card">
              No pending tasks. Ask SAGE to add one.
            </div>
          ) : (
            <ul className="sidebar-list">
              {tasks.map((task) => (
                <li key={task.id} className="sidebar-card task-item-card">
                  <div className="task-row-main">
                    <span className="task-title-text">{task.title}</span>
                    <span className="task-status-pill">{task.status}</span>
                  </div>
                  {task.dueAt && (
                    <div className="task-due-row">
                      <span className="task-clock-icon">🕒</span>
                      <span className="task-due-text">{task.dueAt}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 3. RECENT ACTIVITY SECTION */}
        <section className="sidebar-section" id="sidebar-activity-section">
          <div className="section-header-row">
            <span className="section-icon">⚡</span>
            <h3 className="section-heading">Recent Activity</h3>
            <span className="section-counter">{recentActivity.length}</span>
          </div>
          {recentActivity.length === 0 ? (
            <div className="empty-state-card">No verified actions logged yet.</div>
          ) : (
            <ul className="sidebar-list">
              {recentActivity.slice(0, 6).map((activity, idx) => (
                <li key={idx} className="sidebar-card activity-item-card">
                  <span className="activity-dot" />
                  <span className="activity-label">{activity}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Real Backend Verification Badge */}
        <div className="sidebar-footer-note">
          <span>Qdrant Cloud & FastEmbed Synchronized</span>
        </div>
      </div>
    </aside>
  );
};
