import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  Collection,
  PermissionFlagsBits as P,
  PermissionsBitField,
  ChannelType,
  type Guild,
} from "discord.js";
import { commands } from "../apps/bot/src/commands/index.js";
import { applyTemplate } from "../apps/bot/src/services/templates.js";
import { createRole } from "../apps/bot/src/services/roles.js";
import { runJob } from "../apps/bot/src/services/worker.js";
import {
  enqueueJob,
  claimJob,
  listJobs,
  closeDatabase,
  query,
  getGuildSettings,
  updateGuildSettings,
} from "@noxis/database";
import { fixtures as f } from "../scripts/test-env.js";
import { migrate } from "../packages/database/scripts/migrate.js";
import { randomUUID } from "node:crypto";
before(() => migrate());
after(() => closeDatabase());
test("los 11 comandos slash se serializan sin opciones inválidas ni nombres duplicados", () => {
  const data = commands.map((c) => c.data.toJSON());
  assert.equal(data.length, 11);
  assert.equal(new Set(data.map((c) => c.name)).size, 11);
  for (const c of data) {
    assert.ok(c.name);
    assert.ok(c.description);
  }
});
function fakeGuild() {
  let counter = 1000;
  const roles = new Collection<string, any>(),
    channels = new Collection<string, any>();
  const perms = new PermissionsBitField(P.Administrator),
    actor = { id: f.ownerId, permissions: perms, roles: { highest: { position: 90 } } },
    bot = { id: f.botId, permissions: perms, roles: { highest: { position: 100 } } };
  const guild: any = {
    id: f.guildId,
    ownerId: f.ownerId,
    roles: {
      cache: roles,
      everyone: { id: f.guildId },
      fetch: async (id?: string) => (id ? roles.get(id) : roles),
      create: async (data: any) => {
        const role = {
          ...data,
          id: String(100000000000000000n + BigInt(counter++)),
          position: 1,
          managed: false,
          permissions: new PermissionsBitField(data.permissions),
        };
        roles.set(role.id, role);
        return role;
      },
    },
    members: { fetch: async () => actor, fetchMe: async () => bot },
    channels: {
      cache: channels,
      fetch: async () => channels,
      create: async (data: any) => {
        const c = {
          ...data,
          id: String(200000000000000000n + BigInt(counter++)),
          parentId: data.parent,
          permissionOverwrites: {
            cache: new Collection(
              (data.permissionOverwrites ?? []).map((o: any) => [
                o.id,
                { deny: new PermissionsBitField(o.deny ?? []) },
              ]),
            ),
          },
        };
        channels.set(c.id, c);
        return c;
      },
    },
  };
  return { guild: guild as Guild, roles, channels, actor };
}
test("plantillas crean recursos una vez y conservan la configuración existente", async () => {
  const { guild, roles, channels } = fakeGuild();
  await updateGuildSettings(f.guildId, { welcomeChannelId: f.channelId }, f.ownerId);
  const [a, parallel] = await Promise.all([
    applyTemplate(guild, f.ownerId, "gaming"),
    applyTemplate(guild, f.ownerId, "gaming"),
  ]);
  assert.ok(a.created.length > 10);
  assert.equal(parallel.created.length, 0);
  const count = roles.size + channels.size;
  const b = await applyTemplate(guild, f.ownerId, "gaming");
  assert.equal(b.created.length, 0);
  assert.equal(roles.size + channels.size, count);
  assert.equal((await getGuildSettings(f.guildId)).welcomeChannelId, f.channelId);
  for (const role of roles.values()) assert.equal(role.permissions.has(P.Administrator), false);
  const privateCategory = [...channels.values()].find((c) => c.name === "STAFF · PRIVADO");
  assert.equal(
    privateCategory.permissionOverwrites.cache.get(f.guildId).deny.has(P.ViewChannel),
    true,
  );
});
test("servicios vuelven a comprobar permisos antes de crear recursos", async () => {
  const { guild, actor, roles } = fakeGuild();
  actor.permissions = new PermissionsBitField(0n);
  (guild as any).ownerId = f.strangerId;
  await assert.rejects(() => createRole(guild, f.ownerId, { name: "VIP" }));
  assert.equal(roles.size, 0);
});
test("worker persiste éxito y fallo sin ejecutar de nuevo un trabajo", async () => {
  await query("UPDATE bot_jobs SET status='succeeded' WHERE guild_id=$1 AND status='pending'", [
    f.guildId,
  ]);
  await enqueueJob(f.guildId, f.ownerId, "role.create", { name: "Test" }, randomUUID());
  const a = await claimJob(f.guildId);
  let calls = 0;
  await runJob(a!, async () => {
    calls++;
    return { id: f.roleId };
  });
  assert.equal(calls, 1);
  assert.equal(await claimJob(f.guildId), undefined);
  await enqueueJob(f.guildId, f.ownerId, "role.create", { name: "Error" }, randomUUID());
  const b = await claimJob(f.guildId);
  await runJob(b!, async () => {
    throw new Error("test error");
  });
  assert.equal((await listJobs(f.guildId))[0].status, "failed");
});
