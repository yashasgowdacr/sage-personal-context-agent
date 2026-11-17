import React from 'react';
import type { ChatMessage } from '../types/sage';

function renderLine(line: string): React.ReactNode {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

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
          {message.content.split('\n').map((line, idx) => {
            const trimmed = line.trim();
            if (!trimmed) return <div key={idx} className="message-spacer" />;
            if (/^[-•]\s/.test(trimmed)) {
              return <div key={idx} className="message-list-line"><span>•</span>{renderLine(trimmed.replace(/^[-•]\s+/, ''))}</div>;
            }
            return <p key={idx}>{renderLine(trimmed)}</p>;
          })}
        </div>

        {/* Safety Gate Confirmation Card */}
        {message.requiresConfirmation && onConfirmAction && (
          <div className="confirmation-card" id="confirmation-card">
            <div className="confirmation-header">
              <span className="confirmation-icon">⚠️</span>
              <span className="confirmation-title">Action Confirmation Required</span>
            </div>
            <p className="confirmation-prompt">
              {message.requiresConfirmation.message ||
                `This action will modify your records. Do you want SAGE to continue?`}
            </p>
            <div className="confirmation-actions">
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
              <button
                type="button"
                className="btn btn-danger btn-sm"
                id="btn-confirm-action"
                disabled={isProcessingAction}
                onClick={() =>
                  onConfirmAction(message.requiresConfirmation!.confirmationToken)
                }
              >
                {isProcessingAction ? 'Executing...' : 'Confirm'}
              </button>
            </div>
          </div>
        )}

        {isUser && <span className="bubble-time-user">{message.timestamp}</span>}
      </div>
    </div>
  );
};
