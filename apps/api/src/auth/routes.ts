import type { FastifyInstance } from "fastify";
import { createSession, sessionCookie, clearSessionCookie, readSession } from "./tool-auth.js";
export async function authRoutes(app: FastifyInstance) {
  app.get("/auth/me", async (request, reply) => reply.send({ authenticated: Boolean(readSession(request)), userId: readSession(request) }));
  app.post("/auth/login", async (request, reply) => { const body = (request.body ?? {}) as { username?: string }; const username = body.username?.trim().toLowerCase(); if (!username) return reply.code(400).send({ error: "Username is required" }); return reply.header("Set-Cookie", sessionCookie(createSession(username))).send({ authenticated: true, userId: username }); });
  app.post("/auth/logout", async (_request, reply) => reply.header("Set-Cookie", clearSessionCookie()).send({ authenticated: false }));
}
