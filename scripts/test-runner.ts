import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { testEnv } from "./test-env.js";
const external = process.env.TEST_DATABASE_URL;
if (external && !new URL(external).pathname.endsWith("_test"))
  throw new Error("TEST_DATABASE_URL debe usar una base exclusiva terminada en _test.");
const db = external ? null : await PGlite.create();
const server = db
  ? new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1", maxConnections: 1 })
  : null;
if (server) await server.start();
const url = external ?? `postgresql://test:test@${server!.getServerConn()}/noxis_test`;
Object.assign(process.env, testEnv(url));
const { migrate } = await import("../packages/database/scripts/migrate.js");
await migrate();
const { query, closeDatabase } = await import("@noxis/database");
// This runner only accepts a dedicated test database. Clear fixture rows for repeatability.
for (const table of [
  "bot_jobs",
  "scheduled_announcements",
  "announcement_templates",
  "music_playlists",
  "tickets",
  "polls",
  "giveaways",
  "member_levels",
  "audit_events",
  "security_events",
  "guild_settings",
  "bot_status",
  "bot_leases",
]) {
  await query(`DELETE FROM ${table} WHERE guild_id IN ($1,$2)`, [
    "111111111111111111",
    "555555555555555555",
  ]);
}
await query("DELETE FROM web_sessions WHERE user_id IN ($1,$2)", [
  "222222222222222222",
  "555555555555555555",
]);
await closeDatabase();
console.log(
  external
    ? "Pruebas contra PostgreSQL externo de test."
    : "Pruebas contra PostgreSQL WASM aislado por TCP (PGlite). La prueba de concurrencia nativa requiere TEST_DATABASE_URL con PostgreSQL 17.",
);
try {
  const files = (await readdir("tests"))
    .filter((n) => n.endsWith(".test.ts"))
    .map((n) => `tests/${n}`);
  const code = await new Promise<number>((resolve) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "--test", "--test-concurrency=1", ...files],
      {
        env: { ...testEnv(url), ...(external ? { DATABASE_POOL_MAX: "10" } : {}) },
        stdio: "inherit",
      },
    );
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
  process.exitCode = code;
} finally {
  await server?.stop();
  await db?.close();
}
