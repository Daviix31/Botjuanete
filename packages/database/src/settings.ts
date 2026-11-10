import { settingsPatchSchema, type GuildSettings } from "@noxis/shared";
import { query, transaction } from "./connection.js";
export type { GuildSettings } from "@noxis/shared";
export async function getGuildSettings(guildId: string): Promise<GuildSettings> {
  return (
    (
      await query<{ settings: GuildSettings }>(
        "SELECT settings FROM guild_settings WHERE guild_id=$1",
        [guildId],
      )
    ).rows[0]?.settings ?? {}
  );
}
export async function updateGuildSettings(
  guildId: string,
  input: GuildSettings,
  actorId?: string,
): Promise<GuildSettings> {
  const patch = settingsPatchSchema.parse(input);
  return transaction(async (client) => {
    const result = await client.query<{ settings: GuildSettings }>(
      `INSERT INTO guild_settings (guild_id,settings) VALUES ($1,$2::jsonb)
       ON CONFLICT (guild_id) DO UPDATE SET settings=noxis_json_merge(guild_settings.settings,EXCLUDED.settings),updated_at=NOW() RETURNING settings`,
      [guildId, JSON.stringify(patch)],
    );
    await client.query(
      "INSERT INTO audit_events(guild_id,actor_id,action,details) VALUES ($1,$2,'settings.update',$3::jsonb)",
      [guildId, actorId ?? null, JSON.stringify({ patch })],
    );
    return result.rows[0]!.settings;
  });
}
