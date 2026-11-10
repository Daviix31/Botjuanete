import { EmbedBuilder, type Guild, PermissionFlagsBits as P } from "discord.js";
import { getGuildSettings, recordSecurityEvent } from "@noxis/database";
import { disabledMentions } from "@noxis/shared";
export async function logSecurity(
  guild: Guild,
  event: {
    type: string;
    message: string;
    severity?: "info" | "warning" | "critical";
    actorId?: string;
    details?: Record<string, unknown>;
  },
) {
  await recordSecurityEvent({
    guildId: guild.id,
    eventType: event.type,
    severity: event.severity,
    actorId: event.actorId,
    details: event.details,
  });
  const settings = await getGuildSettings(guild.id);
  if (!settings.logsChannelId) return;
  const channel = await guild.channels.fetch(settings.logsChannelId);
  const bot = await guild.members.fetchMe();
  if (
    !channel?.isSendable() ||
    !channel.permissionsFor(bot)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks])
  )
    return;
  const embed = new EmbedBuilder()
    .setColor(
      event.severity === "critical" ? 0xd62828 : event.severity === "warning" ? 0xe58a24 : 0x555555,
    )
    .setTitle(`NOXIS SECURITY · ${event.type}`)
    .setDescription(event.message.slice(0, 4000))
    .setFooter({ text: "NOXIS STUDIOS" })
    .setTimestamp();
  await channel.send({ embeds: [embed], allowedMentions: disabledMentions });
}
