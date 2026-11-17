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
  ConversationSummary,
} from './types/sage';

export const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatusType>('offline');
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Live Personal Context State from real backend
  const [memories, setMemories] = useState<ContextMemoryItem[]>([]);
  const [tasks, setTasks] = useState<ContextTaskItem[]>([]);
  const [isRefreshingContext, setIsRefreshingContext] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);

  const statusTimerRef = useRef<any>(null);

  // Synchronize with real backend context
  const refreshContext = useCallback(async () => {
    setIsRefreshingContext(true);
    try {
      const data = await sageApi.fetchContext();
      setMemories(data.memories);
      setTasks(data.tasks);
    } catch (err) {
      console.warn('Failed to refresh context:', err);
    } finally {
      setIsRefreshingContext(false);
    }
  }, []);

  const refreshConversations = useCallback(async () => {
    try { setConversations(await sageApi.listConversations()); } catch { setConversations([]); }
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

    sageApi.currentUser().then((ok) => { setAuthenticated(ok); if (ok) { checkConnection(); refreshContext(); refreshConversations(); } });

    const interval = setInterval(checkConnection, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, [refreshContext, refreshConversations]);

  const handleNewChat = () => { sageApi.resetSession(); setMessages([]); };
  const handleOpenConversation = async (sessionId: string) => {
    try { sageApi.selectSession(sessionId); setMessages(await sageApi.fetchConversation(sessionId)); } catch { setMessages([]); }
  };

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

      // 1. Memories used (strictly filter out tasks and only include genuinely used non-task memories)
      const usedMems = (res.memoriesUsed || []).filter((m: any) => {
        const memObj = m?.memory || m;
        return memObj && memObj.type !== 'task';
      });

      for (const m of usedMems) {
        const memObj = (m as any).memory || m;
        const content = memObj.content || String(memObj);
        if (content) {
          const isPref =
            content.toLowerCase().includes('night') ||
            content.toLowerCase().includes('study') ||
            content.toLowerCase().includes('prefer');
          contextUsed.push({
            type: isPref ? 'preference' : 'context',
            title: isPref ? 'Study preference' : 'Stored memory',
            detail: content,
          });
        }
      }

      // 2. Pending tasks used (only when task planning/recommendation context was used)
      const activeTasks = res.sageContext?.pendingTasks || [];
      const isTaskContextRelevant =
        text.toLowerCase().includes('work on') ||
        text.toLowerCase().includes('tonight') ||
        text.toLowerCase().includes('what should i do') ||
        text.toLowerCase().includes('what should i study');

      if (isTaskContextRelevant && activeTasks.length > 0) {
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
      refreshConversations();

      setAgentStatus('online');

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

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault(); setLoginError('');
    try { await sageApi.login(username); setAuthenticated(true); } catch (err) { setLoginError((err as Error).message); }
  };

  const handleLogout = async () => {
    await sageApi.logout();
    setAuthenticated(false);
    setMessages([]);
    setMemories([]);
    setTasks([]);
    setConversations([]);
    setUsername('');
  };

  if (!authenticated) return <main className="login-shell"><div className="login-glow" /><form className="login-card" onSubmit={handleLogin}><div className="login-mark">✧</div><div className="login-eyebrow">PERSONAL CONTEXT AGENT</div><h1>SAGE</h1><p className="login-subtitle">Your private command center for memory, tasks, and action.</p><label>Username<input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username" autoComplete="username" required /></label><button className="login-submit" type="submit">Continue <span>→</span></button>{loginError && <p className="login-error" role="alert">{loginError}</p>}<div className="login-footer">Private workspace · Username access</div></form></main>;

  return (
    <div className="sage-app" id="sage-app">
      <Header
        status={agentStatus}
        username={username || undefined}
        onLogout={handleLogout}
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
          conversations={conversations}
          onNewChat={handleNewChat}
          onOpenConversation={handleOpenConversation}
          onRefresh={refreshContext}
          isRefreshing={isRefreshingContext}
        />
      </div>
    </div>
  );
};

export default App;
