import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { z } from "zod";
import { PermissionFlagsBits } from "discord.js";
import * as db from "@noxis/database";
import {
  settingsPatchSchema,
  jobRequestSchema,
  parseJob,
  templatePlan,
  templateType,
  announcementSchema,
  snowflake,
  httpsUrl,
} from "@noxis/shared";
import { config } from "./config.js";
import { getSession, registerAuthRoutes, safeEqual, type SessionUser } from "./auth.js";
import { createDiscordAdmin, type DiscordAdmin } from "./discord.js";
declare module "fastify" {
  interface FastifyRequest {
    owner: SessionUser | null;
  }
}
export async function buildApp(
  options: {
    discord?: DiscordAdmin;
    fetcher?: typeof fetch;
    logger?: boolean;
    rateMax?: number;
  } = {},
) {
  const discord = options.discord ?? createDiscordAdmin();
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            level: "info",
            redact: ["req.headers.cookie", "req.headers.authorization", "res.headers.set-cookie"],
            serializers: {
              req: (r) => ({
                method: r.method,
                url: String(r.url).split("?")[0],
                remoteAddress: r.ip,
              }),
            },
          },
    trustProxy: config.TRUST_PROXY === "true",
    bodyLimit: 65536,
  });
  app.decorateRequest("owner", null);
  await app.register(cookie);
  await app.register(cors, {
    origin: new URL(config.DASHBOARD_URL).origin,
    credentials: true,
    allowedHeaders: ["Content-Type", "X-CSRF-Token"],
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });
  await app.register(rateLimit, { max: options.rateMax ?? 120, timeWindow: "1 minute" });
  app.addHook("onSend", async (_req, reply) => {
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "no-referrer")
      .header("Cache-Control", "no-store");
  });
  app.addHook("preHandler", async (req, reply) => {
    if (!req.url.startsWith("/api/")) return;
    req.owner = await getSession(req);
    if (!req.owner) return reply.code(401).send({ error: "No autorizado" });
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (
        req.headers.origin !== new URL(config.DASHBOARD_URL).origin ||
        !safeEqual(String(req.headers["x-csrf-token"] ?? ""), req.owner.csrf)
      )
        return reply
          .code(403)
          .send({ error: "La solicitud no pasó la comprobación de seguridad." });
    }
  });
  app.setErrorHandler((error, _req, reply) => {
    const e = error as Error & { statusCode?: number; code?: string };
    if (e instanceof z.ZodError)
      return reply
        .code(400)
        .send({ error: "Datos inválidos", fields: e.issues.map((i) => i.path.join(".")) });
    if (e.message === "IDEMPOTENCY_CONFLICT")
      return reply.code(409).send({ error: "La solicitud ya existe con otros datos." });
    if (e.statusCode && e.statusCode < 500)
      return reply
        .code(e.statusCode)
        .send({ error: e.statusCode === 403 ? e.message : "Solicitud inválida" });
    app.log.error({ code: e.code ?? "INTERNAL" }, "No se pudo completar una operación");
    return reply
      .code(503)
      .send({ error: "Servicio no disponible. Revisa la conexión con PostgreSQL y Discord." });
  });
  await registerAuthRoutes(app, options.fetcher);
  app.get("/health", async (_req, reply) => {
    try {
      await db.query("SELECT 1");
      return { ok: true, service: "noxis-api", database: "connected" };
    } catch {
      return reply.code(503).send({ ok: false, service: "noxis-api", database: "unavailable" });
    }
  });
  app.get("/api/me", async (req) => ({
    user: { id: req.owner!.id, username: req.owner!.username, avatar: req.owner!.avatar },
    csrf: req.owner!.csrf,
    guildId: config.DISCORD_GUILD_ID,
  }));
  app.get("/api/dashboard/overview", async () => db.getDashboardOverview(config.DISCORD_GUILD_ID));
  app.get("/api/guild", async (req) => ({
    guild: await discord.resources(req.owner!.id),
    bot: await db.getBotStatus(config.DISCORD_GUILD_ID),
  }));
  const checkGuild = (id: string) => {
    if (id !== config.DISCORD_GUILD_ID)
      throw Object.assign(new Error("Servidor fuera de la allowlist privada."), {
        statusCode: 403,
      });
  };
  app.get<{ Params: { guildId: string } }>("/api/guilds/:guildId/settings", async (req) => {
    checkGuild(req.params.guildId);
    return { settings: await db.getGuildSettings(req.params.guildId) };
  });
  app.patch<{ Params: { guildId: string } }>("/api/guilds/:guildId/settings", async (req) => {
    checkGuild(req.params.guildId);
    const patch = settingsPatchSchema.parse(req.body);
    await discord.validateSettings(req.owner!.id, patch);
    return { settings: await db.updateGuildSettings(req.params.guildId, patch, req.owner!.id) };
  });
  app.get("/api/events", async (req) => {
    const kind = z
      .object({ kind: z.enum(["audit", "security"]).default("audit") })
      .parse(req.query).kind;
    return { events: await db.listEvents(config.DISCORD_GUILD_ID, kind) };
  });
  app.get("/api/jobs", async () => ({ jobs: await db.listJobs(config.DISCORD_GUILD_ID) }));
  app.post("/api/jobs", async (req, reply) => {
    const input = jobRequestSchema.parse(req.body);
    parseJob(input.kind, input.payload);
    const perm = input.kind.startsWith("role.")
      ? PermissionFlagsBits.ManageRoles
      : input.kind === "announcement.send"
        ? PermissionFlagsBits.ManageMessages
        : PermissionFlagsBits.ManageGuild;
    await discord.authorize(req.owner!.id, perm);
    const job = await db.enqueueJob(
      config.DISCORD_GUILD_ID,
      req.owner!.id,
      input.kind,
      input.payload,
      input.requestId,
    );
    return reply.code(202).send({ job });
  });
  app.get("/api/templates/preview", async (req) => ({
    plan: templatePlan(templateType.parse(z.object({ type: templateType }).parse(req.query).type)),
  }));
  app.get("/api/announcements", async () => ({
    announcements: await db.listAnnouncements(config.DISCORD_GUILD_ID),
    templates: await db.listEmbedTemplates(config.DISCORD_GUILD_ID),
  }));
  app.post("/api/announcements", async (req, reply) => {
    const input = z
      .object({
        channelId: snowflake,
        embed: announcementSchema,
        scheduledFor: z.iso
          .datetime({ offset: true })
          .refine(
            (d) => Date.parse(d) > Date.now() && Date.parse(d) < Date.now() + 366 * 86400000,
            "Fecha fuera de rango",
          ),
      })
      .strict()
      .parse(req.body);
    await discord.validateAnnouncement(req.owner!.id, input.channelId);
    return reply.code(201).send({
      announcement: await db.scheduleAnnouncement(
        config.DISCORD_GUILD_ID,
        req.owner!.id,
        input.channelId,
        input.embed,
        new Date(input.scheduledFor),
      ),
    });
  });
  app.delete<{ Params: { id: string } }>("/api/announcements/:id", async (req, reply) => {
    const id = z
      .string()
      .regex(/^\d{1,18}$/)
      .parse(req.params.id);
    await discord.authorize(req.owner!.id, PermissionFlagsBits.ManageMessages);
    return (await db.cancelAnnouncement(config.DISCORD_GUILD_ID, id, req.owner!.id))
      ? { ok: true }
      : reply.code(409).send({ error: "El anuncio ya no está pendiente." });
  });
  app.put("/api/announcement-templates", async (req) => {
    const input = z
      .object({ name: z.string().trim().min(1).max(100), embed: announcementSchema })
      .strict()
      .parse(req.body);
    await discord.authorize(req.owner!.id, PermissionFlagsBits.ManageMessages);
    return {
      template: await db.saveEmbedTemplate(
        config.DISCORD_GUILD_ID,
        req.owner!.id,
        input.name,
        input.embed,
      ),
    };
  });
  app.get("/api/playlists", async (req) => ({
    playlists: await db.listPlaylists(config.DISCORD_GUILD_ID, req.owner!.id),
  }));
  app.put("/api/playlists", async (req) => {
    const input = z
      .object({
        name: z.string().trim().min(1).max(100),
        tracks: z
          .array(z.object({ url: httpsUrl, title: z.string().trim().min(1).max(150) }).strict())
          .max(100),
      })
      .strict()
      .parse(req.body);
    await discord.authorize(req.owner!.id, PermissionFlagsBits.ManageGuild);
    return {
      playlist: await db.savePlaylist(
        config.DISCORD_GUILD_ID,
        req.owner!.id,
        input.name,
        input.tracks,
      ),
    };
  });
  app.get("/api/community", async () => db.listCommunity(config.DISCORD_GUILD_ID));
  return app;
}
