import { createHash } from "node:crypto";
import { announcementSchema, parseJob, type Announcement, type JobKind } from "@noxis/shared";
import { query, transaction } from "./connection.js";
export async function recordAudit(
  guildId: string,
  actorId: string | null,
  action: string,
  targetId?: string,
  details: object = {},
) {
  await query(
    "INSERT INTO audit_events(guild_id,actor_id,action,target_id,details) VALUES ($1,$2,$3,$4,$5::jsonb)",
    [guildId, actorId, action, targetId ?? null, JSON.stringify(details)],
  );
}
export type Job = {
  id: string;
  guild_id: string;
  actor_id: string;
  kind: JobKind;
  payload: unknown;
  status: string;
  result: unknown;
  error: string | null;
  created_at: Date;
};
export async function enqueueJob(
  guildId: string,
  actorId: string,
  kind: JobKind,
  input: unknown,
  requestId: string,
) {
  const payload = parseJob(kind, input);
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ kind, payload, actorId }))
    .digest("hex");
  return transaction(async (c) => {
    const result = await c.query<Job & { fingerprint: string }>(
      `INSERT INTO bot_jobs(guild_id,actor_id,kind,payload,request_key,fingerprint) VALUES ($1,$2,$3,$4::jsonb,$5,$6)
       ON CONFLICT (guild_id,request_key) DO UPDATE SET request_key=EXCLUDED.request_key RETURNING *`,
      [guildId, actorId, kind, JSON.stringify(payload), requestId, fingerprint],
    );
    const job = result.rows[0]!;
    if (job.fingerprint !== fingerprint) throw new Error("IDEMPOTENCY_CONFLICT");
    await c.query(
      "INSERT INTO audit_events(guild_id,actor_id,action,target_id) VALUES ($1,$2,'job.request',$3)",
      [guildId, actorId, job.id],
    );
    return job;
  });
}
export async function claimJob(guildId: string): Promise<Job | undefined> {
  return (
    await query<Job>(
      `UPDATE bot_jobs SET status='running',started_at=NOW() WHERE id=(SELECT id FROM bot_jobs WHERE guild_id=$1 AND status='pending' ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,
      [guildId],
    )
  ).rows[0];
}
export async function finishJob(job: Job, result: unknown, error?: string) {
  await transaction(async (c) => {
    await c.query(
      "UPDATE bot_jobs SET status=$2,result=$3::jsonb,error=$4,finished_at=NOW() WHERE id=$1 AND status='running'",
      [job.id, error ? "failed" : "succeeded", JSON.stringify(result ?? null), error ?? null],
    );
    await c.query(
      "INSERT INTO audit_events(guild_id,actor_id,action,target_id,details) VALUES ($1,$2,$3,$4,$5::jsonb)",
      [
        job.guild_id,
        job.actor_id,
        `job.${error ? "failed" : "succeeded"}`,
        job.id,
        JSON.stringify({ kind: job.kind }),
      ],
    );
  });
}
export const listJobs = async (guildId: string) =>
  (
    await query<Job>(
      "SELECT id,kind,payload,status,result,error,created_at FROM bot_jobs WHERE guild_id=$1 ORDER BY id DESC LIMIT 50",
      [guildId],
    )
  ).rows;
export async function recoverInterrupted(guildId: string) {
  await query(
    "UPDATE bot_jobs SET status='needs_review',error='Ejecución interrumpida: revisa Discord antes de repetir.' WHERE guild_id=$1 AND status='running' AND started_at<NOW()-INTERVAL '5 minutes'",
    [guildId],
  );
  await query(
    "UPDATE scheduled_announcements SET status='failed',last_error='Entrega interrumpida: revisar canal antes de reenviar.' WHERE guild_id=$1 AND status='processing' AND started_at<NOW()-INTERVAL '5 minutes'",
    [guildId],
  );
}
export async function scheduleAnnouncement(
  guildId: string,
  actorId: string,
  channelId: string,
  input: Announcement,
  date: Date,
) {
  const payload = announcementSchema.parse(input);
  return transaction(async (c) => {
    const row = (
      await c.query(
        "INSERT INTO scheduled_announcements(guild_id,channel_id,payload,scheduled_for,created_by) VALUES ($1,$2,$3::jsonb,$4,$5) RETURNING *",
        [guildId, channelId, JSON.stringify(payload), date, actorId],
      )
    ).rows[0];
    await c.query(
      "INSERT INTO audit_events(guild_id,actor_id,action,target_id) VALUES ($1,$2,'announcement.schedule',$3)",
      [guildId, actorId, String(row.id)],
    );
    return row;
  });
}
export const listAnnouncements = async (guildId: string) =>
  (
    await query(
      "SELECT * FROM scheduled_announcements WHERE guild_id=$1 ORDER BY created_at DESC LIMIT 50",
      [guildId],
    )
  ).rows;
export async function cancelAnnouncement(guildId: string, id: string, actorId: string) {
  return transaction(async (c) => {
    const result = await c.query(
      "UPDATE scheduled_announcements SET status='cancelled' WHERE guild_id=$1 AND id=$2 AND status='pending' RETURNING id",
      [guildId, id],
    );
    if (result.rowCount)
      await c.query(
        "INSERT INTO audit_events(guild_id,actor_id,action,target_id) VALUES ($1,$2,'announcement.cancel',$3)",
        [guildId, actorId, id],
      );
    return Boolean(result.rowCount);
  });
}
export type DueAnnouncement = {
  id: string;
  guild_id: string;
  channel_id: string;
  created_by: string;
  payload: Announcement;
};
export async function claimAnnouncement(guildId: string) {
  return (
    await query<DueAnnouncement>(
      `UPDATE scheduled_announcements SET status='processing',started_at=NOW() WHERE id=(SELECT id FROM scheduled_announcements WHERE guild_id=$1 AND status='pending' AND scheduled_for<=NOW() ORDER BY scheduled_for FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,
      [guildId],
    )
  ).rows[0];
}
export async function finishAnnouncement(id: string, messageId?: string) {
  await query(
    "UPDATE scheduled_announcements SET status=$2,message_id=$3,last_error=$4 WHERE id=$1 AND status='processing'",
    [
      id,
      messageId ? "sent" : "failed",
      messageId ?? null,
      messageId ? null : "No se confirmó la entrega. Revisa permisos y el canal antes de repetir.",
    ],
  );
}
