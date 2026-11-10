import { randomInt } from "node:crypto";
import { levelFromXp, type Announcement } from "@noxis/shared";
import { query, transaction } from "./connection.js";
export async function saveEmbedTemplate(
  guildId: string,
  actorId: string,
  name: string,
  payload: Announcement,
) {
  return transaction(async (c) => {
    const result = await c.query(
      "INSERT INTO announcement_templates(guild_id,name,payload,created_by) VALUES ($1,$2,$3::jsonb,$4) ON CONFLICT(guild_id,name) DO UPDATE SET payload=EXCLUDED.payload,created_by=EXCLUDED.created_by RETURNING *",
      [guildId, name, JSON.stringify(payload), actorId],
    );
    await c.query(
      "INSERT INTO audit_events(guild_id,actor_id,action,target_id) VALUES ($1,$2,'embed_template.save',$3)",
      [guildId, actorId, String(result.rows[0].id)],
    );
    return result.rows[0];
  });
}
export const listEmbedTemplates = async (guildId: string) =>
  (
    await query("SELECT * FROM announcement_templates WHERE guild_id=$1 ORDER BY name LIMIT 100", [
      guildId,
    ])
  ).rows;
export async function savePlaylist(
  guildId: string,
  ownerId: string,
  name: string,
  tracks: object[],
) {
  return (
    await query(
      "INSERT INTO music_playlists(guild_id,owner_id,name,tracks) VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT(guild_id,owner_id,name) DO UPDATE SET tracks=EXCLUDED.tracks RETURNING *",
      [guildId, ownerId, name, JSON.stringify(tracks)],
    )
  ).rows[0];
}
export const listPlaylists = async (guildId: string, ownerId: string) =>
  (
    await query(
      "SELECT * FROM music_playlists WHERE guild_id=$1 AND owner_id=$2 ORDER BY name LIMIT 100",
      [guildId, ownerId],
    )
  ).rows;
export async function reserveTicket(guildId: string, userId: string) {
  return (
    await query(
      "INSERT INTO tickets(guild_id,user_id) VALUES ($1,$2) ON CONFLICT(guild_id,user_id) WHERE status IN ('creating','open') DO NOTHING RETURNING *",
      [guildId, userId],
    )
  ).rows[0];
}
export async function setTicketChannel(id: string, channelId?: string) {
  await query("UPDATE tickets SET channel_id=$2,status=$3 WHERE id=$1", [
    id,
    channelId ?? null,
    channelId ? "open" : "failed",
  ]);
}
export const getTicketByChannel = async (guildId: string, channelId: string) =>
  (
    await query("SELECT * FROM tickets WHERE guild_id=$1 AND channel_id=$2 AND status='open'", [
      guildId,
      channelId,
    ])
  ).rows[0];
export async function closeTicket(id: string) {
  return Boolean(
    (
      await query(
        "UPDATE tickets SET status='closed',closed_at=NOW() WHERE id=$1 AND status='open' RETURNING id",
        [id],
      )
    ).rowCount,
  );
}
export async function createPoll(
  guildId: string,
  channelId: string,
  actorId: string,
  question: string,
  options: string[],
) {
  return (
    await query(
      "INSERT INTO polls(guild_id,channel_id,question,options,created_by) VALUES ($1,$2,$3,$4::jsonb,$5) RETURNING *",
      [guildId, channelId, question, JSON.stringify(options), actorId],
    )
  ).rows[0];
}
export async function vote(guildId: string, pollId: string, userId: string, index: number) {
  return transaction(async (c) => {
    const row = (
      await c.query("SELECT * FROM polls WHERE id=$1 AND guild_id=$2 FOR UPDATE", [pollId, guildId])
    ).rows[0];
    if (
      !row ||
      row.status !== "open" ||
      index < 0 ||
      !Number.isInteger(index) ||
      index >= row.options.length
    )
      return false;
    await c.query(
      "INSERT INTO poll_votes(poll_id,user_id,option_index) VALUES ($1,$2,$3) ON CONFLICT(poll_id,user_id) DO UPDATE SET option_index=EXCLUDED.option_index",
      [pollId, userId, index],
    );
    return true;
  });
}
export async function pollResults(guildId: string, id: string) {
  const poll = (
    await query<{
      id: string;
      channel_id: string;
      message_id: string | null;
      question: string;
      status: string;
      options: string[];
    }>("SELECT * FROM polls WHERE guild_id=$1 AND id=$2", [guildId, id])
  ).rows[0];
  if (!poll) return null;
  const counts = (
    await query<{ option_index: number; votes: number }>(
      "SELECT option_index,COUNT(*)::int AS votes FROM poll_votes WHERE poll_id=$1 GROUP BY option_index",
      [id],
    )
  ).rows;
  return { ...poll, counts };
}
export async function endPoll(guildId: string, id: string) {
  return Boolean(
    (
      await query(
        "UPDATE polls SET status='closed' WHERE guild_id=$1 AND id=$2 AND status='open' RETURNING id",
        [guildId, id],
      )
    ).rowCount,
  );
}
export async function createGiveaway(
  guildId: string,
  channelId: string,
  actorId: string,
  prize: string,
  endsAt: Date,
) {
  return (
    await query(
      "INSERT INTO giveaways(guild_id,channel_id,prize,created_by,ends_at) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [guildId, channelId, prize, actorId, endsAt],
    )
  ).rows[0];
}
export async function enterGiveaway(guildId: string, id: string, userId: string) {
  return transaction(async (c) => {
    const row = (
      await c.query(
        "SELECT id FROM giveaways WHERE guild_id=$1 AND id=$2 AND status='open' AND ends_at>NOW() FOR UPDATE",
        [guildId, id],
      )
    ).rows[0];
    if (!row) return false;
    await c.query(
      "INSERT INTO giveaway_entries(giveaway_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [id, userId],
    );
    return true;
  });
}
export async function drawGiveaway(guildId: string, id: string) {
  return transaction(async (c) => {
    const row = (
      await c.query("SELECT * FROM giveaways WHERE guild_id=$1 AND id=$2 FOR UPDATE", [guildId, id])
    ).rows[0];
    if (!row || row.status !== "open" || new Date(row.ends_at).getTime() > Date.now()) return null;
    const entries = (
      await c.query<{ user_id: string }>(
        "SELECT user_id FROM giveaway_entries WHERE giveaway_id=$1 ORDER BY user_id",
        [id],
      )
    ).rows;
    const winners = entries.length ? [entries[randomInt(entries.length)]!.user_id] : [];
    await c.query("UPDATE giveaways SET status='closed',winner_ids=$2::jsonb WHERE id=$1", [
      id,
      JSON.stringify(winners),
    ]);
    return { ...row, winner_ids: winners, status: "closed" };
  });
}
export const dueGiveaways = async (guildId: string) =>
  (
    await query(
      "SELECT * FROM giveaways WHERE guild_id=$1 AND (status='open' AND ends_at<=NOW() OR status='closed' AND announced=false) ORDER BY id LIMIT 20",
      [guildId],
    )
  ).rows;
export async function awardXp(guildId: string, userId: string) {
  const row = (
    await query<{ xp: number }>(
      "INSERT INTO member_levels(guild_id,user_id,xp,messages) VALUES ($1,$2,15,1) ON CONFLICT(guild_id,user_id) DO UPDATE SET xp=member_levels.xp+15,messages=member_levels.messages+1,last_awarded_at=NOW() WHERE member_levels.last_awarded_at<=NOW()-INTERVAL '60 seconds' RETURNING xp",
      [guildId, userId],
    )
  ).rows[0];
  return row ? { ...row, level: levelFromXp(row.xp) } : null;
}
export const leaderboard = async (guildId: string) =>
  (
    await query<{ user_id: string; xp: number; messages: number }>(
      "SELECT user_id,xp,messages FROM member_levels WHERE guild_id=$1 ORDER BY xp DESC,user_id LIMIT 20",
      [guildId],
    )
  ).rows.map((r) => ({ ...r, level: levelFromXp(r.xp) }));
export const listCommunity = async (guildId: string) => ({
  tickets: (
    await query("SELECT * FROM tickets WHERE guild_id=$1 ORDER BY id DESC LIMIT 50", [guildId])
  ).rows,
  polls: (
    await query(
      "SELECT p.*,COUNT(v.user_id)::int AS votes FROM polls p LEFT JOIN poll_votes v ON v.poll_id=p.id WHERE p.guild_id=$1 GROUP BY p.id ORDER BY p.id DESC LIMIT 50",
      [guildId],
    )
  ).rows,
  giveaways: (
    await query(
      "SELECT g.*,COUNT(e.user_id)::int AS entries FROM giveaways g LEFT JOIN giveaway_entries e ON e.giveaway_id=g.id WHERE g.guild_id=$1 GROUP BY g.id ORDER BY g.id DESC LIMIT 50",
      [guildId],
    )
  ).rows,
  levels: await leaderboard(guildId),
});
