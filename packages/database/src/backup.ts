import { transaction } from "./connection.js";
const tables = [
  "guild_settings",
  "security_events",
  "audit_events",
  "scheduled_announcements",
  "music_playlists",
  "announcement_templates",
  "tickets",
  "polls",
  "giveaways",
  "member_levels",
] as const;
export async function exportGuildData(guildId: string) {
  return transaction(async (c) => {
    await c.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const data: Record<string, unknown[]> = {};
    for (const table of tables)
      data[table] = (await c.query(`SELECT * FROM ${table} WHERE guild_id=$1`, [guildId])).rows;
    data.poll_votes = (
      await c.query(
        "SELECT v.* FROM poll_votes v JOIN polls p ON p.id=v.poll_id WHERE p.guild_id=$1",
        [guildId],
      )
    ).rows;
    data.giveaway_entries = (
      await c.query(
        "SELECT e.* FROM giveaway_entries e JOIN giveaways g ON g.id=e.giveaway_id WHERE g.guild_id=$1",
        [guildId],
      )
    ).rows;
    return {
      format: "noxis-guild-export",
      version: 1,
      exportedAt: new Date().toISOString(),
      guildId,
      data,
    };
  });
}
