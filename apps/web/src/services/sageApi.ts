import type { OrchestrationApiResponse, HealthStatus, ContextState, ConversationSummary, ChatMessage } from '../types/sage';

// Default to configured environment variable or fallback to empty string (Vite proxy)
const API_BASE_URL = (import.meta.env.VITE_SAGE_API_URL || '').replace(/\/+$/, '');

export let USER_ID = '';

export class SageApiService {
  private baseUrl: string;
  private sessionId: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.sessionId = `command-center-${Date.now()}`;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  resetSession(): void {
    this.sessionId = `command-center-${Date.now()}`;
  }

  selectSession(sessionId: string): void {
    this.sessionId = sessionId;
  }

  async login(username: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/auth/login`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Login failed');
    USER_ID = data.userId;
  }

  async logout(): Promise<void> {
    await fetch(`${this.baseUrl}/auth/logout`, { method: 'POST', credentials: 'include' });
    USER_ID = '';
    this.resetSession();
  }

  async currentUser(): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/auth/me`, { credentials: 'include' });
    const data = await res.json().catch(() => null);
    USER_ID = data?.userId || '';
    return Boolean(data?.authenticated);
  }

  /**
   * Check connection status to SAGE backend
   */
  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return false;
      const data = (await res.json()) as HealthStatus;
      return data.status === 'ok';
    } catch {
      return false;
    }
  }

  /**
   * Send a chat message to SAGE Orchestrator
   */
  async sendMessage(
    message: string,
    options?: {
      confirmed?: boolean;
      confirmationToken?: string;
    }
  ): Promise<OrchestrationApiResponse> {
    const payload = {
      userId: USER_ID,
      request: message,
      sessionId: this.sessionId,
      confirmed: options?.confirmed,
      confirmationToken: options?.confirmationToken,
    };

    try {
      const res = await fetch(`${this.baseUrl}/orchestrator/run`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (data && typeof data === 'object' && ('response' in data || 'success' in data)) {
          return data as OrchestrationApiResponse;
        }
        const errorMsg = data?.response || data?.error || data?.message || `Server returned ${res.status}`;
        if (res.status === 401) throw new Error('Your session has expired. Please sign in again.');
        if (res.status === 503) throw new Error('SAGE memory services are unavailable. Start Qdrant and the FastEmbed service, then retry.');
        if (data?.requiresConfirmation) {
          return data as OrchestrationApiResponse;
        }
        throw new Error(errorMsg);
      }

      return data as OrchestrationApiResponse;
    } catch (err: unknown) {
      const error = err as Error;
      if (
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('NetworkError') ||
        error.message?.includes('ECONNREFUSED')
      ) {
        throw new Error('SAGE is temporarily unavailable. Please try again.');
      }
      if (
        error.message?.includes('memory') ||
        error.message?.includes('embedding') ||
        error.message?.includes('FastEmbed') ||
        error.message?.includes('Qdrant')
      ) {
        throw new Error("SAGE couldn't access its memory right now. Please try again.");
      }
      throw error;
    }
  }

  /** Fetch live personal context state from Qdrant and the task store. */
  async fetchContext(): Promise<ContextState> {
    try {
      const res = await fetch(`${this.baseUrl}/context?userId=${encodeURIComponent(USER_ID)}`, {
        credentials: 'include', headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        return {
          userId: USER_ID,
          memories: [],
          tasks: [],
          recentActions: [],
        };
      }
      const data = await res.json();
      return {
        userId: data.userId || USER_ID,
        memories: data.memories || [],
        tasks: data.tasks || [],
        recentActions: data.recentActions || [],
      };
    } catch {
      return {
        userId: USER_ID,
        memories: [],
        tasks: [],
        recentActions: [],
      };
    }
  }

  async listConversations(): Promise<ConversationSummary[]> {
    const res = await fetch(`${this.baseUrl}/conversations?userId=${encodeURIComponent(USER_ID)}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Unable to load conversations');
    const data = await res.json();
    return data.conversations || [];
  }

  async fetchConversation(sessionId: string): Promise<ChatMessage[]> {
    const res = await fetch(`${this.baseUrl}/conversations/${encodeURIComponent(sessionId)}/messages?userId=${encodeURIComponent(USER_ID)}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Unable to load conversation');
    const data = await res.json();
    return (data.messages || []).map((message: any) => ({
      id: `stored-${message.id}`,
      role: message.role,
      content: message.content,
      timestamp: new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));
  }
}

export const sageApi = new SageApiService();
