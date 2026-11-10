import "@noxis/shared/env";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { transaction, closeDatabase } from "../src/connection.js";
export async function migrate() {
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(741369)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT NOW())",
    );
    const dir = new URL("../migrations/", import.meta.url);
    for (const name of (await readdir(dir)).filter((n) => /^\d+.*\.sql$/.test(n)).sort()) {
      const sql = await readFile(new URL(name, dir), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = (
        await client.query("SELECT checksum FROM schema_migrations WHERE name=$1", [name])
      ).rows[0];
      if (existing) {
        if (existing.checksum !== checksum) throw new Error(`Migración modificada: ${name}`);
        continue;
      }
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(name,checksum) VALUES ($1,$2)", [
        name,
        checksum,
      ]);
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await migrate();
    console.log("NOXIS BOT: migraciones verificadas y aplicadas.");
  } catch {
    console.error("Migración fallida. Comprueba PostgreSQL y el historial de migraciones.");
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}
