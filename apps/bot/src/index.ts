import "./env.js";
import { randomUUID } from "node:crypto";
import { Events } from "discord.js";
import { BotClient } from "./client.js";
import { commands } from "./commands/index.js";
import { registerEvents } from "./events/register.js";
import { config } from "./config.js";
import { closeDatabase, query } from "@noxis/database";
import { musicManager } from "./services/music.js";
import { startWorker } from "./services/worker.js";
const client = new BotClient(),
  instanceId = randomUUID();
let stopWorker: (() => Promise<void>) | undefined,
  closing = false;
async function lease() {
  return Boolean(
    (
      await query(
        "INSERT INTO bot_leases(guild_id,instance_id,expires_at) VALUES ($1,$2,NOW()+INTERVAL '120 seconds') ON CONFLICT(guild_id) DO UPDATE SET instance_id=EXCLUDED.instance_id,expires_at=EXCLUDED.expires_at WHERE bot_leases.expires_at<NOW() OR bot_leases.instance_id=EXCLUDED.instance_id RETURNING guild_id",
        [config.DISCORD_GUILD_ID, instanceId],
      )
    ).rowCount,
  );
}
if (!(await lease())) {
  console.error("Ya hay otra instancia activa de NOXIS BOT para este servidor.");
  await closeDatabase();
  process.exit(1);
}
const timer = setInterval(
  () =>
    void lease()
      .then((ok) => {
        if (!ok) void shutdown(1);
      })
      .catch(() => void shutdown(1)),
  10000,
);
timer.unref();
async function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  clearInterval(timer);
  musicManager.stopAll();
  client.destroy();
  await stopWorker?.();
  await query("DELETE FROM bot_leases WHERE guild_id=$1 AND instance_id=$2", [
    config.DISCORD_GUILD_ID,
    instanceId,
  ]).catch(() => undefined);
  await closeDatabase();
  process.exitCode = code;
}
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
for (const command of commands) client.commands.set(command.data.name, command);
registerEvents(client);
client.once(Events.ClientReady, (ready) => {
  void (async () => {
    const guild = await ready.guilds.fetch(config.DISCORD_GUILD_ID);
    stopWorker = startWorker(guild);
    console.log(`NOXIS BOT conectado; ${commands.length} comandos cargados.`);
  })().catch(() => void shutdown(1));
});
try {
  await client.login(config.DISCORD_TOKEN);
} catch {
  console.error("No se pudo conectar a Discord. Revisa el token e intents en .env.");
  await shutdown(1);
}
