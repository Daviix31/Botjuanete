import { EmbedBuilder, ChannelType, PermissionFlagsBits as P, type Guild } from "discord.js";
import { announcementSchema, disabledMentions } from "@noxis/shared";
import { recordAudit } from "@noxis/database";
import { assertActor } from "../utils/permissions.js";
export async function sendAnnouncement(
  guild: Guild,
  actorId: string,
  channelId: string,
  input: unknown,
  nonce?: string,
) {
  const data = announcementSchema.parse(input),
    actor = await assertActor(guild, actorId, P.ManageMessages);
  const channel = await guild.channels.fetch(channelId);
  const bot = await guild.members.fetchMe();
  if (
    !channel ||
    !(channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)
  )
    throw new Error("El canal de destino no es válido.");
  if (!channel.permissionsFor(bot)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks]))
    throw new Error("El bot no puede publicar embeds en ese canal.");
  if (!channel.permissionsFor(actor)?.has([P.ViewChannel, P.SendMessages]))
    throw new Error("Tu cuenta no puede publicar en ese canal.");
  const embed = new EmbedBuilder()
    .setTitle(data.title)
    .setDescription(data.description)
    .setColor(parseInt(data.color.slice(1), 16))
    .setFooter({ text: "NOXIS STUDIOS" })
    .setTimestamp();
  if (data.image) embed.setImage(data.image);
  await recordAudit(guild.id, actorId, "announcement.send.request", channelId);
  const message = await channel.send({
    embeds: [embed],
    allowedMentions: disabledMentions,
    ...(nonce ? { nonce, enforceNonce: true } : {}),
  });
  await recordAudit(guild.id, actorId, "announcement.send", message.id, { channelId });
  return { id: message.id };
}
