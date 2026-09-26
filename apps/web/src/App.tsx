import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { ChatWindow } from './components/ChatWindow';
import { ChatInput } from './components/ChatInput';
import { ContextPanel } from './components/ContextPanel';
import { sageApi } from './services/sageApi';
import type {
  ChatMessage,
  AgentStatusType,
  ContextMemoryItem,
  ContextTaskItem,
  ContextUsedItem,
} from './types/sage';

export const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatusType>('offline');
  const [isResetting, setIsResetting] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Live Personal Context State from real backend
  const [memories, setMemories] = useState<ContextMemoryItem[]>([]);
  const [tasks, setTasks] = useState<ContextTaskItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<string[]>([]);
  const [isRefreshingContext, setIsRefreshingContext] = useState(false);

  const statusTimerRef = useRef<any>(null);

  // Synchronize with real backend context
  const refreshContext = useCallback(async () => {
    setIsRefreshingContext(true);
    try {
      const data = await sageApi.fetchDemoContext();
      setMemories(data.memories);
      setTasks(data.tasks);
      setRecentActivity(data.recentActions);
    } catch (err) {
      console.warn('Failed to refresh demo context:', err);
    } finally {
      setIsRefreshingContext(false);
    }
  }, []);

  // Health check on mount and interval
  useEffect(() => {
    let isMounted = true;

    const checkConnection = async () => {
      const ok = await sageApi.checkHealth();
      if (isMounted) {
        setAgentStatus((prev) => {
          if (prev === 'thinking' || prev === 'verified') return prev;
          return ok ? 'online' : 'offline';
        });
      }
    };

    checkConnection();
    refreshContext();

    const interval = setInterval(checkConnection, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, [refreshContext]);

  const handleSendMessage = async (
    text: string,
    options?: { confirmed?: boolean; confirmationToken?: string }
  ) => {
    const userTimestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (!options?.confirmed) {
      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: userTimestamp,
      };
      setMessages((prev) => [...prev, userMessage]);
    }

    setIsLoading(true);
    setAgentStatus('thinking');

    try {
      const res = await sageApi.sendMessage(text, options);
      const sageTimestamp = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      // Extract Context Fusion indicators
      const contextUsed: ContextUsedItem[] = [];

      // 1. Memories used
      const usedMems = res.sageContext?.retrievedMemories || res.memoriesUsed || [];
      for (const m of usedMems) {
        const memObj = (m as any).memory || m;
        const content = memObj.content || String(memObj);
        if (content) {
          const isPref = content.toLowerCase().includes('night') || content.toLowerCase().includes('study') || content.toLowerCase().includes('prefer');
          contextUsed.push({
            type: isPref ? 'preference' : 'context',
            title: isPref ? 'Study preference' : 'Personal preference',
            detail: content,
          });
        }
      }

      // 2. Pending tasks used
      const activeTasks = res.sageContext?.pendingTasks || [];
      if (text.toLowerCase().includes('work on') || text.toLowerCase().includes('tonight') || text.toLowerCase().includes('what should i')) {
        for (const t of activeTasks) {
          contextUsed.push({
            type: 'task',
            title: 'Pending task',
            detail: `${t.title}${t.dueAt ? ` (due: ${t.dueAt})` : ''}`,
          });
        }
      }

      const sageMessage: ChatMessage = {
        id: `sage-${Date.now()}`,
        role: 'assistant',
        content: res.response || (res.success ? 'Action executed.' : 'Failed to process request.'),
        timestamp: sageTimestamp,
        executionEvents: res.executionEvents,
        actionResult: res.actionResult,
        contextUsed: contextUsed.length > 0 ? contextUsed : undefined,
        requiresConfirmation: res.requiresConfirmation,
      };

      setMessages((prev) => [...prev, sageMessage]);

      // Set verified action status if verified
      if (res.actionResult?.verified) {
        setAgentStatus('verified');
        if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
        statusTimerRef.current = setTimeout(() => {
          setAgentStatus('online');
        }, 3500);
      } else {
        setAgentStatus('online');
      }

      // Refresh live backend context sidebar
      await refreshContext();
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
      setAgentStatus('online');
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
      await refreshContext();
      const resetNotice: ChatMessage = {
        id: `reset-${Date.now()}`,
        role: 'system',
        content: '🧹 Demo state reset. Qdrant memories and tasks cleared.',
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
        status={agentStatus}
        onResetDemo={handleResetDemo}
        isResetting={isResetting}
      />

      <div className="sage-main-layout">
        {/* LEFT / MAIN AREA — CONVERSATION */}
        <main className="chat-container" id="chat-container">
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
            disabled={agentStatus === 'offline' && messages.length > 0}
          />
        </main>

        {/* RIGHT SIDEBAR — PERSONAL CONTEXT & AGENT ACTIVITY */}
        <ContextPanel
          memories={memories}
          tasks={tasks}
          recentActivity={recentActivity}
          onRefresh={refreshContext}
          isRefreshing={isRefreshingContext}
        />
      </div>
    </div>
  );
};

export default App;
