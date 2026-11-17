import { neon } from "@neondatabase/serverless";

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  return neon(url);
}

export async function initializeConversationStore(): Promise<void> {
  const sql = database();
  await sql`CREATE TABLE IF NOT EXISTS sage_conversation_messages (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS sage_conversation_lookup
    ON sage_conversation_messages (user_id, session_id, created_at DESC)`;
}

export async function getConversation(userId: string, sessionId: string, limit = 8) {
  const sql = database();
  const rows = await sql`
    SELECT role, content, created_at
    FROM sage_conversation_messages
    WHERE user_id = ${userId} AND session_id = ${sessionId}
    ORDER BY created_at DESC, id DESC
    LIMIT ${limit + 16}
  `;
  const ordered = [...rows].reverse() as Array<{ role: ConversationTurn["role"]; content: string; created_at: string }>;
  const turns = ordered.slice(-limit).map((row) => ({ role: row.role, content: row.content, timestamp: row.created_at }));
  const archived = ordered.slice(0, -limit);
  const summary = archived.map((turn) => `${turn.role === "user" ? "User" : "SAGE"}: ${turn.content}`).join(" | ").slice(-1200);
  return { summary, turns };
}

export async function recordConversation(userId: string, sessionId: string, role: ConversationTurn["role"], content: string) {
  const sql = database();
  await sql`
    INSERT INTO sage_conversation_messages (user_id, session_id, role, content)
    VALUES (${userId}, ${sessionId}, ${role}, ${content.trim()})
  `;
}

export async function listConversations(userId: string) {
  const sql = database();
  return await sql`
    SELECT session_id AS id,
      COALESCE((SELECT first_message.content FROM sage_conversation_messages AS first_message
        WHERE first_message.user_id = ${userId} AND first_message.session_id = messages.session_id
          AND first_message.role = 'user'
        ORDER BY first_message.created_at ASC, first_message.id ASC LIMIT 1), 'New conversation') AS title,
      MAX(created_at) AS updated_at,
      COUNT(*)::int AS message_count
    FROM sage_conversation_messages AS messages
    WHERE messages.user_id = ${userId}
    GROUP BY session_id
    ORDER BY updated_at DESC
    LIMIT 50
  `;
}

export async function getConversationMessages(userId: string, sessionId: string) {
  const sql = database();
  return await sql`
    SELECT id, role, content, created_at
    FROM sage_conversation_messages
    WHERE user_id = ${userId} AND session_id = ${sessionId}
    ORDER BY created_at ASC, id ASC
    LIMIT 500
  `;
}
