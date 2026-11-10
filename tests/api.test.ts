import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildApp } from "../apps/api/src/app.js";
import { createSession } from "../apps/api/src/auth.js";
import { AccessError, type DiscordAdmin } from "../apps/api/src/discord.js";
import { fixtures as f } from "../scripts/test-env.js";
import { migrate } from "../packages/database/scripts/migrate.js";
import { closeDatabase, query } from "@noxis/database";
let deny = false,
  oauthUser = f.ownerId;
const discord: DiscordAdmin = {
  resources: async () => ({
    id: f.guildId,
    name: "NOXIS TEST",
    channels: [{ id: f.channelId, name: "general", type: 0 }],
    roles: [{ id: f.roleId, name: "Miembro", position: 1, managed: false }],
  }),
  authorize: async () => {
    if (deny) throw new AccessError("Permiso retirado en Discord.");
  },
  validateSettings: async () => {
    if (deny) throw new AccessError("Permiso retirado en Discord.");
  },
  validateAnnouncement: async () => {
    if (deny) throw new AccessError("Permiso retirado en Discord.");
  },
};
const fetcher: typeof fetch = async (input) =>
  new Response(
    JSON.stringify(
      String(input).endsWith("/oauth2/token")
        ? { access_token: "test-unused", token_type: "Bearer" }
        : { id: oauthUser, username: "Noxis Owner", avatar: null },
    ),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
const app = await buildApp({ logger: false, discord, fetcher });
let cookie = "",
  csrf = "";
before(async () => {
  await migrate();
  const token = await createSession({ id: f.ownerId, username: "Owner", avatar: null });
  cookie = `noxis_session=${token}`;
  const me = await app.inject({ url: "/api/me", headers: { cookie } });
  csrf = me.json().csrf;
});
after(async () => {
  await app.close();
  await closeDatabase();
});
const headers = () => ({ cookie, origin: "http://127.0.0.1:3000", "x-csrf-token": csrf });
test("health consulta PostgreSQL y rutas privadas rechazan acceso anónimo", async () => {
  assert.equal((await app.inject("/health")).json().database, "connected");
  assert.equal((await app.inject("/api/me")).statusCode, 401);
  assert.equal(
    (await app.inject({ url: "/api/me", headers: { cookie: cookie + "x" } })).statusCode,
    401,
  );
});
test("OAuth exige state válido, niega externos y emite cookie HttpOnly al OWNER", async () => {
  const login = await app.inject("/auth/discord"),
    target = new URL(login.headers.location as string),
    state = target.searchParams.get("state")!;
  assert.equal(login.statusCode, 302);
  assert.match(String(login.headers["set-cookie"]), /HttpOnly/);
  const stateCookie = `noxis_oauth_state=${state}`;
  assert.equal(
    (
      await app.inject({
        url: "/auth/callback?code=test&state=wrong",
        headers: { cookie: stateCookie },
      })
    ).statusCode,
    400,
  );
  oauthUser = f.strangerId;
  assert.equal(
    (
      await app.inject({
        url: `/auth/callback?code=test&state=${state}`,
        headers: { cookie: stateCookie },
      })
    ).statusCode,
    403,
  );
  oauthUser = f.ownerId;
  const ok = await app.inject({
    url: `/auth/callback?code=test&state=${state}`,
    headers: { cookie: stateCookie },
  });
  assert.equal(ok.statusCode, 302);
  const cookies = ok.headers["set-cookie"];
  assert.match(String(cookies), /noxis_session=/);
  assert.match(String(cookies), /HttpOnly/);
  assert.match(String(cookies), /SameSite=Lax/);
});
test("CSRF, origen, servidor y validación bloquean mutaciones inválidas", async () => {
  const url = `/api/guilds/${f.guildId}/settings`,
    payload = { welcomeChannelId: f.channelId };
  assert.equal(
    (await app.inject({ method: "PATCH", url, headers: { cookie }, payload })).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: "PATCH",
        url,
        headers: { ...headers(), origin: "https://attacker.example" },
        payload,
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: "PATCH",
        url: `/api/guilds/${f.strangerId}/settings`,
        headers: headers(),
        payload,
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: "PATCH",
        url,
        headers: headers(),
        payload: { autoRoleId: "bad", injected: true },
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (await app.inject({ method: "PATCH", url, headers: headers(), payload })).statusCode,
    200,
  );
  deny = true;
  assert.equal(
    (await app.inject({ method: "PATCH", url, headers: headers(), payload })).statusCode,
    403,
  );
  deny = false;
});
test("acciones del panel se encolan con confirmación e idempotencia", async () => {
  const payload = {
    kind: "role.create",
    payload: { name: "VIP", color: "#D62828" },
    requestId: randomUUID(),
  };
  const a = await app.inject({ method: "POST", url: "/api/jobs", headers: headers(), payload });
  assert.equal(a.statusCode, 202);
  assert.equal(a.json().job.status, "pending");
  const b = await app.inject({ method: "POST", url: "/api/jobs", headers: headers(), payload });
  assert.equal(b.json().job.id, a.json().job.id);
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/jobs",
        headers: headers(),
        payload: { ...payload, payload: { name: "otro" } },
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/jobs",
        headers: headers(),
        payload: {
          kind: "template.apply",
          payload: { type: "gaming", confirmed: false },
          requestId: randomUUID(),
        },
      })
    ).statusCode,
    400,
  );
});
test("programación, plantillas y métricas del panel usan datos persistentes", async () => {
  const embed = { title: "Evento", description: "Hoy en NOXIS", color: "#D62828" };
  const create = await app.inject({
    method: "POST",
    url: "/api/announcements",
    headers: headers(),
    payload: {
      channelId: f.channelId,
      embed,
      scheduledFor: new Date(Date.now() + 60000).toISOString(),
    },
  });
  assert.equal(create.statusCode, 201);
  assert.equal(
    (
      await app.inject({
        method: "DELETE",
        url: `/api/announcements/${create.json().announcement.id}`,
        headers: headers(),
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await app.inject({
        method: "PUT",
        url: "/api/announcement-templates",
        headers: headers(),
        payload: { name: "Evento", embed },
      })
    ).statusCode,
    200,
  );
  assert.ok(
    (await app.inject({ url: "/api/announcements", headers: { cookie } })).json().templates.length,
  );
  await query("INSERT INTO security_events(guild_id,event_type) VALUES ($1,'PRIVATE')", [
    f.strangerId,
  ]);
  const overview = (
    await app.inject({ url: "/api/dashboard/overview", headers: { cookie } })
  ).json();
  assert.equal(overview.securityEvents7d, 0);
});
test("logout revoca el JWT y rechaza su reutilización", async () => {
  assert.equal(
    (await app.inject({ method: "POST", url: "/auth/logout", headers: headers() })).statusCode,
    200,
  );
  assert.equal((await app.inject({ url: "/api/me", headers: { cookie } })).statusCode, 401);
});
test("rate limiting responde 429", async () => {
  const limited = await buildApp({ logger: false, discord, fetcher, rateMax: 2 });
  try {
    await limited.inject("/health");
    await limited.inject("/health");
    assert.equal((await limited.inject("/health")).statusCode, 429);
  } finally {
    await limited.close();
  }
});
