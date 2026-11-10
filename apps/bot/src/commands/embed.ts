import { ChannelType, SlashCommandBuilder, MessageFlags } from "discord.js";
import type { BotCommand } from "../types.js";
import { sendAnnouncement } from "../services/announcements.js";
export const embedCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Publica un anuncio con identidad NOXIS")
    .addChannelOption((o) =>
      o
        .setName("canal")
        .setDescription("Destino")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true),
    )
    .addStringOption((o) =>
      o.setName("titulo").setDescription("Título").setMaxLength(256).setRequired(true),
    )
    .addStringOption((o) =>
      o.setName("mensaje").setDescription("Contenido").setMaxLength(4000).setRequired(true),
    )
    .addStringOption((o) => o.setName("color").setDescription("#RRGGBB").setMaxLength(7))
    .addStringOption((o) => o.setName("imagen").setDescription("Imagen HTTPS").setMaxLength(1000)),
  async execute(i) {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    if (!i.guild) throw new Error("Solo disponible en un servidor.");
    await sendAnnouncement(
      i.guild,
      i.user.id,
      i.options.getChannel("canal", true).id,
      {
        title: i.options.getString("titulo", true),
        description: i.options.getString("mensaje", true),
        color: i.options.getString("color") ?? "#D62828",
        image: i.options.getString("imagen"),
      },
      i.id,
    );
    await i.editReply("Anuncio enviado y registrado.");
  },
};
