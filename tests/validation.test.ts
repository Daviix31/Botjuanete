import { test } from "node:test";
import assert from "node:assert/strict";
import {
  settingsPatchSchema,
  announcementSchema,
  parseJob,
  renderMemberMessage,
  levelFromXp,
} from "@noxis/shared";
import { PermissionFlagsBits as P } from "discord.js";
import { rolePolicy } from "../apps/bot/src/utils/permissions.js";
import { SecurityEngine, SlidingWindow, phishingHosts } from "../apps/bot/src/services/security.js";
import { validateAudioUrl, isPublicAddress } from "../apps/bot/src/services/audio-source.js";
const allowed = new Set(["audio.example.com"]);
test("validación estricta de configuración, IDs y límites", () => {
  for (const patch of [
    { autoRoleId: "x" },
    { antiSpam: { strikes: 1 } },
    { antiSpam: { mode: "ban" } },
    { antiRaid: { intervalMs: 1 } },
    { unknown: true },
  ])
    assert.equal(settingsPatchSchema.safeParse(patch).success, false);
  assert.equal(
    settingsPatchSchema.safeParse({
      welcomeChannelId: null,
      antiSpam: { mode: "observe", maxMessages: 6 },
    }).success,
    true,
  );
  assert.equal(
    announcementSchema.safeParse({ title: "t", description: "d", image: "javascript:alert(1)" })
      .success,
    false,
  );
  assert.throws(() => parseJob("template.apply", { type: "comunidad", confirmed: false }));
});
test("plantillas de mensajes y niveles no ejecutan contenido", () => {
  assert.equal(
    renderMemberMessage("Hola {user} en {server}", "123", "Ana", "NOXIS"),
    "Hola <@123> en NOXIS",
  );
  assert.equal(levelFromXp(400), 2);
  assert.equal(levelFromXp(-2), 0);
});
const policy = {
  everyone: false,
  managed: false,
  rolePosition: 2,
  targetPosition: 3,
  botPosition: 10,
  actorPosition: 8,
  actorIsGuildOwner: false,
  actorPermissions: P.ManageRoles,
  rolePermissions: 0n,
};
test("roles respetan jerarquía del actor y del bot", () => {
  assert.doesNotThrow(() => rolePolicy(policy));
  for (const patch of [
    { everyone: true },
    { managed: true },
    { rolePosition: 10 },
    { targetPosition: 10 },
    { rolePosition: 8 },
    { targetPosition: 8 },
    { targetIsGuildOwner: true },
    { rolePermissions: P.Administrator },
  ])
    assert.throws(() => rolePolicy({ ...policy, ...patch }));
  assert.doesNotThrow(() => rolePolicy({ ...policy, actorIsGuildOwner: true, rolePosition: 9 }));
  assert.throws(() => rolePolicy({ ...policy, actorIsGuildOwner: true, rolePosition: 10 }));
});
test("antispam observa por defecto y exige reincidencia explícita", () => {
  const engine = new SecurityEngine();
  for (let n = 0; n < 5; n++) assert.equal(engine.message("g", "u", {}, n), null);
  assert.equal(engine.message("g", "u", {}, 5)?.timeout, false);
  const active = { antiSpam: { mode: "timeout" as const, maxMessages: 3, strikes: 2 } };
  for (let n = 0; n < 2; n++) engine.message("g", "v", active, n);
  assert.equal(engine.message("g", "v", active, 2)?.timeout, false);
  for (let n = 3; n < 5; n++) engine.message("g", "v", active, n);
  assert.equal(engine.message("g", "v", active, 5)?.timeout, true);
  assert.equal(engine.message("g", "v", { antiSpam: { enabled: false } }, 6), null);
});
test("raid usa la ventana configurada; caché tiene tamaño acotado", () => {
  const e = new SecurityEngine(),
    s = { antiRaid: { maxJoins: 3, intervalMs: 60000 } };
  e.join("g", s, 0);
  e.join("g", s, 20000);
  assert.equal(e.join("g", s, 40000)?.count, 3);
  const w = new SlidingWindow(3);
  for (let n = 0; n < 30; n++) w.hit(String(n), 5000, n);
  assert.ok(w.size <= 3);
  assert.deepEqual(
    phishingHosts(
      "https://evil.example/a https://sub.evil.example/b https://evil.example.safe.com",
      ["evil.example"],
    ),
    ["evil.example", "sub.evil.example"],
  );
});
test("música bloquea SSRF, credenciales, redirecciones de URL y hosts no autorizados", () => {
  assert.equal(
    validateAudioUrl("https://audio.example.com/song.mp3", allowed).hostname,
    "audio.example.com",
  );
  for (const u of [
    "invalid",
    "http://audio.example.com/a",
    "https://user:pass@audio.example.com/a",
    "https://audio.example.com:444/a",
    "https://audio.example.com.evil/a",
    "https://127.0.0.1/a",
    "https://audio.example.com/a#x",
  ])
    assert.throws(() => validateAudioUrl(u, allowed));
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.1.1",
    "169.254.169.254",
    "192.168.1.1",
    "100.64.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])
    assert.equal(isPublicAddress(ip), false, ip);
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
});
