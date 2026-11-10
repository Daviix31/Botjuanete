"use client";
import { useCallback, useEffect, useState } from "react";
import type { RequestApi, Job } from "../lib/api";
export function Activity({ api, notify }: { api: RequestApi; notify: (s: string) => void }) {
  const [jobs, setJobs] = useState<Job[]>([]),
    [events, setEvents] = useState<Record<string, unknown>[]>([]),
    [kind, setKind] = useState("audit");
  const load = useCallback(async () => {
    const [j, e] = await Promise.all([
      api<{ jobs: Job[] }>("/api/jobs"),
      api<{ events: Record<string, unknown>[] }>(`/api/events?kind=${kind}`),
    ]);
    setJobs(j.jobs);
    setEvents(e.events);
  }, [api, kind]);
  useEffect(() => {
    void load().catch((e) => notify(e.message));
    const timer = setInterval(() => void load().catch(() => undefined), 5000);
    return () => clearInterval(timer);
  }, [load, notify]);
  return (
    <div className="grid2">
      <section className="panel">
        <h2>Acciones del panel</h2>
        <p>Una acción pendiente espera al bot. Comprueba el resultado antes de repetirla.</p>
        {!jobs.length && <p>Aún no hay acciones.</p>}
        {jobs.map((j) => (
          <article key={j.id} className="job">
            <div className="row">
              <strong>
                #{j.id} · {j.kind}
              </strong>
              <span className={`badge ${j.status}`}>
                {(
                  {
                    pending: "Pendiente",
                    running: "En curso",
                    succeeded: "Completada",
                    failed: "Fallida",
                    needs_review: "Revisar",
                  } as Record<string, string>
                )[j.status] ?? j.status}
              </span>
            </div>
            <small>{new Date(j.created_at).toLocaleString()}</small>
            {j.error && <p className="error">{j.error}</p>}
          </article>
        ))}
      </section>
      <section className="panel">
        <div className="row">
          <h2>Registros</h2>
          <select
            aria-label="Tipo de registros"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="audit">Auditoría</option>
            <option value="security">Seguridad</option>
          </select>
        </div>
        {!events.length && <p>Sin eventos registrados.</p>}
        {events.map((e) => (
          <article className="job" key={String(e.id)}>
            <strong>{String(e.action ?? e.event_type)}</strong>
            <small>
              {new Date(String(e.created_at)).toLocaleString()} · {String(e.actor_id ?? "Sistema")}
            </small>
            <pre>{JSON.stringify(e.details, null, 2)}</pre>
          </article>
        ))}
      </section>
    </div>
  );
}
export function Community({ api, notify }: { api: RequestApi; notify: (s: string) => void }) {
  const [data, setData] = useState<Record<string, Record<string, unknown>[]> | null>(null);
  useEffect(() => {
    let active = true;
    api<Record<string, Record<string, unknown>[]>>("/api/community")
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => notify(e.message));
    return () => {
      active = false;
    };
  }, [api, notify]);
  if (!data) return <section className="panel">Cargando comunidad…</section>;
  return (
    <>
      <section className="panel">
        <h2>Tu comunidad</h2>
        <p>
          Los miembros usan <code>/ticket abrir</code> y <code>/nivel</code>. El equipo puede
          publicar <code>/encuesta crear</code> y <code>/sorteo crear</code> desde Discord. Los
          votos, participantes y resultados se guardan de forma persistente.
        </p>
      </section>
      <div className="grid2 spaced">
        {Object.entries(data).map(([key, rows]) => (
          <section className="panel" key={key}>
            <h2>
              {(
                {
                  tickets: "Tickets",
                  polls: "Encuestas",
                  giveaways: "Sorteos",
                  levels: "Clasificación",
                } as Record<string, string>
              )[key] ?? key}
            </h2>
            {!rows.length ? (
              <p>Aún no hay registros.</p>
            ) : (
              rows.map((r, n) => (
                <article className="job" key={String(r.id ?? r.user_id ?? n)}>
                  <strong>{String(r.question ?? r.prize ?? r.user_id ?? `Ticket ${r.id}`)}</strong>
                  <small>
                    {r.status ? `Estado: ${r.status}` : `Nivel ${r.level} · ${r.xp} XP`}
                    {r.votes !== undefined ? ` · ${r.votes} votos` : ""}
                    {r.entries !== undefined ? ` · ${r.entries} participantes` : ""}
                  </small>
                </article>
              ))
            )}
          </section>
        ))}
      </div>
    </>
  );
}
