"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { API, createApi, type Me, type Overview, type Guild } from "../lib/api";
import { Settings } from "../components/settings";
import { Announcements } from "../components/announcements";
import { Administration } from "../components/administration";
import { Music } from "../components/music";
import { Activity, Community } from "../components/activity";
type Bot = {
  online: boolean;
  updated_at?: string;
  snapshot: {
    memberCount: number;
    music: {
      current: { title: string } | null;
      queue: unknown[];
      volume: number;
      status: string;
    } | null;
  } | null;
};
const tabs = [
  "Resumen",
  "Configuración",
  "Anuncios",
  "Administración",
  "Música",
  "Comunidad",
  "Actividad",
];
export default function Home() {
  const [me, setMe] = useState<Me | null>(null),
    [overview, setOverview] = useState<Overview | null>(null),
    [guild, setGuild] = useState<Guild | null>(null),
    [bot, setBot] = useState<Bot | null>(null),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState(""),
    [tab, setTab] = useState("Resumen");
  const notify = useCallback((s: string) => setMessage(s), []),
    expired = useCallback(() => {
      setMe(null);
      setGuild(null);
    }, []),
    api = useMemo(() => createApi(me?.csrf ?? "", expired), [me?.csrf, expired]);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch(`${API}/api/me`, {
          credentials: "include",
          cache: "no-store",
        });
        if (response.status === 401) return;
        if (!response.ok) throw new Error("La API no está disponible.");
        const data = (await response.json()) as Me;
        if (active) setMe(data);
      } catch {
        if (active) setMessage("No se pudo conectar con la API. Comprueba que esté activa.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  const refresh = useCallback(async () => {
    if (!me) return;
    const [o, g] = await Promise.all([
      api<Overview>("/api/dashboard/overview"),
      api<{ guild: Guild; bot: Bot }>("/api/guild"),
    ]);
    setOverview(o);
    setGuild(g.guild);
    setBot(g.bot);
  }, [me, api]);
  useEffect(() => {
    if (!me) return;
    void refresh().catch((e) => notify(e.message));
    const timer = setInterval(() => void refresh().catch(() => undefined), 15000);
    return () => clearInterval(timer);
  }, [me, refresh, notify]);
  async function logout() {
    try {
      await api("/auth/logout", "POST");
      setMe(null);
      setGuild(null);
      setOverview(null);
      setMessage("");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  const props = guild ? { guild, api, notify } : null;
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            N
          </span>
          <div>
            <strong>
              NOXIS <em>BOT</em>
            </strong>
            <small>CONTROL CENTER</small>
          </div>
        </div>
        <span className="status">
          <i /> SISTEMA PRIVADO
        </span>
      </header>
      <section className={`hero ${me ? "compact" : ""}`}>
        <div className="eyebrow">NOXIS STUDIOS / DISCORD</div>
        <h1>
          {me ? (
            <>
              Tu comunidad.
              <br />
              <span>Bajo tu control.</span>
            </>
          ) : (
            <>
              Controla tu servidor.
              <br />
              <span>Desde un solo lugar.</span>
            </>
          )}
        </h1>
        <p>Administración, automatización, música y seguridad.</p>
      </section>
      {message && (
        <div role="status" className="notice">
          <span>{message}</span>
          <button aria-label="Cerrar aviso" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      )}
      {loading ? (
        <section className="panel">Conectando con NOXIS BOT…</section>
      ) : !me ? (
        <section className="login panel">
          <div className="lock" aria-hidden="true">
            ⌑
          </div>
          <h2>Acceso restringido</h2>
          <p>Inicia sesión con una cuenta autorizada para administrar NOXIS BOT.</p>
          <a className="primary" href={`${API}/auth/discord`}>
            Continuar con Discord
          </a>
        </section>
      ) : (
        <>
          <section className="welcome panel">
            <div>
              <small>SESIÓN AUTORIZADA</small>
              <h2>{guild?.name ?? `Bienvenido, ${me.user.username}`}</h2>
              <p>
                {me.user.username} · {bot?.online ? "Bot conectado" : "Bot sin conexión confirmada"}
              </p>
            </div>
            <div className="controls">
              <button
                className="secondary"
                onClick={() => void refresh().catch((e) => notify(e.message))}
              >
                Actualizar datos
              </button>
              <button className="secondary" onClick={logout}>
                Cerrar sesión
              </button>
            </div>
          </section>
          <nav className="tabs" aria-label="Módulos del panel">
            {tabs.map((t) => (
              <button
                key={t}
                className={t === tab ? "active" : ""}
                aria-current={t === tab ? "page" : undefined}
                onClick={() => {
                  setTab(t);
                  setMessage("");
                }}
              >
                {t}
              </button>
            ))}
          </nav>
          {tab === "Resumen" ? (
            <>
              <section className="stats">
                {[
                  ["SERVIDORES", overview?.configuredServers],
                  ["ALERTAS · 7 DÍAS", overview?.securityEvents7d],
                  ["ANUNCIOS PENDIENTES", overview?.pendingAnnouncements],
                  ["TICKETS ABIERTOS", overview?.openTickets],
                ].map(([label, value]) => (
                  <article className="stat" key={label}>
                    <small>{label}</small>
                    <strong>{value ?? "—"}</strong>
                    <span>Datos de tu servidor</span>
                  </article>
                ))}
              </section>
              <section className="panel">
                <small>ESTADO DEL SERVIDOR</small>
                <h2>{bot?.online ? "NOXIS está conectado" : "Esperando conexión del bot"}</h2>
                <p>
                  {bot?.online
                    ? `${bot.snapshot?.memberCount ?? 0} miembros · ${overview?.rankedMembers ?? 0} miembros con XP · ${overview?.savedPlaylists ?? 0} playlists guardadas`
                    : "Puedes preparar la configuración. Las acciones en cola se ejecutarán cuando el bot se conecte."}
                </p>
                {bot?.snapshot?.music && (
                  <div className="plan">
                    <h3>Reproducción musical</h3>
                    <p>
                      {bot.snapshot.music.current?.title ?? "Sin pista activa"} ·{" "}
                      {bot.snapshot.music.status} · {bot.snapshot.music.queue.length} en cola ·{" "}
                      {bot.snapshot.music.volume}%
                    </p>
                  </div>
                )}
                <div className="modules">
                  {tabs.slice(1).map((t) => (
                    <button key={t} onClick={() => setTab(t)}>
                      ◈ {t}
                    </button>
                  ))}
                </div>
              </section>
            </>
          ) : props ? (
            tab === "Configuración" ? (
              <Settings {...props} />
            ) : tab === "Anuncios" ? (
              <Announcements {...props} />
            ) : tab === "Administración" ? (
              <Administration {...props} />
            ) : tab === "Música" ? (
              <Music {...props} />
            ) : tab === "Comunidad" ? (
              <Community api={api} notify={notify} />
            ) : (
              <Activity api={api} notify={notify} />
            )
          ) : (
            <section className="panel">
              <h2>Conecta el servidor</h2>
              <p>
                Comprueba que el bot esté invitado y tu cuenta tenga permisos de administración. Usa
                Actualizar datos para volver a intentarlo.
              </p>
            </section>
          )}
        </>
      )}
      <footer>
        NOXIS STUDIOS <span>·</span> PRIVATE CONTROL SYSTEM <span>·</span> v0.2
      </footer>
    </main>
  );
}
