import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { query } from "@noxis/database";
import { snowflake } from "@noxis/shared";
import { config, sessionKey } from "./config.js";
export type SessionUser = {
  id: string;
  username: string;
  avatar: string | null;
  csrf: string;
  sessionId: string;
};
export function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a),
    bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export async function createSession(user: { id: string; username: string; avatar: string | null }) {
  const id = randomUUID(),
    csrf = randomBytes(32).toString("hex");
  await query(
    "INSERT INTO web_sessions(id,user_id,expires_at) VALUES ($1,$2,NOW()+INTERVAL '8 hours')",
    [id, user.id],
  );
  return new SignJWT({ username: user.username, avatar: user.avatar, csrf })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setJti(id)
    .setIssuer("noxis-api")
    .setAudience("noxis-panel")
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(sessionKey);
}
export async function getSession(request: FastifyRequest): Promise<SessionUser | null> {
  const token = request.cookies.noxis_session;
  if (!token) return null;
  let payload;
  try {
    payload = (
      await jwtVerify(token, sessionKey, {
        algorithms: ["HS256"],
        issuer: "noxis-api",
        audience: "noxis-panel",
      })
    ).payload;
  } catch {
    return null;
  }
  if (
    !payload.sub ||
    !payload.jti ||
    typeof payload.csrf !== "string" ||
    !config.ownerIds.has(payload.sub)
  )
    return null;
  if (
    !(
      await query("SELECT id FROM web_sessions WHERE id=$1 AND user_id=$2 AND expires_at>NOW()", [
        payload.jti,
        payload.sub,
      ])
    ).rowCount
  )
    return null;
  return {
    id: payload.sub,
    username: String(payload.username ?? "Owner"),
    avatar: typeof payload.avatar === "string" ? payload.avatar : null,
    csrf: payload.csrf,
    sessionId: payload.jti,
  };
}
export async function requireOwner(request: FastifyRequest, reply: FastifyReply) {
  const user = await getSession(request);
  if (!user) {
    await reply.code(401).send({ error: "No autorizado" });
    return null;
  }
  return user;
}
const cookieOptions = {
  httpOnly: true,
  secure: config.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
export async function registerAuthRoutes(app: FastifyInstance, fetcher: typeof fetch = fetch) {
  app.get(
    "/auth/discord",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (_req, reply) => {
      const state = randomBytes(24).toString("hex");
      reply.setCookie("noxis_oauth_state", state, { ...cookieOptions, maxAge: 300 });
      const params = new URLSearchParams({
        client_id: config.DISCORD_CLIENT_ID,
        redirect_uri: config.DISCORD_REDIRECT_URI,
        response_type: "code",
        scope: "identify",
        state,
      });
      return reply.redirect(`https://discord.com/oauth2/authorize?${params}`);
    },
  );
  app.get(
    "/auth/callback",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = z
        .object({ code: z.string().min(1).max(2048), state: z.string().regex(/^[a-f0-9]{48}$/) })
        .safeParse(request.query);
      const saved = request.cookies.noxis_oauth_state;
      reply.clearCookie("noxis_oauth_state", cookieOptions);
      if (!parsed.success || !saved || !safeEqual(parsed.data.state, saved))
        return reply.code(400).send({ error: "Autenticación cancelada o estado OAuth inválido." });
      try {
        const response = await fetcher("https://discord.com/api/v10/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: config.DISCORD_CLIENT_ID,
            client_secret: config.DISCORD_CLIENT_SECRET,
            grant_type: "authorization_code",
            code: parsed.data.code,
            redirect_uri: config.DISCORD_REDIRECT_URI,
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok)
          return reply.code(401).send({ error: "Discord rechazó la autenticación." });
        const token = z
          .object({ access_token: z.string().min(1), token_type: z.literal("Bearer") })
          .parse(await response.json());
        const me = await fetcher("https://discord.com/api/v10/users/@me", {
          headers: { Authorization: `Bearer ${token.access_token}` },
          signal: AbortSignal.timeout(10000),
        });
        if (!me.ok)
          return reply.code(401).send({ error: "No se pudo verificar tu cuenta de Discord." });
        const user = z
          .object({ id: snowflake, username: z.string().max(100), avatar: z.string().nullable() })
          .parse(await me.json());
        if (!config.ownerIds.has(user.id))
          return reply.code(403).send({ error: "Tu cuenta no tiene acceso a este panel privado." });
        const old = await getSession(request);
        if (old) await query("DELETE FROM web_sessions WHERE id=$1", [old.sessionId]);
        reply.setCookie("noxis_session", await createSession(user), {
          ...cookieOptions,
          maxAge: 28800,
        });
        return reply.redirect(config.DASHBOARD_URL);
      } catch {
        return reply
          .code(502)
          .send({ error: "No se pudo completar la conexión con Discord. Inténtalo de nuevo." });
      }
    },
  );
  app.post("/auth/logout", async (request, reply) => {
    const user = await requireOwner(request, reply);
    if (!user) return;
    if (
      request.headers.origin !== new URL(config.DASHBOARD_URL).origin ||
      !safeEqual(String(request.headers["x-csrf-token"] ?? ""), user.csrf)
    )
      return reply.code(403).send({ error: "Solicitud no válida" });
    await query("DELETE FROM web_sessions WHERE id=$1", [user.sessionId]);
    reply.clearCookie("noxis_session", cookieOptions);
    return { ok: true };
  });
}
