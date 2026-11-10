"use client";
import { useEffect, useState, useCallback } from "react";
import type { Announcement } from "@noxis/shared";
import type { Guild, RequestApi } from "../lib/api";
import { ChannelSelect } from "./fields";
type Scheduled = {
  id: string;
  payload: Announcement;
  scheduled_for: string;
  status: string;
  last_error: string | null;
};
type Template = { id: string; name: string; payload: Announcement };
export function Announcements({
  guild,
  api,
  notify,
}: {
  guild: Guild;
  api: RequestApi;
  notify: (s: string) => void;
}) {
  const [embed, setEmbed] = useState<Announcement>({
      title: "",
      description: "",
      color: "#D62828",
    }),
    [channel, setChannel] = useState(""),
    [when, setWhen] = useState(""),
    [busy, setBusy] = useState(false),
    [name, setName] = useState(""),
    [items, setItems] = useState<Scheduled[]>([]),
    [templates, setTemplates] = useState<Template[]>([]);
  const load = useCallback(async () => {
    const data = await api<{ announcements: Scheduled[]; templates: Template[] }>(
      "/api/announcements",
    );
    setItems(data.announcements);
    setTemplates(data.templates);
  }, [api]);
  useEffect(() => {
    void load().catch((e) => notify(e.message));
  }, [load, notify]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (when) {
        await api("/api/announcements", "POST", {
          channelId: channel,
          embed,
          scheduledFor: new Date(when).toISOString(),
        });
        notify("Anuncio programado. Se enviará cuando el bot esté conectado.");
      } else {
        await api("/api/jobs", "POST", {
          kind: "announcement.send",
          payload: { channelId: channel, embed },
          requestId: crypto.randomUUID(),
        });
        notify("Anuncio en cola. Consulta el resultado en Actividad.");
      }
      await load();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveTemplate() {
    if (!name.trim()) {
      notify("Escribe un nombre para la plantilla.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/announcement-templates", "PUT", { name, embed });
      await load();
      notify("Plantilla de anuncio guardada.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="grid2">
        <form className="panel" onSubmit={submit}>
          <h2>Constructor de anuncios</h2>
          <fieldset disabled={busy}>
            <label>
              Cargar plantilla
              <select
                defaultValue=""
                onChange={(e) => {
                  const t = templates.find((t) => t.id === e.target.value);
                  if (t) setEmbed(t.payload);
                }}
              >
                <option value="">Selecciona una plantilla</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <ChannelSelect
              guild={guild}
              label="Canal del anuncio"
              value={channel}
              onChange={setChannel}
              empty={false}
            />
            <label>
              Título
              <input
                value={embed.title}
                maxLength={256}
                required
                onChange={(e) => setEmbed({ ...embed, title: e.target.value })}
              />
            </label>
            <label>
              Contenido
              <textarea
                value={embed.description}
                maxLength={4000}
                required
                onChange={(e) => setEmbed({ ...embed, description: e.target.value })}
              />
            </label>
            <div className="grid2">
              <label>
                Color
                <input
                  type="color"
                  value={embed.color}
                  onChange={(e) => setEmbed({ ...embed, color: e.target.value })}
                />
              </label>
              <label>
                Imagen HTTPS
                <input
                  type="url"
                  value={embed.image ?? ""}
                  placeholder="https://…"
                  onChange={(e) => setEmbed({ ...embed, image: e.target.value || null })}
                />
              </label>
            </div>
            <label>
              Programar (opcional)
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
              <small>Se usa la zona horaria de tu dispositivo.</small>
            </label>
            <button className="primary" type="submit">
              {busy ? "Procesando…" : when ? "Programar anuncio" : "Enviar anuncio"}
            </button>
            <div className="divider" />
            <label>
              Nombre de la plantilla
              <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
            </label>
            <button className="secondary" type="button" onClick={saveTemplate}>
              Guardar como plantilla
            </button>
          </fieldset>
        </form>
        <section className="panel">
          <small>VISTA PREVIA</small>
          <article className="embed-preview" style={{ borderLeftColor: embed.color }}>
            <strong>{embed.title || "Título del anuncio"}</strong>
            <p>{embed.description || "El contenido de tu anuncio aparecerá aquí."}</p>
            {embed.image && (
              <img src={embed.image} alt="Imagen del anuncio" referrerPolicy="no-referrer" />
            )}
            <small>NOXIS STUDIOS</small>
          </article>
          <p>
            Discord renderizará el formato de texto al publicar. Las menciones automáticas están
            desactivadas.
          </p>
        </section>
      </div>
      <section className="panel spaced">
        <div className="row">
          <h2>Anuncios programados</h2>
          <button className="secondary" onClick={() => void load().catch((e) => notify(e.message))}>
            Actualizar
          </button>
        </div>
        {!items.length ? (
          <p>No hay anuncios programados.</p>
        ) : (
          items.map((item) => (
            <article className="list-row" key={item.id}>
              <div>
                <strong>{item.payload.title}</strong>
                <small>
                  {new Date(item.scheduled_for).toLocaleString()} · {item.status}
                </small>
                {item.last_error && <p>{item.last_error}</p>}
              </div>
              {item.status === "pending" && (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api(`/api/announcements/${item.id}`, "DELETE");
                      await load();
                      notify("Anuncio cancelado.");
                    } catch (e) {
                      notify((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Cancelar
                </button>
              )}
            </article>
          ))
        )}
      </section>
    </>
  );
}
