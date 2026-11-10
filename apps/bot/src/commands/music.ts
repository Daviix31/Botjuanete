import { PermissionFlagsBits as P, SlashCommandBuilder, MessageFlags } from "discord.js";
import { savePlaylist, listPlaylists, recordAudit } from "@noxis/database";
import { musicManager } from "../services/music.js";
import type { BotCommand } from "../types.js";
export const musicCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("musica")
    .setDescription("Música con fuentes de audio autorizadas")
    .addSubcommand((s) =>
      s
        .setName("play")
        .setDescription("Reproduce audio directo HTTPS")
        .addStringOption((o) =>
          o.setName("url").setDescription("Audio HTTPS").setMaxLength(1000).setRequired(true),
        )
        .addStringOption((o) => o.setName("titulo").setDescription("Título").setMaxLength(150)),
    )
    .addSubcommand((s) => s.setName("pausa").setDescription("Pausa"))
    .addSubcommand((s) => s.setName("reanudar").setDescription("Reanuda"))
    .addSubcommand((s) => s.setName("saltar").setDescription("Salta la pista"))
    .addSubcommand((s) => s.setName("detener").setDescription("Detiene la sesión"))
    .addSubcommand((s) => s.setName("cola").setDescription("Muestra la cola"))
    .addSubcommand((s) =>
      s
        .setName("volumen")
        .setDescription("Volumen")
        .addIntegerOption((o) =>
          o
            .setName("valor")
            .setDescription("0 a 100")
            .setMinValue(0)
            .setMaxValue(100)
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("guardar")
        .setDescription("Guarda la cola como playlist personal")
        .addStringOption((o) =>
          o.setName("nombre").setDescription("Nombre").setMaxLength(100).setRequired(true),
        ),
    )
    .addSubcommand((s) => s.setName("listas").setDescription("Tus playlists guardadas"))
    .addSubcommand((s) =>
      s
        .setName("cargar")
        .setDescription("Añade una playlist autorizada")
        .addStringOption((o) =>
          o.setName("nombre").setDescription("Nombre exacto").setMaxLength(100).setRequired(true),
        ),
    ),
  async execute(i) {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    if (!i.guild) throw new Error("Solo disponible en un servidor.");
    const guild = i.guild,
      sub = i.options.getSubcommand(),
      member = await guild.members.fetch(i.user.id);
    if (sub === "listas") {
      const lists = await listPlaylists(guild.id, i.user.id);
      await i.editReply(
        lists.length
          ? lists
              .map((p) => `${p.name} · ${p.tracks.length} pistas`)
              .join("\n")
              .slice(0, 1900)
          : "Aún no tienes playlists.",
      );
      return;
    }
    if (sub === "play" || sub === "cargar") {
      const voice = member.voice.channel;
      if (!voice) throw new Error("Entra primero a un canal de voz.");
      if (sub === "play") {
        const position = await musicManager.enqueue(guild, voice, {
          url: i.options.getString("url", true),
          title: i.options.getString("titulo") ?? "Audio autorizado",
          requestedBy: i.user.id,
        });
        await i.editReply(`Pista añadida en la posición ${position}.`);
      } else {
        const lists = await listPlaylists(guild.id, i.user.id),
          list = lists.find((p) => p.name === i.options.getString("nombre", true));
        if (!list) throw new Error("Playlist no encontrada.");
        let count = 0;
        for (const track of list.tracks) {
          await musicManager.enqueue(guild, voice, { ...track, requestedBy: i.user.id });
          count++;
        }
        await i.editReply(`${count} pistas añadidas.`);
      }
      return;
    }
    const s = musicManager.get(guild.id);
    if (!s) throw new Error("No hay una sesión musical activa.");
    if (sub === "cola") {
      await i.editReply(
        [
          s.current ? `▶ ${s.current.title}` : "Sin pista activa",
          ...s.queue.slice(0, 10).map((t, n) => `${n + 1}. ${t.title}`),
        ]
          .join("\n")
          .slice(0, 1900),
      );
      return;
    }
    if (
      member.voice.channelId !== s.connection.joinConfig.channelId &&
      !member.permissions.has(P.ManageGuild)
    )
      throw new Error("Debes estar en el mismo canal de voz.");
    if (sub === "guardar") {
      const tracks = [...(s.current ? [s.current] : []), ...s.queue].map(({ url, title }) => ({
        url,
        title,
      }));
      await savePlaylist(guild.id, i.user.id, i.options.getString("nombre", true), tracks);
      await i.editReply("Playlist guardada.");
      return;
    }
    const ok =
      sub === "pausa"
        ? musicManager.pause(guild.id)
        : sub === "reanudar"
          ? musicManager.resume(guild.id)
          : sub === "saltar"
            ? musicManager.skip(guild.id)
            : sub === "detener"
              ? musicManager.stop(guild.id)
              : musicManager.setVolume(guild.id, i.options.getInteger("valor", true) / 100);
    await recordAudit(guild.id, i.user.id, `music.${sub}`);
    await i.editReply(
      ok ? "Control aplicado." : "No se pudo aplicar el control en el estado actual.",
    );
  },
};
