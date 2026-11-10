import {
  ChannelType,
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits as P,
} from "discord.js";
import { getGuildSettings, updateGuildSettings } from "@noxis/database";
import type { BotCommand } from "../types.js";
import { assertActor, assertAutoRole } from "../utils/permissions.js";
export const configCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("Configura NOXIS BOT")
    .addSubcommand((s) =>
      s
        .setName("bienvenida")
        .setDescription("Canal de entrada")
        .addChannelOption((o) =>
          o
            .setName("canal")
            .setDescription("Canal")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("salida")
        .setDescription("Canal de despedida")
        .addChannelOption((o) =>
          o
            .setName("canal")
            .setDescription("Canal")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("logs")
        .setDescription("Canal de auditoría")
        .addChannelOption((o) =>
          o
            .setName("canal")
            .setDescription("Canal")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("autorol")
        .setDescription("Rol automático seguro")
        .addRoleOption((o) => o.setName("rol").setDescription("Rol").setRequired(true)),
    )
    .addSubcommand((s) => s.setName("ver").setDescription("Configuración actual")),
  async execute(i) {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    if (!i.guild) throw new Error("Solo disponible en un servidor.");
    await assertActor(i.guild, i.user.id, P.ManageGuild);
    const sub = i.options.getSubcommand();
    if (sub === "ver") {
      await i.editReply(
        `\`\`\`json\n${JSON.stringify(await getGuildSettings(i.guild.id), null, 2).slice(0, 1800)}\n\`\`\``,
      );
      return;
    }
    const role = i.options.getRole("rol"),
      channel = i.options.getChannel("canal");
    if (role) await assertAutoRole(i.guild, role.id);
    if (channel) {
      const c = await i.guild.channels.fetch(channel.id),
        bot = await i.guild.members.fetchMe();
      if (!c || !c.permissionsFor(bot)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks]))
        throw new Error("El bot no puede enviar embeds en ese canal.");
    }
    const patch =
      sub === "bienvenida"
        ? { welcomeChannelId: channel!.id }
        : sub === "salida"
          ? { goodbyeChannelId: channel!.id }
          : sub === "logs"
            ? { logsChannelId: channel!.id }
            : { autoRoleId: role!.id };
    await updateGuildSettings(i.guild.id, patch, i.user.id);
    await i.editReply("Configuración guardada y registrada.");
  },
};
