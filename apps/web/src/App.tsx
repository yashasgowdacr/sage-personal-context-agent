import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { ChatWindow } from './components/ChatWindow';
import { ChatInput } from './components/ChatInput';
import { ContextPanel } from './components/ContextPanel';
import { sageApi } from './services/sageApi';
import type { ChatMessage, SageContextSummary } from './types/sage';

export const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const [contextSummary, setContextSummary] = useState<SageContextSummary>({
    retrievedMemories: [],
    pendingTasks: [],
    recentActions: [],
  });

  // Health check on mount and interval
  useEffect(() => {
    let isMounted = true;

    const checkConnection = async () => {
      const ok = await sageApi.checkHealth();
      if (isMounted) setIsConnected(ok);
    };

    checkConnection();
    const interval = setInterval(checkConnection, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Sync initial tasks when connected
  const refreshContext = useCallback(async () => {
    try {
      const tasks = await sageApi.fetchTasks();
      setContextSummary((prev) => ({
        ...prev,
        pendingTasks: tasks,
      }));
    } catch {
      // safe fallback
    }
  }, []);

  useEffect(() => {
    if (isConnected) {
      refreshContext();
    }
  }, [isConnected, refreshContext]);

  const handleSendMessage = async (
    text: string,
    options?: { confirmed?: boolean; confirmationToken?: string }
  ) => {
    const userMsgId = `msg-${Date.now()}`;
    const userTimestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Add user message if not just a background confirmation
    if (!options?.confirmed) {
      const userMessage: ChatMessage = {
        id: userMsgId,
        role: 'user',
        content: text,
        timestamp: userTimestamp,
      };
      setMessages((prev) => [...prev, userMessage]);
    }

    setIsLoading(true);

    try {
      const res = await sageApi.sendMessage(text, options);
      const sageTimestamp = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      const sageMessage: ChatMessage = {
        id: `sage-${Date.now()}`,
        role: 'assistant',
        content: res.response || (res.success ? 'Action executed.' : 'Failed to process request.'),
        timestamp: sageTimestamp,
        executionEvents: res.executionEvents,
        requiresConfirmation: res.requiresConfirmation,
      };

      setMessages((prev) => [...prev, sageMessage]);

      // Update personal context from response's unified sageContext
      if (res.sageContext) {
        const rawMemories = res.sageContext.retrievedMemories || [];
        const normalizedMemories = rawMemories.map((m: any) => ({
          score: m.score,
          content: m.memory?.content || m.content || String(m),
          type: m.memory?.type || m.type,
        }));

        setContextSummary((prev) => ({
          retrievedMemories:
            normalizedMemories.length > 0 ? normalizedMemories : prev.retrievedMemories,
          pendingTasks: res.sageContext?.pendingTasks ?? prev.pendingTasks,
          recentActions: res.sageContext?.recentActions ?? prev.recentActions,
        }));
      }
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || 'An unexpected error occurred.';
      const errorTimestamp = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: errorMsg,
        timestamp: errorTimestamp,
        isError: true,
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsProcessingAction(false);
    }
  };

  const handleConfirmAction = async (token: string) => {
    setIsProcessingAction(true);
    await handleSendMessage('Confirm destructive action', {
      confirmed: true,
      confirmationToken: token,
    });
  };

  const handleCancelAction = () => {
    const cancelMsg: ChatMessage = {
      id: `cancel-${Date.now()}`,
      role: 'assistant',
      content: 'Action cancelled.',
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setMessages((prev) => [...prev, cancelMsg]);
  };

  const handleResetDemo = async () => {
    if (isResetting) return;
    setIsResetting(true);
    try {
      await sageApi.resetDemoState();
      setContextSummary({
        retrievedMemories: [],
        pendingTasks: [],
        recentActions: [],
      });
      const resetNotice: ChatMessage = {
        id: `reset-${Date.now()}`,
        role: 'system',
        content: '🧹 Demo state reset. Memories, tasks, and recent actions have been cleared.',
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setMessages((prev) => [...prev, resetNotice]);
    } catch (err) {
      alert(`Could not reset demo: ${(err as Error).message}`);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="sage-app" id="sage-app">
      <Header
        isConnected={isConnected}
        isContextOpen={isContextOpen}
        onToggleContext={() => setIsContextOpen((prev) => !prev)}
        onResetDemo={handleResetDemo}
        isResetting={isResetting}
      />

      <div className="sage-main-layout">
        <main className="chat-container">
          <ChatWindow
            messages={messages}
            isLoading={isLoading}
            onSelectSuggestion={(text) => handleSendMessage(text)}
            onConfirmAction={handleConfirmAction}
            onCancelAction={handleCancelAction}
            isProcessingAction={isProcessingAction}
          />
          <ChatInput
            onSendMessage={(text) => handleSendMessage(text)}
            isLoading={isLoading}
            disabled={!isConnected && messages.length > 0}
          />
        </main>

        <ContextPanel
          isOpen={isContextOpen}
          onClose={() => setIsContextOpen(false)}
          contextSummary={contextSummary}
          onRefresh={refreshContext}
        />
      </div>
    </div>
  );
};

export default App;
