import "@noxis/shared/env";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { exportGuildData, closeDatabase } from "@noxis/database";
import { snowflake } from "@noxis/shared";
try {
  const guildId = snowflake.parse(process.env.DISCORD_GUILD_ID),
    data = await exportGuildData(guildId),
    dir = resolve("backups");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const path = resolve(dir, `noxis-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(path, JSON.stringify(data, null, 2), { mode: 0o600, flag: "wx" });
  console.log(`Exportación guardada: ${path}`);
} catch {
  console.error("No se pudo exportar. Comprueba PostgreSQL, migraciones y DISCORD_GUILD_ID.");
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
