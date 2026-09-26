import React, { useState, useEffect, useRef, useCallback } from 'react';

// Web Speech API interface declarations
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  disabled = false,
}) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Web Speech API
  useEffect(() => {
    const win = window as unknown as IWindow;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechRecognition) {
      setVoiceSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceError(null);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInput((prev) => {
            const trimmed = prev.trim();
            return trimmed ? `${trimmed} ${transcript}` : transcript;
          });
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error !== 'no-speech') {
          setVoiceError(`Voice recognition: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setVoiceSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const handleToggleVoice = useCallback(() => {
    if (!voiceSupported) return;

    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      try {
        recognitionRef.current?.start();
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
      }
    }
  }, [isListening, voiceSupported]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading || disabled) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
    }

    onSendMessage(trimmed);
    setInput('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto adjust height
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 160)}px`;
  };

  return (
    <div className="chat-input-wrapper">
      {voiceError && (
        <div className="voice-notice voice-notice-error">
          <span>{voiceError}</span>
          <button
            type="button"
            className="notice-close"
            onClick={() => setVoiceError(null)}
          >
            ×
          </button>
        </div>
      )}

      {isListening && (
        <div className="voice-active-indicator" id="voice-listening-indicator">
          <span className="pulse-dot" />
          <span>Browser Voice Input: Listening... Speak naturally</span>
        </div>
      )}

      <form className="chat-input-form" onSubmit={handleSubmit} id="chat-form">
        <textarea
          ref={textareaRef}
          id="message-input"
          className="chat-textarea"
          placeholder={
            isListening
              ? 'Listening to speech...'
              : 'Ask SAGE, save a memory, or manage tasks... (Enter to send)'
          }
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={isLoading || disabled}
          rows={1}
          aria-label="Chat input"
        />

        <div className="input-controls">
          <button
            type="button"
            id="voice-button"
            className={`btn-voice ${isListening ? 'btn-voice-active' : ''} ${
              !voiceSupported ? 'btn-voice-disabled' : ''
            }`}
            onClick={handleToggleVoice}
            disabled={!voiceSupported || isLoading || disabled}
            title={
              voiceSupported
                ? isListening
                  ? 'Stop Voice Input'
                  : 'Browser Voice Input (Speech-to-Text)'
                : 'Voice input is not supported in this browser.'
            }
            aria-label="Browser Voice Input"
          >
            <span className="voice-icon">{isListening ? '🔴' : '🎤'}</span>
          </button>

          <button
            type="submit"
            id="send-button"
            className="btn btn-primary btn-send"
            disabled={!input.trim() || isLoading || disabled}
            aria-label="Send message"
          >
            {isLoading ? (
              <span className="btn-spinner" />
            ) : (
              <span className="send-arrow">➔</span>
            )}
          </button>
        </div>
      </form>

      <div className="input-footer">
        <span className="input-hint">
          <strong>Enter</strong> to send • <strong>Shift + Enter</strong> for new line
        </span>
        <span className="voice-disclaimer">
          🎤 Browser Speech-to-Text • Omi Wearable Webhook Connected
        </span>
      </div>
    </div>
  );
};
