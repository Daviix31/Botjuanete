import { SlashCommandBuilder, MessageFlags } from "discord.js";
import type { BotCommand } from "../types.js";
import { createRole, changeRole } from "../services/roles.js";
export const roleCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("rol")
    .setDescription("Crea y administra roles con jerarquía segura")
    .addSubcommand((s) =>
      s
        .setName("crear")
        .setDescription("Crea un rol sin permisos administrativos")
        .addStringOption((o) =>
          o.setName("nombre").setDescription("Nombre").setMaxLength(100).setRequired(true),
        )
        .addStringOption((o) => o.setName("color").setDescription("#RRGGBB").setMaxLength(7))
        .addBooleanOption((o) => o.setName("mostrar").setDescription("Separar miembros"))
        .addBooleanOption((o) => o.setName("mencionable").setDescription("Permitir menciones")),
    )
    .addSubcommand((s) =>
      s
        .setName("asignar")
        .setDescription("Asigna un rol")
        .addUserOption((o) => o.setName("usuario").setDescription("Miembro").setRequired(true))
        .addRoleOption((o) => o.setName("rol").setDescription("Rol").setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName("quitar")
        .setDescription("Quita un rol")
        .addUserOption((o) => o.setName("usuario").setDescription("Miembro").setRequired(true))
        .addRoleOption((o) => o.setName("rol").setDescription("Rol").setRequired(true)),
    ),
  async execute(i) {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    if (!i.guild) throw new Error("Solo disponible en un servidor.");
    if (i.options.getSubcommand() === "crear") {
      const role = await createRole(i.guild, i.user.id, {
        name: i.options.getString("nombre", true),
        color: i.options.getString("color") ?? "#D62828",
        hoist: i.options.getBoolean("mostrar") ?? false,
        mentionable: i.options.getBoolean("mencionable") ?? false,
      });
      await i.editReply(`Rol creado: <@&${role.id}>.`);
    } else {
      await changeRole(
        i.guild,
        i.user.id,
        i.options.getUser("usuario", true).id,
        i.options.getRole("rol", true).id,
        i.options.getSubcommand() === "asignar",
      );
      await i.editReply("Cambio de rol aplicado y registrado.");
    }
  },
};
