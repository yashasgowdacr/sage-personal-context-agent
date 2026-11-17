import React from 'react';
import type { ContextMemoryItem, ContextTaskItem, ConversationSummary } from '../types/sage';

interface ContextPanelProps {
  memories: ContextMemoryItem[];
  tasks: ContextTaskItem[];
  conversations: ConversationSummary[];
  onNewChat: () => void;
  onOpenConversation: (sessionId: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const ContextPanel: React.FC<ContextPanelProps> = ({
  memories,
  tasks,
  conversations,
  onNewChat,
  onOpenConversation,
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
        <section className="sidebar-section conversation-section">
          <div className="section-header-row">
            <span className="section-icon">▱</span>
            <h3 className="section-heading">Recent chats</h3>
            <button type="button" className="new-chat-button" onClick={onNewChat}>New</button>
          </div>
          {conversations.length === 0 ? (
            <div className="empty-state-card">Your saved chats will appear here.</div>
          ) : (
            <ul className="sidebar-list">
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <button type="button" className="conversation-card" onClick={() => onOpenConversation(conversation.id)}>
                    <span className="conversation-title">{conversation.title || 'New conversation'}</span>
                    <span className="conversation-date">{new Date(conversation.updated_at).toLocaleDateString()}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

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

        <div className="sidebar-footer-note">
          <span>Private context sync active</span>
        </div>
      </div>
    </aside>
  );
};
