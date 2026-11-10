import { SlashCommandBuilder, MessageFlags, PermissionFlagsBits as P } from "discord.js";
import * as db from "@noxis/database";
import type { BotCommand } from "../types.js";
import { assertActor } from "../utils/permissions.js";
import {
  openTicket,
  closeUserTicket,
  publishPoll,
  publishGiveaway,
  closePoll,
} from "../services/community.js";
export const ticketCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Soporte privado")
    .addSubcommand((s) => s.setName("abrir").setDescription("Abre un ticket privado"))
    .addSubcommand((s) =>
      s.setName("cerrar").setDescription("Archiva este ticket sin borrar mensajes"),
    ),
  async execute(i) {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    if (!i.guild) throw new Error("Solo disponible en un servidor.");
    const id =
      i.options.getSubcommand() === "abrir"
        ? await openTicket(i.guild, i.user.id)
        : await closeUserTicket(i.guild, i.user.id, i.channelId);
    await i.editReply(`Ticket actualizado: <#${id}>.`);
  },
};
export const pollCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("encuesta")
    .setDescription("Encuestas persistentes")
    .addSubcommand((s) =>
      s
        .setName("crear")
        .setDescription("Crea una encuesta")
        .addStringOption((o) =>
          o.setName("pregunta").setDescription("Pregunta").setMaxLength(256).setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("opciones")
            .setDescription("2 a 10 opciones separadas por | (máximo 80 caracteres cada una)")
            .setMaxLength(810)
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("resultados")
        .setDescription("Muestra resultados")
        .addStringOption((o) => o.setName("id").setDescription("ID de encuesta").setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName("cerrar")
        .setDescription("Cierra la votación")
        .addStringOption((o) => o.setName("id").setDescription("ID de encuesta").setRequired(true)),
    ),
  async execute(i) {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    if (!i.guild) throw new Error("Solo disponible en un servidor.");
    const sub = i.options.getSubcommand();
    if (sub === "crear") {
      const options = i.options
        .getString("opciones", true)
        .split("|")
        .map((s) => s.trim());
      if (
        options.length < 2 ||
        options.length > 10 ||
        options.some((s) => !s || s.length > 80) ||
        new Set(options).size !== options.length
      )
        throw new Error("Introduce entre 2 y 10 opciones distintas de 1 a 80 caracteres.");
      const id = await publishPoll(
        i.guild,
        i.user.id,
        i.channelId,
        i.options.getString("pregunta", true),
        options,
      );
      await i.editReply(`Encuesta ${id} publicada.`);
      return;
    }
    const id = i.options.getString("id", true);
    if (!/^\d{1,18}$/.test(id)) throw new Error("ID de encuesta inválido.");
    if (sub === "cerrar") {
      await closePoll(i.guild, i.user.id, id);
    }
    const poll = await db.pollResults(i.guild.id, id);
    if (!poll) throw new Error("Encuesta no encontrada.");
    await i.editReply(
      `${poll.question} · ${poll.status}\n${poll.options.map((o: string, n: number) => `${o}: ${poll.counts.find((c: { option_index: number; votes: number }) => c.option_index === n)?.votes ?? 0}`).join("\n")}`,
    );
  },
};
export const giveawayCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("sorteo")
    .setDescription("Sorteos persistentes")
    .addSubcommand((s) =>
      s
        .setName("crear")
        .setDescription("Publica un sorteo con un ganador")
        .addStringOption((o) =>
          o.setName("premio").setDescription("Premio").setMaxLength(1000).setRequired(true),
        )
        .addIntegerOption((o) =>
          o
            .setName("minutos")
            .setDescription("Duración")
            .setMinValue(1)
            .setMaxValue(43200)
            .setRequired(true),
        ),
    ),
  async execute(i) {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    if (!i.guild) throw new Error("Solo disponible en un servidor.");
    const id = await publishGiveaway(
      i.guild,
      i.user.id,
      i.channelId,
      i.options.getString("premio", true),
      i.options.getInteger("minutos", true),
    );
    await i.editReply(`Sorteo ${id} publicado.`);
  },
};
export const levelsCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("nivel")
    .setDescription("Clasificación por participación"),
  async execute(i) {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    if (!i.guild) throw new Error("Solo disponible en un servidor.");
    const rows = await db.leaderboard(i.guild.id);
    await i.editReply(
      rows.length
        ? rows
            .slice(0, 10)
            .map((r, n) => `${n + 1}. <@${r.user_id}> · nivel ${r.level} · ${r.xp} XP`)
            .join("\n")
        : "Aún no hay niveles. Actívalos desde el panel.",
    );
  },
};
