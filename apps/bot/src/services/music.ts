import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createRequire } from "node:module";
import {
  AudioPlayerStatus,
  VoiceConnectionStatus,
  NoSubscriberBehavior,
  StreamType,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  entersState,
  type VoiceConnection,
  type AudioPlayer,
} from "@discordjs/voice";
import {
  ChannelType,
  PermissionFlagsBits as P,
  type Guild,
  type VoiceBasedChannel,
} from "discord.js";
import { config } from "../config.js";
import { openAudio, validateAudioUrl } from "./audio-source.js";
const require = createRequire(import.meta.url);
export function resolveFfmpeg() {
  if (config.FFMPEG_PATH) return config.FFMPEG_PATH;
  try {
    return (require("ffmpeg-static") as string) || "ffmpeg";
  } catch {
    return "ffmpeg";
  }
}
export type Track = { url: string; title: string; requestedBy: string };
type Session = {
  guildId: string;
  connection: VoiceConnection;
  player: AudioPlayer;
  queue: Track[];
  current?: Track;
  process?: ChildProcessWithoutNullStreams;
  volume: number;
  starting: boolean;
  closed: boolean;
  abort?: AbortController;
  idle?: NodeJS.Timeout;
  duration?: NodeJS.Timeout;
  lastError?: string;
};
export class MusicManager {
  private sessions = new Map<string, Session>();
  constructor(
    private readonly source = openAudio,
    private readonly join = joinVoiceChannel,
    private readonly waitReady = (connection: VoiceConnection) =>
      entersState(connection, VoiceConnectionStatus.Ready, 20000),
    private readonly makePlayer = createAudioPlayer,
  ) {}
  async enqueue(guild: Guild, voice: VoiceBasedChannel, track: Track) {
    validateAudioUrl(track.url, config.musicAllowedHosts);
    if (voice.type !== ChannelType.GuildVoice) throw new Error("Usa un canal de voz normal.");
    const bot = await guild.members.fetchMe();
    if (!voice.permissionsFor(bot)?.has([P.ViewChannel, P.Connect, P.Speak]))
      throw new Error("El bot necesita Ver canal, Conectar y Hablar.");
    let session = this.sessions.get(guild.id);
    if (session && session.connection.joinConfig.channelId !== voice.id)
      throw new Error("Hay una sesión activa en otro canal de voz.");
    if (session && session.queue.length >= 50)
      throw new Error("La cola tiene un máximo de 50 pistas.");
    if (!session) {
      const connection = this.join({
        channelId: voice.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true,
      });
      const player = this.makePlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
      session = {
        guildId: guild.id,
        connection,
        player,
        queue: [],
        volume: 0.65,
        starting: false,
        closed: false,
      };
      this.sessions.set(guild.id, session);
      const active = session;
      connection.subscribe(player);
      player.on(AudioPlayerStatus.Idle, () => {
        if (active.closed) return;
        this.cleanup(active);
        active.current = undefined;
        if (!active.starting) void this.advance(active).catch(() => undefined);
      });
      player.on("error", () => {
        active.lastError = "Error de reproducción; comprueba el formato de la fuente.";
        this.cleanup(active);
        active.current = undefined;
        if (!active.starting) void this.advance(active).catch(() => undefined);
      });
      connection.on("error", () => this.stop(guild.id));
      connection.on(VoiceConnectionStatus.Disconnected, () => {
        void Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5000),
        ]).catch(() => this.stop(guild.id));
      });
    }
    clearTimeout(session.idle);
    session.queue.push(track);
    const position = session.queue.length + (session.current ? 1 : 0);
    if (!session.current && !session.starting) {
      try {
        await this.advance(session, true);
      } catch (error) {
        if (!session.queue.length && !session.starting && !session.current) this.stop(guild.id);
        throw error;
      }
    }
    return position;
  }
  private cleanup(s: Session) {
    clearTimeout(s.duration);
    s.abort?.abort();
    s.abort = undefined;
    s.process?.stdin.destroy();
    s.process?.stdout.destroy();
    s.process?.kill("SIGKILL");
    s.process = undefined;
  }
  private async advance(s: Session, propagate = false): Promise<void> {
    if (s.closed || s.starting || s.current) return;
    const track = s.queue.shift();
    if (!track) {
      s.idle = setTimeout(() => this.stop(s.guildId), 60000);
      s.idle.unref();
      return;
    }
    s.starting = true;
    s.abort = new AbortController();
    let failure: unknown;
    try {
      await this.waitReady(s.connection);
      if (s.closed) return;
      s.abort.signal.throwIfAborted();
      const stream = await this.source(track.url, config.musicAllowedHosts, s.abort.signal);
      if (s.closed) {
        stream.destroy();
        return;
      }
      const child = spawn(
        resolveFfmpeg(),
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-protocol_whitelist",
          "pipe",
          "-i",
          "pipe:0",
          "-f",
          "s16le",
          "-ar",
          "48000",
          "-ac",
          "2",
          "pipe:1",
        ],
        { stdio: ["pipe", "pipe", "pipe"] },
      );
      s.process = child;
      let bytes = 0;
      stream.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > 150 * 1024 * 1024) s.abort?.abort();
      });
      stream.on("error", () => {
        if (s.process === child && !s.closed) s.player.stop(true);
      });
      child.stdin.on("error", () => stream.destroy());
      child.stdout.on("error", () => undefined);
      child.stderr.resume();
      child.on("error", () => {
        if (s.process === child && !s.closed) {
          s.lastError = "FFmpeg no pudo iniciar.";
          s.player.stop(true);
        }
      });
      child.on("close", (code) => {
        stream.destroy();
        if (code && s.process === child && !s.closed) {
          s.lastError = "La fuente no pudo decodificarse.";
          s.player.stop(true);
        }
      });
      stream.pipe(child.stdin);
      const resource = createAudioResource(child.stdout, {
        inputType: StreamType.Raw,
        inlineVolume: true,
      });
      resource.volume?.setVolume(s.volume);
      s.current = track;
      s.player.play(resource);
      s.duration = setTimeout(() => this.skip(s.guildId), 30 * 60 * 1000);
      s.duration.unref();
    } catch (error) {
      failure = error;
      s.lastError = "No se pudo abrir la fuente de audio.";
      this.cleanup(s);
      s.current = undefined;
    } finally {
      s.starting = false;
    }
    if (!s.closed && !s.current) queueMicrotask(() => void this.advance(s).catch(() => undefined));
    if (failure && propagate) throw failure;
  }
  get(id: string) {
    return this.sessions.get(id);
  }
  snapshot(id: string) {
    const s = this.get(id);
    return s
      ? {
          channelId: s.connection.joinConfig.channelId,
          current: s.current
            ? { title: s.current.title, requestedBy: s.current.requestedBy }
            : null,
          queue: s.queue.map((t) => ({ title: t.title, requestedBy: t.requestedBy })),
          volume: Math.round(s.volume * 100),
          status: s.player.state.status,
          lastError: s.lastError,
        }
      : null;
  }
  skip(id: string) {
    const s = this.get(id);
    if (!s || (!s.current && !s.starting)) return false;
    if (s.starting) {
      s.abort?.abort();
      return true;
    }
    return s.player.stop(true);
  }
  pause(id: string) {
    return this.get(id)?.player.pause() ?? false;
  }
  resume(id: string) {
    return this.get(id)?.player.unpause() ?? false;
  }
  setVolume(id: string, value: number) {
    const s = this.get(id);
    if (!s || !Number.isFinite(value)) return false;
    s.volume = Math.max(0, Math.min(1, value));
    if ("resource" in s.player.state) s.player.state.resource.volume?.setVolume(s.volume);
    return true;
  }
  stop(id: string) {
    const s = this.get(id);
    if (!s) return false;
    s.closed = true;
    s.queue = [];
    s.current = undefined;
    clearTimeout(s.idle);
    this.cleanup(s);
    s.player.stop(true);
    s.connection.destroy();
    this.sessions.delete(id);
    return true;
  }
  stopAll() {
    for (const id of this.sessions.keys()) this.stop(id);
  }
}
export const musicManager = new MusicManager();
