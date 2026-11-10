import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../types.js";
export const pingCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Comprueba la latencia de NOXIS BOT"),
  async execute(interaction, client) {
    await interaction.reply({ content: `Pong · API ${client.ws.ping} ms`, ephemeral: true });
  },
};
