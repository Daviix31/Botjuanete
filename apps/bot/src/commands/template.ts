import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { templatePlan, templateType } from "@noxis/shared";
import type { BotCommand } from "../types.js";
import { applyTemplate } from "../services/templates.js";
export const templateCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("plantilla")
    .setDescription("Construye tu servidor con vista previa")
    .addSubcommand((s) =>
      s
        .setName("aplicar")
        .setDescription("Ver estructura o confirmar su creación")
        .addStringOption((o) =>
          o
            .setName("tipo")
            .setDescription("Plantilla")
            .setRequired(true)
            .addChoices(
              { name: "Comunidad", value: "comunidad" },
              { name: "Gaming", value: "gaming" },
            ),
        )
        .addBooleanOption((o) =>
          o
            .setName("confirmar")
            .setDescription("Confirma la creación después de revisar la vista previa"),
        ),
    ),
  async execute(i) {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    if (!i.guild) throw new Error("Solo disponible en un servidor.");
    const type = templateType.parse(i.options.getString("tipo", true));
    if (!i.options.getBoolean("confirmar")) {
      const plan = templatePlan(type);
      await i.editReply(
        `Vista previa **${type}**\nRoles: ${plan.roles.join(", ")}\nCategorías: ${plan.categories.join(", ")}\nCanales: ${plan.channels.join(", ")}\nRepite con confirmar:Sí para crear los recursos que faltan.`,
      );
      return;
    }
    const result = await applyTemplate(i.guild, i.user.id, type);
    await i.editReply(
      `Plantilla aplicada: ${result.created.length} recursos creados. Cambios registrados en auditoría.`,
    );
  },
};
