export interface SageAgentRequest {
  userId: string;
  sessionId: string;
  message: string;
}

export interface SageAgentResponse {
  response: string;
}
