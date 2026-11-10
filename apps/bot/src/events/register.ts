import {
  Events,
  EmbedBuilder,
  PermissionFlagsBits as P,
  AuditLogEvent,
  MessageFlags,
  type Message,
  type GuildMember,
  type PartialGuildMember,
} from "discord.js";
import { ZodError } from "zod";
import { getGuildSettings, awardXp } from "@noxis/database";
import { renderMemberMessage, disabledMentions } from "@noxis/shared";
import type { BotClient } from "../client.js";
import { config } from "../config.js";
import { logSecurity } from "../services/logging.js";
import { SecurityEngine, phishingHosts, SlidingWindow } from "../services/security.js";
import { assertAutoRole } from "../utils/permissions.js";
import { handleCommunityButton } from "../services/community.js";
const engine = new SecurityEngine(),
  commandWindow = new SlidingWindow();
const scope = (id: string | undefined | null) => id === config.DISCORD_GUILD_ID;
const failed = () =>
  console.error("NOXIS evento: revisa permisos, configuración y conexión con la base de datos.");
async function onMessage(message: Message) {
  if (!scope(message.guildId) || !message.guild || message.author.bot || !message.member) return;
  const settings = await getGuildSettings(message.guild.id);
  if (settings.levels?.enabled) await awardXp(message.guild.id, message.author.id);
  if (
    message.member.permissions.has(P.Administrator) ||
    message.member.permissions.has(P.ManageMessages)
  )
    return;
  const detected = engine.message(message.guild.id, message.author.id, settings);
  if (detected) {
    let applied = false;
    if (detected.timeout && message.member.moderatable) {
      try {
        await message.member.timeout(
          detected.seconds * 1000,
          "NOXIS · infracciones repetidas de antispam",
        );
        applied = true;
      } catch {
        applied = false;
      }
    }
    await logSecurity(message.guild, {
      type: "ANTI_SPAM",
      message: `Actividad repetitiva de <@${message.author.id}>. ${applied ? `Timeout aplicado: ${detected.seconds}s.` : "Modo observación; sin sanción aplicada."}`,
      severity: "warning",
      actorId: message.author.id,
      details: { ...detected, applied },
    });
  }
  if (settings.antiPhishing?.enabled) {
    const hosts = phishingHosts(message.content, settings.antiPhishing.blockedHosts ?? []);
    if (hosts.length)
      await logSecurity(message.guild, {
        type: "PHISHING_HOST",
        message: `Dominio bloqueado detectado en un mensaje de <@${message.author.id}>. Revisión manual recomendada.`,
        actorId: message.author.id,
        severity: "warning",
        details: { hosts, messageId: message.id, channelId: message.channelId },
      });
  }
}
async function memberMessage(member: GuildMember | PartialGuildMember, joining: boolean) {
  if (!scope(member.guild.id)) return;
  const settings = await getGuildSettings(member.guild.id);
  if (joining && settings.autoRoleId && "roles" in member) {
    try {
      const role = await assertAutoRole(member.guild, settings.autoRoleId);
      await member.roles.add(role, "NOXIS · autorol");
    } catch {
      await logSecurity(member.guild, {
        type: "AUTOROLE_FAILED",
        message: "No se pudo asignar el autorol. Revisa permisos y jerarquía.",
        actorId: member.id,
        severity: "warning",
      });
    }
  }
  const channelId = joining ? settings.welcomeChannelId : settings.goodbyeChannelId;
  if (channelId) {
    const channel = await member.guild.channels.fetch(channelId),
      bot = await member.guild.members.fetchMe();
    if (
      channel?.isSendable() &&
      channel.permissionsFor(bot)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks])
    ) {
      const text = joining
        ? (settings.welcomeMessage ?? "Hola {user}, bienvenido a **{server}**.")
        : (settings.goodbyeMessage ?? "**{username}** ha salido de **{server}**.");
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(joining ? "¡Bienvenido!" : "Un miembro ha salido")
            .setDescription(
              renderMemberMessage(text, member.id, member.user.username, member.guild.name),
            )
            .setColor(joining ? 0xd62828 : 0x444444)
            .setThumbnail(member.user.displayAvatarURL())
            .setFooter({ text: "NOXIS STUDIOS" })
            .setTimestamp(),
        ],
        allowedMentions: disabledMentions,
      });
    }
  }
  if (joining) {
    const raid = engine.join(member.guild.id, settings);
    if (raid)
      await logSecurity(member.guild, {
        type: "ANTI_RAID_ALERT",
        message: `${raid.count} entradas en ${raid.windowMs / 1000} segundos. Revisión manual recomendada.`,
        severity: "critical",
        details: raid,
      });
  }
}
export function registerEvents(client: BotClient) {
  client.on(Events.Error, failed);
  client.on(Events.Warn, () => console.warn("NOXIS Discord: advertencia de conexión."));
  client.on(Events.InteractionCreate, (interaction) => {
    void (async () => {
      if (!scope(interaction.guildId)) {
        if (interaction.isRepliable())
          await interaction.reply({
            content: "NOXIS BOT está limitado a su servidor privado.",
            flags: MessageFlags.Ephemeral,
          });
        return;
      }
      if (interaction.isButton()) {
        if (
          interaction.customId.startsWith("poll:") ||
          interaction.customId.startsWith("giveaway:")
        )
          await handleCommunityButton(interaction);
        return;
      }
      if (!interaction.isChatInputCommand()) return;
      if (commandWindow.hit(interaction.user.id, 10000) > 10) {
        await interaction.reply({
          content: "Espera unos segundos antes de repetir comandos.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction, client);
      } catch (error) {
        failed();
        const message =
          error instanceof ZodError
            ? "Datos inválidos. Revisa IDs, URLs, colores y límites."
            : error instanceof Error && error.constructor === Error
              ? error.message
              : "Discord no confirmó la acción. Revisa permisos y configuración.";
        if (interaction.deferred && !interaction.replied)
          await interaction
            .editReply({ content: message.slice(0, 1800), allowedMentions: disabledMentions })
            .catch(() => undefined);
        else if (interaction.replied)
          await interaction
            .followUp({
              content: message.slice(0, 1800),
              flags: MessageFlags.Ephemeral,
              allowedMentions: disabledMentions,
            })
            .catch(() => undefined);
        else
          await interaction
            .reply({
              content: message.slice(0, 1800),
              flags: MessageFlags.Ephemeral,
              allowedMentions: disabledMentions,
            })
            .catch(() => undefined);
      }
    })().catch(failed);
  });
  client.on(Events.MessageCreate, (message) => void onMessage(message).catch(failed));
  client.on(Events.GuildMemberAdd, (member) => void memberMessage(member, true).catch(failed));
  client.on(Events.GuildMemberRemove, (member) => void memberMessage(member, false).catch(failed));
  client.on(Events.GuildAuditLogEntryCreate, (entry, guild) => {
    if (!scope(guild.id) || !entry.executorId) return;
    const relevant: AuditLogEvent[] = [
      AuditLogEvent.ChannelDelete,
      AuditLogEvent.RoleDelete,
      AuditLogEvent.MemberBanAdd,
      AuditLogEvent.MemberKick,
      AuditLogEvent.WebhookDelete,
    ];
    if (!relevant.includes(entry.action)) return;
    void (async () => {
      const settings = await getGuildSettings(guild.id),
        result = engine.action(guild.id, entry.executorId!, settings);
      if (result)
        await logSecurity(guild, {
          type: "AUDIT_ACTION",
          message: `Acción ${entry.action} atribuida por Audit Log a <@${entry.executorId}>. ${result.count} acciones en la ventana.`,
          actorId: entry.executorId!,
          severity: result.critical ? "critical" : "warning",
          details: {
            ...result,
            auditEntryId: entry.id,
            targetId: entry.targetId,
            action: entry.action,
          },
        });
    })().catch(failed);
  });
  client.on(Events.ChannelDelete, (channel) => {
    if (!("guild" in channel) || !scope(channel.guild.id)) return;
    void logSecurity(channel.guild, {
      type: "CHANNEL_DELETE_DETECTED",
      message: `Se eliminó el canal ${channel.id}.`,
      severity: "warning",
      details: { channelId: channel.id },
    }).catch(failed);
  });
  client.on(Events.GuildRoleDelete, (role) => {
    if (scope(role.guild.id))
      void logSecurity(role.guild, {
        type: "ROLE_DELETE_DETECTED",
        message: `Se eliminó el rol ${role.id}.`,
        severity: "warning",
        details: { roleId: role.id },
      }).catch(failed);
  });
}
