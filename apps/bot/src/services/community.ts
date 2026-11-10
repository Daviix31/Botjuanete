import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits as P,
  type Guild,
  type ButtonInteraction,
} from "discord.js";
import * as db from "@noxis/database";
import { disabledMentions } from "@noxis/shared";
import { assertActor, assertBot } from "../utils/permissions.js";
export async function openTicket(guild: Guild, userId: string) {
  const settings = await db.getGuildSettings(guild.id);
  if (!settings.tickets?.enabled || !settings.tickets.categoryId || !settings.tickets.staffRoleId)
    throw new Error("Configura y activa tickets en el panel.");
  const [category, staff, bot] = await Promise.all([
    guild.channels.fetch(settings.tickets.categoryId),
    guild.roles.fetch(settings.tickets.staffRoleId),
    assertBot(guild, [P.ManageChannels]),
  ]);
  if (category?.type !== ChannelType.GuildCategory || !staff || staff.id === guild.id)
    throw new Error("Categoría o rol de soporte inválidos.");
  const recent = await db.query(
    "SELECT id FROM tickets WHERE guild_id=$1 AND user_id=$2 AND created_at>NOW()-INTERVAL '5 minutes'",
    [guild.id, userId],
  );
  if (recent.rowCount) throw new Error("Espera cinco minutos antes de abrir otro ticket.");
  const ticket = await db.reserveTicket(guild.id, userId);
  if (!ticket) throw new Error("Ya tienes un ticket abierto o en creación.");
  try {
    const channel = await guild.channels.create({
      name: `ticket-${ticket.id}`,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: `NOXIS ticket ${ticket.id} · user ${userId}`,
      permissionOverwrites: [
        { id: guild.id, deny: [P.ViewChannel] },
        { id: userId, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] },
        { id: staff.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] },
        {
          id: bot.id,
          allow: [
            P.ViewChannel,
            P.SendMessages,
            P.EmbedLinks,
            P.ReadMessageHistory,
            P.ManageChannels,
          ],
        },
      ],
      reason: `NOXIS ticket · ${userId}`,
    });
    // Persist the channel before sending so a failed welcome cannot cause duplicate tickets.
    await db.setTicketChannel(String(ticket.id), channel.id);
    await db.recordAudit(guild.id, userId, "ticket.open", channel.id);
    await channel
      .send({
        content: `Ticket de <@${userId}>. Usa /ticket cerrar al terminar.`,
        allowedMentions: disabledMentions,
      })
      .catch(() => undefined);
    return channel.id;
  } catch (error) {
    const row = await db.query("SELECT channel_id FROM tickets WHERE id=$1", [ticket.id]);
    if (!row.rows[0]?.channel_id) await db.setTicketChannel(String(ticket.id));
    throw error;
  }
}
export async function closeUserTicket(guild: Guild, userId: string, channelId: string) {
  const ticket = await db.getTicketByChannel(guild.id, channelId);
  if (!ticket) throw new Error("Este canal no es un ticket abierto.");
  const member = await guild.members.fetch(userId),
    settings = await db.getGuildSettings(guild.id);
  if (
    userId !== ticket.user_id &&
    !member.permissions.has(P.ManageChannels) &&
    !member.roles.cache.has(settings.tickets?.staffRoleId ?? "")
  )
    throw new Error("Solo el creador o soporte puede cerrar este ticket.");
  const channel = await guild.channels.fetch(channelId);
  if (channel?.type !== ChannelType.GuildText) throw new Error("Canal de ticket inválido.");
  await assertBot(guild, [P.ManageChannels]);
  await channel.permissionOverwrites.edit(
    ticket.user_id,
    { SendMessages: false },
    { reason: `NOXIS cerrar ticket · ${userId}` },
  );
  await db.closeTicket(String(ticket.id));
  await db.recordAudit(guild.id, userId, "ticket.close", channel.id);
  return channel.id;
}
export async function publishPoll(
  guild: Guild,
  actorId: string,
  channelId: string,
  question: string,
  options: string[],
) {
  await assertActor(guild, actorId, P.ManageMessages);
  const channel = await guild.channels.fetch(channelId),
    bot = await guild.members.fetchMe();
  if (
    !channel?.isSendable() ||
    !channel.permissionsFor(bot)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks])
  )
    throw new Error("El bot no puede publicar en ese canal.");
  const poll = await db.createPoll(guild.id, channel.id, actorId, question, options);
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let n = 0; n < options.length; n += 5)
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        options.slice(n, n + 5).map((text, index) =>
          new ButtonBuilder()
            .setCustomId(`poll:${poll.id}:${n + index}`)
            .setLabel(text.slice(0, 80))
            .setStyle(ButtonStyle.Secondary),
        ),
      ),
    );
  try {
    const message = await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(question)
          .setDescription(options.map((o, n) => `${n + 1}. ${o}`).join("\n"))
          .setColor(0xd62828)
          .setFooter({ text: `NOXIS STUDIOS · encuesta ${poll.id}` }),
      ],
      components: rows,
      allowedMentions: disabledMentions,
    });
    await db.query("UPDATE polls SET message_id=$2 WHERE id=$1", [poll.id, message.id]);
  } catch (error) {
    await db.endPoll(guild.id, String(poll.id));
    throw error;
  }
  await db.recordAudit(guild.id, actorId, "poll.create", String(poll.id));
  return String(poll.id);
}
export async function publishGiveaway(
  guild: Guild,
  actorId: string,
  channelId: string,
  prize: string,
  minutes: number,
) {
  await assertActor(guild, actorId, P.ManageMessages);
  const channel = await guild.channels.fetch(channelId),
    bot = await guild.members.fetchMe();
  if (
    !channel?.isSendable() ||
    !channel.permissionsFor(bot)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks])
  )
    throw new Error("El bot no puede publicar en ese canal.");
  const endsAt = new Date(Date.now() + minutes * 60000),
    giveaway = await db.createGiveaway(guild.id, channelId, actorId, prize, endsAt);
  try {
    const message = await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("Sorteo NOXIS")
          .setDescription(prize)
          .addFields({ name: "Finaliza", value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>` })
          .setColor(0xd62828)
          .setFooter({ text: `NOXIS STUDIOS · sorteo ${giveaway.id}` }),
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`giveaway:${giveaway.id}`)
            .setLabel("Participar")
            .setStyle(ButtonStyle.Danger),
        ),
      ],
      allowedMentions: disabledMentions,
    });
    await db.query("UPDATE giveaways SET message_id=$2 WHERE id=$1", [giveaway.id, message.id]);
  } catch (error) {
    await db.query("UPDATE giveaways SET status='closed',announced=true WHERE id=$1", [
      giveaway.id,
    ]);
    throw error;
  }
  await db.recordAudit(guild.id, actorId, "giveaway.create", String(giveaway.id));
  return String(giveaway.id);
}
export async function handleCommunityButton(i: ButtonInteraction) {
  if (!i.guild) return;
  await i.deferReply({ ephemeral: true });
  const parts = i.customId.split(":"),
    id = parts[1];
  if (!id || !/^\d{1,18}$/.test(id)) {
    await i.editReply("Control inválido.");
    return;
  }
  if (parts[0] === "poll") {
    const poll = await db.pollResults(i.guild.id, id);
    if (!poll || poll.message_id !== i.message.id) {
      await i.editReply("Encuesta no encontrada.");
      return;
    }
    const ok = await db.vote(i.guild.id, id, i.user.id, Number(parts[2]));
    await i.editReply(
      ok
        ? "Voto guardado. Puedes cambiarlo mientras la encuesta esté abierta."
        : "La encuesta ya está cerrada.",
    );
  } else if (parts[0] === "giveaway") {
    const row = (
      await db.query("SELECT message_id FROM giveaways WHERE guild_id=$1 AND id=$2", [
        i.guild.id,
        id,
      ])
    ).rows[0];
    if (!row || row.message_id !== i.message.id) {
      await i.editReply("Sorteo no encontrado.");
      return;
    }
    const ok = await db.enterGiveaway(i.guild.id, id, i.user.id);
    await i.editReply(ok ? "Tu participación está guardada." : "El sorteo ha terminado.");
  }
}
export async function finishGiveaways(guild: Guild) {
  for (const pending of await db.dueGiveaways(guild.id)) {
    const result =
      pending.status === "open" ? await db.drawGiveaway(guild.id, String(pending.id)) : pending;
    if (!result) continue;
    const channel = await guild.channels.fetch(result.channel_id).catch(() => null);
    if (!channel?.isSendable() || !result.message_id) continue;
    try {
      const message = await channel.messages.fetch(result.message_id);
      await message.edit({
        embeds: [
          new EmbedBuilder()
            .setTitle("Sorteo finalizado")
            .setDescription(
              `${result.prize}\n\n${result.winner_ids.length ? `Ganador: <@${result.winner_ids[0]}>` : "Sin participantes."}`,
            )
            .setColor(0xd62828)
            .setFooter({ text: "NOXIS STUDIOS" }),
        ],
        components: [],
        allowedMentions: disabledMentions,
      });
      await db.query("UPDATE giveaways SET announced=true WHERE id=$1", [result.id]);
      await db.recordAudit(guild.id, null, "giveaway.draw", String(result.id), {
        winners: result.winner_ids,
      });
    } catch {
      /* Same message is edited on the next tick; winners are never drawn again. */
    }
  }
}
export async function reconcileTickets(guild: Guild) {
  const pending = (
    await db.query(
      "SELECT id,user_id FROM tickets WHERE guild_id=$1 AND status='creating' AND created_at<NOW()-INTERVAL '5 minutes'",
      [guild.id],
    )
  ).rows;
  if (!pending.length) return;
  const channels = await guild.channels.fetch();
  for (const ticket of pending) {
    const found = channels.find(
      (c) =>
        c?.type === ChannelType.GuildText &&
        c.topic === `NOXIS ticket ${ticket.id} · user ${ticket.user_id}`,
    );
    await db.setTicketChannel(String(ticket.id), found?.id);
    await db.recordAudit(
      guild.id,
      null,
      found ? "ticket.recovered" : "ticket.creation_failed",
      String(ticket.id),
    );
  }
}
export async function closePoll(guild: Guild, actorId: string, id: string) {
  await assertActor(guild, actorId, P.ManageMessages);
  await db.endPoll(guild.id, id);
  const poll = await db.pollResults(guild.id, id);
  if (!poll) throw new Error("Encuesta no encontrada.");
  const channel = await guild.channels.fetch(poll.channel_id);
  if (channel?.isSendable() && poll.message_id) {
    const message = await channel.messages.fetch(poll.message_id);
    await message.edit({
      embeds: [
        new EmbedBuilder()
          .setTitle(poll.question)
          .setDescription(
            poll.options
              .map((o, n) => `${o}: ${poll.counts.find((c) => c.option_index === n)?.votes ?? 0}`)
              .join("\n"),
          )
          .setColor(0xd62828)
          .setFooter({ text: "NOXIS STUDIOS · encuesta cerrada" }),
      ],
      components: [],
      allowedMentions: disabledMentions,
    });
  }
  await db.recordAudit(guild.id, actorId, "poll.close", id);
}
