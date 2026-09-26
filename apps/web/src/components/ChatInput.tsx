import React, { useState, useEffect, useRef, useCallback } from 'react';

interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

type VoiceState = 'idle' | 'listening' | 'processing';

/**
 * Normalizes text for comparison by trimming, collapsing whitespace, and lowercasing.
 */
export function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Appends a new final transcript chunk safely without duplicating previous final text or word overlaps.
 */
export function appendFinalTranscript(currentFinal: string, newChunk: string): string {
  const trimmedChunk = newChunk.trim();
  if (!trimmedChunk) return currentFinal;
  if (!currentFinal) return trimmedChunk;

  const normCurrent = normalizeText(currentFinal);
  const normChunk = normalizeText(trimmedChunk);

  // Exact duplicate: do not append again
  if (normCurrent === normChunk) {
    return currentFinal;
  }

  // The new chunk is a superset of the existing transcript starting from the beginning
  // e.g. current = "Schedule an", chunk = "Schedule an appointment"
  if (normChunk.startsWith(normCurrent)) {
    return trimmedChunk;
  }

  // The existing transcript already ends with the new chunk
  // e.g. current = "Schedule an appointment", chunk = "appointment"
  if (normCurrent.endsWith(normChunk)) {
    return currentFinal;
  }

  // Check for word-level boundary overlap
  // e.g. current = "Schedule an", chunk = "an appointment"
  const currentWords = currentFinal.split(/\s+/);
  const chunkWords = trimmedChunk.split(/\s+/);
  const maxOverlap = Math.min(currentWords.length, chunkWords.length);

  for (let overlap = maxOverlap; overlap > 0; overlap--) {
    const currentEnd = currentWords
      .slice(-overlap)
      .map((w) => w.toLowerCase())
      .join(' ');
    const chunkStart = chunkWords
      .slice(0, overlap)
      .map((w) => w.toLowerCase())
      .join(' ');
    if (currentEnd === chunkStart) {
      const nonOverlappingChunk = chunkWords.slice(overlap).join(' ');
      return nonOverlappingChunk
        ? `${currentFinal} ${nonOverlappingChunk}`
        : currentFinal;
    }
  }

  return `${currentFinal} ${trimmedChunk}`;
}

/**
 * Combines base manually typed text with speech recognition text without duplicating existing text.
 */
export function combineInput(base: string, speech: string): string {
  const trimmedSpeech = speech.trim();
  const trimmedBase = base.trim();

  if (!trimmedSpeech) return base;
  if (!trimmedBase) return trimmedSpeech;

  const normBase = normalizeText(trimmedBase);
  const normSpeech = normalizeText(trimmedSpeech);

  // If speech is identical to base
  if (normSpeech === normBase) {
    return trimmedBase;
  }

  // If speech already starts with base text (e.g. typed "Please" and spoken "Please schedule an appointment")
  if (normSpeech.startsWith(normBase)) {
    return trimmedSpeech;
  }

  // If base already ends with speech text
  if (normBase.endsWith(normSpeech)) {
    return trimmedBase;
  }

  // Check for word-level boundary overlap between base and speech
  // e.g. base = "I want to", speech = "to schedule an appointment"
  const baseWords = trimmedBase.split(/\s+/);
  const speechWords = trimmedSpeech.split(/\s+/);
  const maxOverlap = Math.min(baseWords.length, speechWords.length);

  for (let overlap = maxOverlap; overlap > 0; overlap--) {
    const baseEnd = baseWords
      .slice(-overlap)
      .map((w) => w.toLowerCase())
      .join(' ');
    const speechStart = speechWords
      .slice(0, overlap)
      .map((w) => w.toLowerCase())
      .join(' ');
    if (baseEnd === speechStart) {
      const nonOverlappingSpeech = speechWords.slice(overlap).join(' ');
      const prefix = base.endsWith(' ') ? base : `${base} `;
      return nonOverlappingSpeech
        ? `${prefix}${nonOverlappingSpeech}`
        : trimmedBase;
    }
  }

  // Normal concatenation preserving base's trailing whitespace
  if (/\s$/.test(base)) {
    return `${base}${trimmedSpeech}`;
  }
  return `${base} ${trimmedSpeech}`;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  disabled = false,
}) => {
  const [input, setInput] = useState('');
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Speech session state refs to avoid duplicate accumulation and state race conditions
  const baseInputRef = useRef<string>('');
  const finalTranscriptRef = useRef<string>('');
  const interimTranscriptRef = useRef<string>('');
  const finalizedIndicesRef = useRef<Set<number>>(new Set());
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const win = window as unknown as IWindow;
    const SpeechRecognitionClass =
      win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      setVoiceSupported(true);
    } else {
      setVoiceSupported(false);
    }

    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        160
      )}px`;
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
  }, []);

  const handleToggleVoice = useCallback(() => {
    if (!voiceSupported) {
      setVoiceNotice('Voice input is not supported in this browser.');
      return;
    }

    if (voiceState === 'listening') {
      setVoiceState('processing');
      setVoiceNotice('Browser voice input: Processing voice...');
      stopListening();
      return;
    }

    if (voiceState === 'processing') {
      return;
    }

    // Start fresh recognition session
    const win = window as unknown as IWindow;
    const SpeechRecognitionClass =
      win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setVoiceSupported(false);
      setVoiceNotice('Voice input is not supported in this browser.');
      return;
    }

    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    // Initialize fresh speech session state: preserve manually typed text
    baseInputRef.current = input;
    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    finalizedIndicesRef.current.clear();

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setVoiceState('listening');
      setVoiceNotice('Browser voice input active: Listening...');
    };

    recognition.onresult = (event: any) => {
      let interim = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || '';
        if (!transcript) continue;

        if (result.isFinal) {
          if (!finalizedIndicesRef.current.has(i)) {
            finalizedIndicesRef.current.add(i);
            finalTranscriptRef.current = appendFinalTranscript(
              finalTranscriptRef.current,
              transcript
            );
          }
        } else {
          interim += transcript;
        }
      }

      interimTranscriptRef.current = interim.trim();

      // Construct displayed input from base input + final transcript + interim transcript
      const currentSpeech = [
        finalTranscriptRef.current,
        interimTranscriptRef.current,
      ]
        .filter(Boolean)
        .join(' ')
        .trim();

      const combined = combineInput(baseInputRef.current, currentSpeech);
      setInput(combined);
      adjustTextareaHeight();
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech') {
        if (event.error === 'not-allowed') {
          setVoiceNotice(
            'Microphone permission was denied. Please allow microphone access.'
          );
        } else {
          setVoiceNotice(`Voice recognition error: ${event.error}`);
        }
      } else {
        setVoiceNotice(null);
      }
      setVoiceState('idle');
      interimTranscriptRef.current = '';
      finalizedIndicesRef.current.clear();
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      // Safely commit any lingering interim transcript that did not get isFinal
      if (interimTranscriptRef.current) {
        finalTranscriptRef.current = appendFinalTranscript(
          finalTranscriptRef.current,
          interimTranscriptRef.current
        );
        interimTranscriptRef.current = '';
      }

      const finalSpeech = finalTranscriptRef.current.trim();
      const finalCombined = combineInput(baseInputRef.current, finalSpeech);
      setInput(finalCombined);
      adjustTextareaHeight();

      // Reset temporary speech state
      finalizedIndicesRef.current.clear();
      recognitionRef.current = null;

      // Transition to processing briefly, then return to idle
      setVoiceState('processing');
      setVoiceNotice('Browser voice input: Processing voice...');

      processingTimeoutRef.current = setTimeout(() => {
        setVoiceState('idle');
        setVoiceNotice(null);
      }, 500);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setVoiceState('idle');
      setVoiceNotice('Could not start voice recognition. Please try again.');
    }
  }, [input, voiceState, voiceSupported, stopListening, adjustTextareaHeight]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading || disabled) return;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }

    setVoiceState('idle');
    setVoiceNotice(null);

    onSendMessage(trimmed);
    setInput('');
    baseInputRef.current = '';
    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    finalizedIndicesRef.current.clear();

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
    const val = e.target.value;
    setInput(val);
    if (voiceState === 'idle') {
      baseInputRef.current = val;
    }
    adjustTextareaHeight();
  };

  const isListening = voiceState === 'listening';
  const isProcessing = voiceState === 'processing';

  return (
    <div className="chat-input-wrapper" id="chat-input-wrapper">
      {voiceNotice && (
        <div
          className={`voice-notice ${
            isListening ? 'voice-notice-active' : ''
          }`}
        >
          <span>{voiceNotice}</span>
          <button
            type="button"
            className="notice-close"
            onClick={() => setVoiceNotice(null)}
          >
            ×
          </button>
        </div>
      )}

      <form className="chat-input-form" onSubmit={handleSubmit} id="chat-form">
        <textarea
          ref={textareaRef}
          id="message-input"
          className="chat-textarea"
          placeholder={
            isListening
              ? 'Listening to speech (browser voice input)...'
              : isProcessing
              ? 'Processing voice...'
              : 'Ask SAGE anything...'
          }
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={isLoading || disabled}
          rows={1}
          aria-label="Ask SAGE anything"
        />

        <div className="input-controls">
          <button
            type="button"
            id="voice-button"
            className={`btn-voice ${
              isListening
                ? 'btn-voice-listening btn-voice-active'
                : isProcessing
                ? 'btn-voice-processing'
                : ''
            } ${!voiceSupported ? 'btn-voice-disabled' : ''}`}
            onClick={handleToggleVoice}
            disabled={isLoading || disabled}
            title={
              voiceSupported
                ? isListening
                  ? 'Stop browser voice input'
                  : isProcessing
                  ? 'Processing voice...'
                  : 'Browser voice input'
                : 'Voice input is not supported in this browser.'
            }
            aria-label={
              voiceSupported
                ? isListening
                  ? 'Listening to browser voice input'
                  : isProcessing
                  ? 'Processing voice input'
                  : 'Browser voice input'
                : 'Voice input is not supported in this browser.'
            }
          >
            {isListening ? (
              <span className="voice-btn-content">
                <span className="voice-icon">🔴</span>
                <span className="voice-state-text">Listening...</span>
              </span>
            ) : isProcessing ? (
              <span className="voice-btn-content">
                <span className="voice-icon btn-spinner-voice">◌</span>
                <span className="voice-state-text">Processing voice...</span>
              </span>
            ) : (
              <span className="voice-icon">🎤</span>
            )}
          </button>

          <button
            type="submit"
            id="send-button"
            className="btn btn-primary btn-send"
            disabled={!input.trim() || isLoading || disabled}
            aria-label="Send message"
            title="Send (Enter)"
          >
            {isLoading ? (
              <span className="btn-spinner" />
            ) : (
              <span className="send-arrow">➤</span>
            )}
          </button>
        </div>
      </form>

      <div className="input-footer">
        <span className="input-hint">
          <strong>Enter</strong> to send • <strong>Shift + Enter</strong> for new line
        </span>
        <span className="voice-label-tag">
          🎤 Browser voice input • Wearable Omi Webhook Active
        </span>
      </div>
    </div>
  );
};
