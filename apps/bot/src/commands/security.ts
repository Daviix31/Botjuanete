import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getGuildSettings } from "@noxis/database";
import type { BotCommand } from "../types.js";
import { isManager } from "../utils/permissions.js";
export const securityCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("seguridad")
    .setDescription("Consulta la protección de NOXIS BOT")
    .addSubcommand((s) => s.setName("estado").setDescription("Muestra los módulos activos")),
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: "Solo disponible en un servidor.", ephemeral: true });
      return;
    }
    if (!isManager(interaction)) {
      await interaction.reply({
        content: "No tienes permiso para consultar la configuración de seguridad.",
        ephemeral: true,
      });
      return;
    }
    const settings = await getGuildSettings(interaction.guild.id);
    const antiSpam = settings.antiSpam?.enabled !== false;
    const antiRaid = settings.antiRaid?.enabled !== false;
    const embed = new EmbedBuilder()
      .setColor(0xd62828)
      .setTitle("NOXIS SECURITY · Estado")
      .addFields(
        {
          name: "Anti-spam",
          value: antiSpam
            ? `Activo · ${settings.antiSpam?.mode === "timeout" ? "timeout tras infracciones repetidas" : "observación"}`
            : "Desactivado",
          inline: true,
        },
        {
          name: "Anti-raid",
          value: antiRaid ? "Activo · detección y alerta" : "Desactivado",
          inline: true,
        },
        { name: "Anti-nuke", value: "Observación y registro de eliminaciones", inline: false },
        {
          name: "Logs",
          value: settings.logsChannelId ? `<#${settings.logsChannelId}>` : "No configurado",
          inline: false,
        },
      )
      .setFooter({ text: "NOXIS STUDIOS · La protección no es infalible" });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
