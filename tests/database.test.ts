import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import * as db from "@noxis/database";
import { migrate } from "../packages/database/scripts/migrate.js";
import { fixtures as f } from "../scripts/test-env.js";
before(async () => {
  await migrate();
  await migrate();
});
after(() => db.closeDatabase());
test("conexión PostgreSQL y migraciones idempotentes", async () => {
  assert.match((await db.query("SELECT version() AS version")).rows[0].version, /PostgreSQL/);
  assert.equal((await db.query("SELECT COUNT(*) FROM schema_migrations")).rows[0].count, "2");
});
test("merge profundo atómico conserva opciones y registra auditoría", async () => {
  await db.updateGuildSettings(
    f.guildId,
    { antiSpam: { maxMessages: 9, mode: "observe" }, welcomeChannelId: f.channelId },
    f.ownerId,
  );
  await Promise.all([
    db.updateGuildSettings(f.guildId, { antiSpam: { enabled: false } }, f.ownerId),
    db.updateGuildSettings(f.guildId, { antiRaid: { maxJoins: 7 } }, f.ownerId),
  ]);
  const s = await db.getGuildSettings(f.guildId);
  assert.equal(s.antiSpam?.maxMessages, 9);
  assert.equal(s.antiSpam?.enabled, false);
  assert.equal(s.antiRaid?.maxJoins, 7);
  assert.equal(s.welcomeChannelId, f.channelId);
  assert.ok((await db.listEvents(f.guildId, "audit")).length >= 3);
});
test("trabajos idempotentes y reclamación única con registro del resultado", async () => {
  const key = randomUUID(),
    payload = { name: "Miembro", color: "#D62828" };
  const a = await db.enqueueJob(f.guildId, f.ownerId, "role.create", payload, key),
    b = await db.enqueueJob(f.guildId, f.ownerId, "role.create", payload, key);
  assert.equal(a.id, b.id);
  await assert.rejects(
    () => db.enqueueJob(f.guildId, f.ownerId, "role.create", { ...payload, name: "Otro" }, key),
    /IDEMPOTENCY/,
  );
  const [one, two] = await Promise.all([db.claimJob(f.guildId), db.claimJob(f.guildId)]);
  assert.equal([one, two].filter(Boolean).length, 1);
  await db.finishJob(one ?? two!, { roleId: f.roleId });
  assert.equal((await db.listJobs(f.guildId))[0].status, "succeeded");
});
test("anuncios pendientes se pueden cancelar y no se reclaman dos veces", async () => {
  const embed = { title: "Hola", description: "Comunidad", color: "#D62828" };
  const a = await db.scheduleAnnouncement(
    f.guildId,
    f.ownerId,
    f.channelId,
    embed,
    new Date(Date.now() + 60000),
  );
  assert.equal(await db.cancelAnnouncement(f.guildId, String(a.id), f.ownerId), true);
  assert.equal(await db.cancelAnnouncement(f.guildId, String(a.id), f.ownerId), false);
  await db.scheduleAnnouncement(
    f.guildId,
    f.ownerId,
    f.channelId,
    embed,
    new Date(Date.now() - 1000),
  );
  const due = await db.claimAnnouncement(f.guildId);
  assert.ok(due);
  assert.equal(await db.claimAnnouncement(f.guildId), undefined);
  await db.finishAnnouncement(due!.id, f.channelId);
});
test("tickets únicos; votos reemplazables; sorteos persistentes; XP con cooldown", async () => {
  const a = await db.reserveTicket(f.guildId, f.ownerId);
  assert.ok(a);
  assert.equal(await db.reserveTicket(f.guildId, f.ownerId), undefined);
  await db.setTicketChannel(String(a.id), f.channelId);
  await db.closeTicket(String(a.id));
  const poll = await db.createPoll(f.guildId, f.channelId, f.ownerId, "¿Jugamos?", ["Sí", "No"]);
  assert.equal(await db.vote(f.guildId, String(poll.id), f.ownerId, 3), false);
  await db.vote(f.guildId, String(poll.id), f.ownerId, 0);
  await db.vote(f.guildId, String(poll.id), f.ownerId, 1);
  assert.equal((await db.pollResults(f.guildId, String(poll.id)))?.counts[0]?.votes, 1);
  await db.endPoll(f.guildId, String(poll.id));
  assert.equal(await db.vote(f.guildId, String(poll.id), f.ownerId, 0), false);
  const giveaway = await db.createGiveaway(
    f.guildId,
    f.channelId,
    f.ownerId,
    "VIP",
    new Date(Date.now() + 60000),
  );
  assert.equal(await db.enterGiveaway(f.guildId, String(giveaway.id), f.ownerId), true);
  await db.query("UPDATE giveaways SET ends_at=NOW()-INTERVAL '1 second' WHERE id=$1", [
    giveaway.id,
  ]);
  const result = await db.drawGiveaway(f.guildId, String(giveaway.id));
  assert.deepEqual(result?.winner_ids, [f.ownerId]);
  assert.equal(await db.drawGiveaway(f.guildId, String(giveaway.id)), null);
  assert.equal((await db.awardXp(f.guildId, f.ownerId))?.xp, 15);
  assert.equal(await db.awardXp(f.guildId, f.ownerId), null);
});
test("exportación consistente excluye sesiones y datos de otros servidores", async () => {
  const data = await db.exportGuildData(f.guildId);
  assert.equal(data.format, "noxis-guild-export");
  assert.equal(data.data.web_sessions, undefined);
  for (const rows of Object.values(data.data))
    for (const row of rows as { guild_id?: string }[])
      if (row.guild_id) assert.equal(row.guild_id, f.guildId);
});
test("transacciones fallidas revierten sus escrituras", async () => {
  await assert.rejects(() =>
    db.transaction(async (c) => {
      await c.query("INSERT INTO audit_events(guild_id,action) VALUES ($1,'ROLLBACK_TEST')", [
        f.guildId,
      ]);
      throw new Error("rollback");
    }),
  );
  assert.equal(
    (
      await db.query("SELECT id FROM audit_events WHERE guild_id=$1 AND action='ROLLBACK_TEST'", [
        f.guildId,
      ])
    ).rowCount,
    0,
  );
});
