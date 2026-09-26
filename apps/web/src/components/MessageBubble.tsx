import React from 'react';
import type { ChatMessage } from '../types/sage';
import { ActionCard } from './ActionCard';

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
          {message.content.split('\n').map((line, idx) => (
            <p key={idx}>{line}</p>
          ))}
        </div>

        {/* MOST IMPORTANT HACKATHON FEATURE: CONTEXT FUSION INDICATOR */}
        {!isUser && message.contextUsed && message.contextUsed.length > 0 && (
          <div className="context-fusion-indicator" id="context-fusion-box">
            <div className="fusion-header">
              <span className="fusion-icon">🧠</span>
              <span className="fusion-title">Context used</span>
            </div>
            <ul className="fusion-list">
              {message.contextUsed.map((item, idx) => (
                <li key={idx} className="fusion-item">
                  <span className="fusion-bullet">•</span>
                  <span className="fusion-item-title">{item.title}:</span>
                  <span className="fusion-item-detail">"{item.detail}"</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Compact Verified Action Card */}
        {!isUser && message.actionResult && message.actionResult.success && (
          <ActionCard
            tool={message.actionResult.tool}
            success={message.actionResult.success}
            verified={message.actionResult.verified}
            data={message.actionResult.data}
          />
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
