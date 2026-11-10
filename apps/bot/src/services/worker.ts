import { PermissionFlagsBits as P, ChannelType, type Guild } from "discord.js";
import * as db from "@noxis/database";
import { jobPayloadSchemas, type JobKind } from "@noxis/shared";
import { createRole, changeRole } from "./roles.js";
import { applyTemplate } from "./templates.js";
import { sendAnnouncement } from "./announcements.js";
import { musicManager } from "./music.js";
import { finishGiveaways, reconcileTickets } from "./community.js";
import { assertActor } from "../utils/permissions.js";
export async function executeJob(guild: Guild, job: db.Job): Promise<unknown> {
  if (job.guild_id !== guild.id) throw new Error("Servidor incorrecto.");
  switch (job.kind) {
    case "announcement.send": {
      const p = jobPayloadSchemas[job.kind].parse(job.payload);
      return sendAnnouncement(guild, job.actor_id, p.channelId, p.embed, `j${job.id}`);
    }
    case "template.apply": {
      const p = jobPayloadSchemas[job.kind].parse(job.payload);
      return applyTemplate(guild, job.actor_id, p.type);
    }
    case "role.create":
      return createRole(guild, job.actor_id, job.payload);
    case "role.assign":
    case "role.remove": {
      const p = jobPayloadSchemas[job.kind].parse(job.payload);
      return changeRole(guild, job.actor_id, p.userId, p.roleId, job.kind === "role.assign");
    }
    case "music.play": {
      const p = jobPayloadSchemas[job.kind].parse(job.payload);
      await assertActor(guild, job.actor_id, P.ManageGuild);
      const channel = await guild.channels.fetch(p.voiceChannelId);
      if (channel?.type !== ChannelType.GuildVoice) throw new Error("Canal de voz inválido.");
      const position = await musicManager.enqueue(guild, channel, {
        url: p.url,
        title: p.title,
        requestedBy: job.actor_id,
      });
      await db.recordAudit(guild.id, job.actor_id, "music.play", channel.id);
      return { position };
    }
    case "music.control": {
      const p = jobPayloadSchemas[job.kind].parse(job.payload);
      await assertActor(guild, job.actor_id, P.ManageGuild);
      const ok =
        p.action === "pausa"
          ? musicManager.pause(guild.id)
          : p.action === "reanudar"
            ? musicManager.resume(guild.id)
            : p.action === "saltar"
              ? musicManager.skip(guild.id)
              : p.action === "detener"
                ? musicManager.stop(guild.id)
                : musicManager.setVolume(guild.id, (p.volume ?? 65) / 100);
      if (!ok) throw new Error("La sesión no admite ese control.");
      await db.recordAudit(guild.id, job.actor_id, `music.${p.action}`);
      return { ok };
    }
    default:
      throw new Error("Trabajo no reconocido.");
  }
}
export async function runJob(job: db.Job, execute: (job: db.Job) => Promise<unknown>) {
  try {
    await db.finishJob(job, await execute(job));
  } catch {
    await db.finishJob(
      job,
      null,
      "No se confirmó la operación. Revisa permisos, jerarquía, configuración y auditoría antes de repetir.",
    );
  }
}
export function startWorker(guild: Guild) {
  let running = false,
    closed = false;
  async function tick() {
    if (running || closed) return;
    running = true;
    try {
      await db.recoverInterrupted(guild.id);
      for (let i = 0; i < 5 && !closed; i++) {
        const job = await db.claimJob(guild.id);
        if (!job) break;
        await runJob(job, (j) => executeJob(guild, j));
      }
      for (let i = 0; i < 5 && !closed; i++) {
        const item = await db.claimAnnouncement(guild.id);
        if (!item) break;
        try {
          const message = await sendAnnouncement(
            guild,
            item.created_by,
            item.channel_id,
            item.payload,
            `a${item.id}`,
          );
          await db.finishAnnouncement(item.id, message.id);
        } catch {
          await db.finishAnnouncement(item.id);
          await db.recordAudit(guild.id, item.created_by, "announcement.failed", String(item.id));
        }
      }
      await finishGiveaways(guild);
      await reconcileTickets(guild);
      await db.heartbeat(guild.id, {
        guildName: guild.name,
        memberCount: guild.memberCount,
        music: musicManager.snapshot(guild.id),
      });
      await db.query("DELETE FROM web_sessions WHERE expires_at<NOW()");
    } catch {
      console.error("NOXIS worker: operación interrumpida; se reintentará la consulta.");
    } finally {
      running = false;
    }
  }
  const timer = setInterval(() => void tick(), 5000);
  timer.unref();
  void tick();
  return async () => {
    closed = true;
    clearInterval(timer);
    while (running) await new Promise((r) => setTimeout(r, 50));
  };
}
