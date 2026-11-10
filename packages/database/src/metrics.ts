import { query } from "./connection.js";
export async function recordSecurityEvent(input: {
  guildId: string;
  eventType: string;
  severity?: "info" | "warning" | "critical";
  actorId?: string | null;
  details?: Record<string, unknown>;
}) {
  await query(
    "INSERT INTO security_events(guild_id,event_type,severity,actor_id,details) VALUES ($1,$2,$3,$4,$5::jsonb)",
    [
      input.guildId,
      input.eventType,
      input.severity ?? "info",
      input.actorId ?? null,
      JSON.stringify(input.details ?? {}),
    ],
  );
}
export async function getDashboardOverview(guildId: string) {
  return (
    await query(
      `SELECT (SELECT COUNT(*) FROM guild_settings WHERE guild_id=$1)::int AS "configuredServers",(SELECT COUNT(*) FROM security_events WHERE guild_id=$1 AND created_at>=NOW()-INTERVAL '7 days')::int AS "securityEvents7d",(SELECT COUNT(*) FROM scheduled_announcements WHERE guild_id=$1 AND status='pending')::int AS "pendingAnnouncements",(SELECT COUNT(*) FROM music_playlists WHERE guild_id=$1)::int AS "savedPlaylists",(SELECT COUNT(*) FROM tickets WHERE guild_id=$1 AND status='open')::int AS "openTickets",(SELECT COUNT(*) FROM member_levels WHERE guild_id=$1)::int AS "rankedMembers"`,
      [guildId],
    )
  ).rows[0];
}
export async function listEvents(guildId: string, kind: "audit" | "security") {
  return (
    await query(
      `SELECT * FROM ${kind === "audit" ? "audit_events" : "security_events"} WHERE guild_id=$1 ORDER BY id DESC LIMIT 100`,
      [guildId],
    )
  ).rows;
}
export async function heartbeat(guildId: string, snapshot: object) {
  await query(
    "INSERT INTO bot_status(guild_id,snapshot,updated_at) VALUES ($1,$2::jsonb,NOW()) ON CONFLICT(guild_id) DO UPDATE SET snapshot=EXCLUDED.snapshot,updated_at=NOW()",
    [guildId, JSON.stringify(snapshot)],
  );
}
export async function getBotStatus(guildId: string) {
  return (
    (
      await query(
        "SELECT snapshot,updated_at,(updated_at>NOW()-INTERVAL '45 seconds') AS online FROM bot_status WHERE guild_id=$1",
        [guildId],
      )
    ).rows[0] ?? { online: false, snapshot: null }
  );
}
