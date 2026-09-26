import React, { useEffect, useRef } from 'react';
import type { ChatMessage } from '../types/sage';
import { MessageBubble } from './MessageBubble';

interface ChatWindowProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSelectSuggestion: (text: string) => void;
  onConfirmAction?: (token: string) => void;
  onCancelAction?: () => void;
  isProcessingAction?: boolean;
}

const SUGGESTIONS = [
  'Remember that I study best at night.',
  'What should I work on tonight?',
  'Create a task to finish my DBMS assignment tomorrow.',
  'What tasks do I have?',
  'I finished my DBMS assignment.',
  'What tasks do I have left?',
];

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  isLoading,
  onSelectSuggestion,
  onConfirmAction,
  onCancelAction,
  isProcessingAction,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new message or loading change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="chat-window" id="chat-window">
      {messages.length === 0 ? (
        <div className="welcome-screen" id="welcome-screen">
          <div className="welcome-badge">
            <span className="welcome-spark">✧</span>
          </div>
          <h2 className="welcome-title">Welcome to SAGE</h2>
          <p className="welcome-tagline">
            Listen • Remember • Reason • Act
          </p>
          <p className="welcome-desc">
            Your personal context & action agent. I retain memories, manage tasks,
            and fuse long-term context into personalized decisions.
          </p>

          <div className="suggestions-container">
            <span className="suggestions-title">Try asking or instructing:</span>
            <div className="suggestions-grid">
              {SUGGESTIONS.map((text, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="suggestion-chip"
                  onClick={() => onSelectSuggestion(text)}
                  disabled={isLoading}
                >
                  <span className="chip-arrow">›</span>
                  <span>{text}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="messages-list" id="messages-list">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onConfirmAction={onConfirmAction}
              onCancelAction={onCancelAction}
              isProcessingAction={isProcessingAction}
            />
          ))}

          {/* Thinking / Typing indicator */}
          {isLoading && (
            <div className="message-row message-row-sage" id="typing-indicator">
              <div className="sage-avatar" aria-hidden="true">
                <span className="sage-avatar-symbol">S</span>
              </div>
              <div className="message-bubble bubble-sage bubble-typing">
                <div className="typing-dots">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
                <span className="typing-label">SAGE is reasoning...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} className="scroll-anchor" />
        </div>
      )}
    </div>
  );
};
