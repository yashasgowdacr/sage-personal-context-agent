import type { OrchestrationApiResponse, HealthStatus, DemoContextState } from '../types/sage';

// Default to configured environment variable or fallback to empty string (Vite proxy)
const API_BASE_URL = (import.meta.env.VITE_SAGE_API_URL || '').replace(/\/+$/, '');

export const DEMO_USER_ID = 'sage-demo-user';

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
      userId: DEMO_USER_ID,
      request: message,
      sessionId: this.sessionId,
      confirmed: options?.confirmed,
      confirmationToken: options?.confirmationToken,
    };

    try {
      const res = await fetch(`${this.baseUrl}/orchestrator/run`, {
        method: 'POST',
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
        if (res.status === 401) {
          throw new Error('Unauthorized request. Ensure SAGE_DEMO_MODE=true is enabled.');
        }
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

  /**
   * Reset demo memories, tasks, and actions for a clean slate
   */
  async resetDemoState(): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/demo/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: DEMO_USER_ID }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to reset demo state');
      }
      this.resetSession();
      return { success: true, message: 'Demo state reset successfully' };
    } catch (err) {
      throw new Error(`Failed to reset: ${(err as Error).message}`);
    }
  }

  /**
   * Fetch live personal context state (real Qdrant memories, real pending tasks, recent actions)
   */
  async fetchDemoContext(): Promise<DemoContextState> {
    try {
      const res = await fetch(`${this.baseUrl}/demo/context?userId=${encodeURIComponent(DEMO_USER_ID)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        return {
          userId: DEMO_USER_ID,
          memories: [],
          tasks: [],
          recentActions: [],
        };
      }
      const data = await res.json();
      return {
        userId: data.userId || DEMO_USER_ID,
        memories: data.memories || [],
        tasks: data.tasks || [],
        recentActions: data.recentActions || [],
      };
    } catch {
      return {
        userId: DEMO_USER_ID,
        memories: [],
        tasks: [],
        recentActions: [],
      };
    }
  }
}

export const sageApi = new SageApiService();
