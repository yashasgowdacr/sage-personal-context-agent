import React from 'react';
import type { ChatMessage } from '../types/sage';

interface MessageBubbleProps {
  message: ChatMessage;
  onConfirmAction?: (token: string) => void;
  onCancelAction?: () => void;
  isProcessingAction?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onConfirmAction,
  onCancelAction,
  isProcessingAction = false,
}) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // Filter high-level execution events for clean user-facing badges (NO raw chain-of-thought)
  const safeBadges = (message.executionEvents || [])
    .filter((e) => e.status === 'completed' && e.label)
    .map((e) => e.label.replace(/^[\s✓○●]+/, ''))
    .filter((label) => {
      const lower = label.toLowerCase();
      return (
        lower.includes('memory') ||
        lower.includes('task') ||
        lower.includes('action') ||
        lower.includes('fused') ||
        lower.includes('verified')
      );
    });

  // Deduplicate badges
  const uniqueBadges = Array.from(new Set(safeBadges)).slice(0, 3);

  return (
    <div
      className={`message-row ${isUser ? 'message-row-user' : 'message-row-sage'} ${
        message.isError ? 'message-row-error' : ''
      }`}
      id={`message-${message.id}`}
    >
      {!isUser && (
        <div className="sage-avatar" aria-hidden="true">
          <span className="sage-avatar-symbol">S</span>
        </div>
      )}

      <div className={`message-bubble ${isUser ? 'bubble-user' : 'bubble-sage'}`}>
        {!isUser && !isSystem && (
          <div className="bubble-header">
            <span className="bubble-author">SAGE</span>
            <span className="bubble-time">{message.timestamp}</span>
          </div>
        )}

        <div className="bubble-content">
          {message.content.split('\n').map((line, idx) => (
            <p key={idx}>{line}</p>
          ))}
        </div>

        {/* Execution Events / Action Tags */}
        {!isUser && uniqueBadges.length > 0 && (
          <div className="bubble-badges">
            {uniqueBadges.map((badge, idx) => (
              <span key={idx} className="event-badge">
                <span className="badge-dot" />
                {badge}
              </span>
            ))}
          </div>
        )}

        {/* Safety Gate Confirmation Card */}
        {message.requiresConfirmation && onConfirmAction && (
          <div className="confirmation-card" id="confirmation-card">
            <div className="confirmation-header">
              <span className="confirmation-icon">⚠️</span>
              <span className="confirmation-title">Action Confirmation Required</span>
            </div>
            <p className="confirmation-prompt">
              {message.requiresConfirmation.message ||
                `Are you sure you want to execute '${message.requiresConfirmation.tool}'? This action cannot be undone.`}
            </p>
            <div className="confirmation-actions">
              <button
                type="button"
                className="btn btn-danger btn-sm"
                id="btn-confirm-action"
                disabled={isProcessingAction}
                onClick={() =>
                  onConfirmAction(message.requiresConfirmation!.confirmationToken)
                }
              >
                {isProcessingAction ? 'Executing...' : 'Yes, Confirm'}
              </button>
              {onCancelAction && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  id="btn-cancel-action"
                  disabled={isProcessingAction}
                  onClick={onCancelAction}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {isUser && <span className="bubble-time-user">{message.timestamp}</span>}
      </div>
    </div>
  );
};
