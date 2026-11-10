import "@noxis/shared/env";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const required = [
  "DATABASE_URL",
  "DISCORD_TOKEN",
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "DISCORD_GUILD_ID",
  "OWNER_USER_IDS",
  "SESSION_SECRET",
  "DISCORD_REDIRECT_URI",
  "DASHBOARD_URL",
];
const missing = required.filter((key) => !process.env[key]);
console.log(`Node ${process.versions.node}`);
for (const key of required) console.log(`${process.env[key] ? "OK" : "FALTA"} ${key}`);
let failed = missing.length > 0;
const require = createRequire(import.meta.url);
let ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
try {
  ffmpeg = process.env.FFMPEG_PATH || require("ffmpeg-static") || ffmpeg;
} catch {}
const available = spawnSync(ffmpeg, ["-version"], { stdio: "ignore" }).status === 0;
console.log(available ? "OK FFmpeg" : "FALTA FFmpeg");
if (!available) failed = true;
const { generateDependencyReport } = await import("@discordjs/voice");
const dave = /@snazzah\/davey: \d/.test(generateDependencyReport());
console.log(dave ? "OK DAVE" : "FALTA DAVE");
if (!dave) failed = true;
if (process.env.DATABASE_URL) {
  const { pool, closeDatabase } = await import("@noxis/database");
  try {
    await pool.query("SELECT 1 FROM schema_migrations LIMIT 1");
    console.log("OK PostgreSQL y migraciones");
  } catch {
    console.log("FALTA conexión a PostgreSQL o migraciones");
    failed = true;
  } finally {
    await closeDatabase();
  }
}
if (process.argv.includes("--live") && !missing.length) {
  try {
    const response = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error();
    const user = (await response.json()) as { bot?: boolean };
    if (!user.bot) throw new Error();
    console.log("OK autenticación REST del bot oficial de Discord");
  } catch {
    console.log("FALTA autenticación REST en Discord");
    failed = true;
  }
}
if (!process.argv.includes("--live"))
  console.log(
    "La conexión real a Discord se verifica con npm run doctor -- --live, después de completar .env.",
  );
process.exitCode = failed ? 1 : 0;
