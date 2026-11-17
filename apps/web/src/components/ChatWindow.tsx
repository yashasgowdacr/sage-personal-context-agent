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
  'Remember that I focus best in the evening.',
  'What do you remember about me?',
  'Add “Finish the project brief” to my tasks.',
  'What should I focus on this evening?',
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
          <p className="welcome-kicker">PERSONAL OPERATIONS</p>
          <h2 className="welcome-title">A clearer way to move forward.</h2>
          <p className="welcome-tagline">
            Remember what matters. Act with confidence.
          </p>
          <p className="welcome-desc">
            SAGE keeps your priorities, preferences, and next steps in view—so you can spend less time organizing and more time doing.
          </p>

          <div className="suggestions-container">
            <span className="suggestions-title">Start with a request</span>
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
                  <span>"{text}"</span>
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

          {/* SAGE Thinking / Reasoning indicator */}
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
