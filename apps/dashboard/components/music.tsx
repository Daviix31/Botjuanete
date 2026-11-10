"use client";
import { useEffect, useState, useCallback } from "react";
import type { Guild, RequestApi } from "../lib/api";
import { ChannelSelect } from "./fields";
type Playlist = { id: string; name: string; tracks: { url: string; title: string }[] };
export function Music({
  guild,
  api,
  notify,
}: {
  guild: Guild;
  api: RequestApi;
  notify: (s: string) => void;
}) {
  const [url, setUrl] = useState(""),
    [title, setTitle] = useState(""),
    [voice, setVoice] = useState(""),
    [volume, setVolume] = useState(65),
    [busy, setBusy] = useState(false),
    [name, setName] = useState(""),
    [lists, setLists] = useState<Playlist[]>([]);
  const load = useCallback(
    async () => setLists((await api<{ playlists: Playlist[] }>("/api/playlists")).playlists),
    [api],
  );
  useEffect(() => {
    void load().catch((e) => notify(e.message));
  }, [load, notify]);
  async function enqueue(kind: string, payload: unknown) {
    setBusy(true);
    try {
      await api("/api/jobs", "POST", { kind, payload, requestId: crypto.randomUUID() });
      notify("Control musical en cola. Revisa Actividad para confirmar.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid2">
      <section className="panel">
        <h2>Reproductor NOXIS</h2>
        <p>Añade audio directo HTTPS de los dominios que hayas autorizado para tu bot.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void enqueue("music.play", { url, title, voiceChannelId: voice });
          }}
        >
          <fieldset disabled={busy}>
            <ChannelSelect
              guild={guild}
              label="Canal de voz"
              types={[2]}
              value={voice}
              onChange={setVoice}
              empty={false}
            />
            <label>
              Título de la pista
              <input
                required
                maxLength={150}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              URL de audio HTTPS
              <input
                required
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
              />
            </label>
            <button className="primary">Añadir pista</button>
          </fieldset>
        </form>
        <div className="controls">
          {["pausa", "reanudar", "saltar", "detener"].map((action) => (
            <button
              className="secondary"
              disabled={busy}
              key={action}
              onClick={() => enqueue("music.control", { action })}
            >
              {
                { pausa: "Pausar", reanudar: "Reanudar", saltar: "Saltar", detener: "Detener" }[
                  action
                ]
              }
            </button>
          ))}
        </div>
        <label>
          Volumen · {volume}%
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
          />
        </label>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => enqueue("music.control", { action: "volumen", volume })}
        >
          Aplicar volumen
        </button>
      </section>
      <section className="panel">
        <h2>Playlists personales</h2>
        <p>Guarda la pista del formulario y añádele más pistas cuando quieras.</p>
        <label>
          Nombre de playlist
          <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        </label>
        <button
          className="secondary"
          disabled={busy || !name || !url || !title}
          onClick={async () => {
            setBusy(true);
            try {
              const existing = lists.find((p) => p.name === name);
              await api("/api/playlists", "PUT", {
                name,
                tracks: [...(existing?.tracks ?? []), { url, title }],
              });
              await load();
              notify("Pista guardada en la playlist.");
            } catch (e) {
              notify((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Guardar pista en playlist
        </button>
        {lists.map((list) => (
          <article className="list-row" key={list.id}>
            <div>
              <strong>{list.name}</strong>
              <small>{list.tracks.length} pistas</small>
            </div>
            <button
              className="secondary"
              disabled={busy || !voice}
              onClick={async () => {
                setBusy(true);
                try {
                  for (const track of list.tracks)
                    await api("/api/jobs", "POST", {
                      kind: "music.play",
                      payload: { ...track, voiceChannelId: voice },
                      requestId: crypto.randomUUID(),
                    });
                  notify("Playlist en cola.");
                } catch (e) {
                  notify((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Cargar
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}
