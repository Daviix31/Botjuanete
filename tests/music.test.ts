import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { PassThrough } from "node:stream";
import { spawn } from "node:child_process";
import { ChannelType, PermissionsBitField, PermissionFlagsBits } from "discord.js";
import {
  generateDependencyReport,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
} from "@discordjs/voice";
import { MusicManager, resolveFfmpeg } from "../apps/bot/src/services/music.js";
import { openAudio } from "../apps/bot/src/services/audio-source.js";
import { fixtures as f } from "../scripts/test-env.js";
test("DAVE y Opus están instalados; FFmpeg genera audio que el player codifica", async () => {
  assert.match(generateDependencyReport(), /@snazzah\/davey: \d/);
  const child = spawn(resolveFfmpeg(), [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=0.15",
    "-f",
    "s16le",
    "-ar",
    "48000",
    "-ac",
    "2",
    "pipe:1",
  ]);
  const bytes: Buffer[] = [];
  child.stdout.on("data", (b) => bytes.push(b));
  child.stderr.resume();
  const [code] = await once(child, "close");
  assert.equal(code, 0);
  assert.ok(Buffer.concat(bytes).length > 0);
  const stream = new PassThrough(),
    resource = createAudioResource(stream, { inputType: StreamType.Raw, inlineVolume: true }),
    player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
  let error: unknown;
  player.on("error", (e) => (error = e));
  const idle = once(player, AudioPlayerStatus.Idle, { signal: AbortSignal.timeout(5000) });
  player.play(resource);
  stream.end(Buffer.concat(bytes));
  await idle;
  assert.equal(error, undefined);
});
test("las fuentes locales se rechazan antes de intentar HTTPS", async () => {
  await assert.rejects(
    () =>
      openAudio("https://localhost/song.mp3", new Set(["localhost"]), new AbortController().signal),
    /dirección pública/,
  );
});
function harness(source: any) {
  const connection: any = new EventEmitter();
  connection.joinConfig = { channelId: f.channelId };
  connection.subscribe = () => {};
  connection.destroy = () => {
    connection.destroyed = true;
  };
  const player: any = new EventEmitter();
  player.state = { status: AudioPlayerStatus.Idle };
  player.play = () => {
    player.state = { status: AudioPlayerStatus.Playing };
  };
  player.stop = () => {
    player.state = { status: AudioPlayerStatus.Idle };
    player.emit(AudioPlayerStatus.Idle);
    return true;
  };
  player.pause = () => true;
  player.unpause = () => true;
  const manager = new MusicManager(
    source,
    (() => connection) as any,
    (async () => connection) as any,
    (() => player) as any,
  );
  const guild: any = {
      id: f.guildId,
      voiceAdapterCreator: {},
      members: { fetchMe: async () => ({}) },
    },
    voice: any = {
      id: f.channelId,
      type: ChannelType.GuildVoice,
      permissionsFor: () => new PermissionsBitField(PermissionFlagsBits.Administrator),
    };
  return { manager, guild, voice, connection, player };
}
test("una fuente fallida se devuelve como error y no deja una sesión fantasma", async () => {
  const h = harness(async () => {
    throw new Error("Fuente no disponible");
  });
  await assert.rejects(
    () =>
      h.manager.enqueue(h.guild, h.voice, {
        url: "https://audio.example.com/song.mp3",
        title: "Test",
        requestedBy: f.ownerId,
      }),
    /Fuente no disponible/,
  );
  assert.equal(h.manager.get(f.guildId), undefined);
  assert.equal(h.connection.destroyed, true);
});
test("detener durante una carga cancela la descarga y no reinicia la sesión", async () => {
  let entered: () => void;
  const ready = new Promise<void>((r) => (entered = r));
  const h = harness(async (_u: unknown, _a: unknown, signal: AbortSignal) => {
    entered();
    return new Promise((_resolve, reject) =>
      signal.addEventListener("abort", () => reject(new Error("Cancelado")), { once: true }),
    );
  });
  const pending = h.manager.enqueue(h.guild, h.voice, {
    url: "https://audio.example.com/song.mp3",
    title: "Test",
    requestedBy: f.ownerId,
  });
  const rejection = assert.rejects(() => pending, /Cancelado/);
  await ready;
  assert.equal(h.manager.stop(f.guildId), true);
  await rejection;
  assert.equal(h.manager.get(f.guildId), undefined);
});
test("el fallo de una pista no borra la siguiente añadida durante la carga", async () => {
  let rejectFirst!: (e: Error) => void, entered!: () => void;
  let calls = 0;
  const ready = new Promise<void>((r) => (entered = r)),
    stream = new PassThrough();
  const h = harness(async () => {
    calls++;
    if (calls === 1) {
      entered();
      return new Promise((_resolve, reject) => {
        rejectFirst = reject;
      });
    }
    return stream;
  });
  const first = h.manager.enqueue(h.guild, h.voice, {
      url: "https://audio.example.com/a.mp3",
      title: "Fallará",
      requestedBy: f.ownerId,
    }),
    failed = assert.rejects(() => first, /test failure/);
  await ready;
  await h.manager.enqueue(h.guild, h.voice, {
    url: "https://audio.example.com/b.mp3",
    title: "Siguiente",
    requestedBy: f.ownerId,
  });
  rejectFirst(new Error("test failure"));
  await failed;
  for (let n = 0; n < 20 && !h.manager.get(f.guildId)?.current; n++)
    await new Promise((r) => setTimeout(r, 10));
  assert.equal(h.manager.get(f.guildId)?.current?.title, "Siguiente");
  h.manager.stopAll();
  stream.destroy();
});
