"use client";
import { useEffect, useState } from "react";
import type { GuildSettings } from "@noxis/shared";
import type { Guild, RequestApi } from "../lib/api";
import { ChannelSelect, RoleSelect, Check } from "./fields";
export function Settings({
  guild,
  api,
  notify,
}: {
  guild: Guild;
  api: RequestApi;
  notify: (s: string) => void;
}) {
  const [s, set] = useState<GuildSettings | null>(null),
    [busy, setBusy] = useState(false),
    [blocked, setBlocked] = useState("");
  useEffect(() => {
    let active = true;
    api<{ settings: GuildSettings }>(`/api/guilds/${guild.id}/settings`)
      .then((r) => {
        if (active) {
          set(r.settings);
          setBlocked((r.settings.antiPhishing?.blockedHosts ?? []).join("\n"));
        }
      })
      .catch((e) => notify(e.message));
    return () => {
      active = false;
    };
  }, [api, guild.id, notify]);
  if (!s) return <div className="panel">Cargando configuración…</div>;
  const update = (patch: GuildSettings) => set({ ...s, ...patch });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ settings: GuildSettings }>(
        `/api/guilds/${guild.id}/settings`,
        "PATCH",
        {
          ...s,
          antiPhishing: {
            ...s!.antiPhishing,
            blockedHosts: blocked
              .split("\n")
              .map((v) => v.trim())
              .filter(Boolean),
          },
        },
      );
      set(r.settings);
      notify("Configuración guardada.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save}>
      <fieldset disabled={busy}>
        <div className="grid2">
          <section className="panel">
            <h2>Bienvenidas y salidas</h2>
            <p>
              Personaliza los mensajes con {"{user}"}, {"{username}"} y {"{server}"}.
            </p>
            <ChannelSelect
              guild={guild}
              label="Canal de bienvenida"
              value={s.welcomeChannelId}
              onChange={(v) => update({ welcomeChannelId: v || null })}
            />
            <label>
              Mensaje de bienvenida
              <textarea
                maxLength={2000}
                value={s.welcomeMessage ?? "Hola {user}, bienvenido a **{server}**."}
                onChange={(e) => update({ welcomeMessage: e.target.value })}
              />
            </label>
            <ChannelSelect
              guild={guild}
              label="Canal de despedida"
              value={s.goodbyeChannelId}
              onChange={(v) => update({ goodbyeChannelId: v || null })}
            />
            <label>
              Mensaje de despedida
              <textarea
                maxLength={2000}
                value={s.goodbyeMessage ?? "**{username}** ha salido de **{server}**."}
                onChange={(e) => update({ goodbyeMessage: e.target.value })}
              />
            </label>
            <ChannelSelect
              guild={guild}
              label="Canal de registros"
              value={s.logsChannelId}
              onChange={(v) => update({ logsChannelId: v || null })}
            />
            <RoleSelect
              guild={guild}
              label="Rol automático"
              value={s.autoRoleId}
              onChange={(v) => update({ autoRoleId: v || null })}
            />
          </section>
          <section className="panel">
            <h2>Seguridad</h2>
            <p>Las alertas se guardan en PostgreSQL. Revisa el canal de registros para actuar.</p>
            <Check
              label="Detectar spam"
              value={s.antiSpam?.enabled !== false}
              onChange={(v) => update({ antiSpam: { ...s.antiSpam, enabled: v } })}
            />
            <label>
              Respuesta al spam
              <select
                value={s.antiSpam?.mode ?? "observe"}
                onChange={(e) =>
                  update({
                    antiSpam: { ...s.antiSpam, mode: e.target.value as "observe" | "timeout" },
                  })
                }
              >
                <option value="observe">Observar y registrar</option>
                <option value="timeout">Timeout tras infracciones repetidas</option>
              </select>
            </label>
            <div className="grid2">
              <label>
                Mensajes por ventana
                <input
                  type="number"
                  min={3}
                  max={30}
                  value={s.antiSpam?.maxMessages ?? 6}
                  onChange={(e) =>
                    update({ antiSpam: { ...s.antiSpam, maxMessages: Number(e.target.value) } })
                  }
                />
              </label>
              <label>
                Ventana (segundos)
                <input
                  type="number"
                  min={3}
                  max={60}
                  value={(s.antiSpam?.intervalMs ?? 8000) / 1000}
                  onChange={(e) =>
                    update({
                      antiSpam: { ...s.antiSpam, intervalMs: Number(e.target.value) * 1000 },
                    })
                  }
                />
              </label>
              <label>
                Infracciones antes de timeout
                <input
                  type="number"
                  min={2}
                  max={10}
                  value={s.antiSpam?.strikes ?? 2}
                  onChange={(e) =>
                    update({ antiSpam: { ...s.antiSpam, strikes: Number(e.target.value) } })
                  }
                />
              </label>
              <label>
                Timeout (segundos)
                <input
                  type="number"
                  min={10}
                  max={3600}
                  value={s.antiSpam?.timeoutSeconds ?? 60}
                  onChange={(e) =>
                    update({ antiSpam: { ...s.antiSpam, timeoutSeconds: Number(e.target.value) } })
                  }
                />
              </label>
            </div>
            <Check
              label="Detectar entradas masivas"
              value={s.antiRaid?.enabled !== false}
              onChange={(v) => update({ antiRaid: { ...s.antiRaid, enabled: v } })}
            />
            <div className="grid2">
              <label>
                Entradas por ventana
                <input
                  type="number"
                  min={3}
                  max={100}
                  value={s.antiRaid?.maxJoins ?? 8}
                  onChange={(e) =>
                    update({ antiRaid: { ...s.antiRaid, maxJoins: Number(e.target.value) } })
                  }
                />
              </label>
              <label>
                Ventana de entradas (segundos)
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={(s.antiRaid?.intervalMs ?? 15000) / 1000}
                  onChange={(e) =>
                    update({
                      antiRaid: { ...s.antiRaid, intervalMs: Number(e.target.value) * 1000 },
                    })
                  }
                />
              </label>
            </div>
            <Check
              label="Alertar acciones masivas de Audit Log"
              value={s.antiNuke?.enabled !== false}
              onChange={(v) => update({ antiNuke: { ...s.antiNuke, enabled: v } })}
            />
            <Check
              label="Detectar dominios bloqueados"
              value={s.antiPhishing?.enabled ?? false}
              onChange={(v) => update({ antiPhishing: { ...s.antiPhishing, enabled: v } })}
            />
            <label>
              Dominios bloqueados (uno por línea)
              <textarea
                value={blocked}
                onChange={(e) => setBlocked(e.target.value)}
                placeholder="dominio-bloqueado.example"
              />
            </label>
          </section>
          <section className="panel">
            <h2>Soporte y participación</h2>
            <Check
              label="Activar tickets privados"
              value={s.tickets?.enabled ?? false}
              onChange={(v) => update({ tickets: { ...s.tickets, enabled: v } })}
            />
            <ChannelSelect
              guild={guild}
              label="Categoría de tickets"
              types={[4]}
              value={s.tickets?.categoryId}
              onChange={(v) => update({ tickets: { ...s.tickets, categoryId: v || null } })}
            />
            <RoleSelect
              guild={guild}
              label="Rol de soporte"
              value={s.tickets?.staffRoleId}
              onChange={(v) => update({ tickets: { ...s.tickets, staffRoleId: v || null } })}
            />
            <Check
              label="Activar niveles por participación"
              value={s.levels?.enabled ?? false}
              onChange={(v) => update({ levels: { enabled: v } })}
            />
            <p>Los niveles otorgan 15 XP como máximo una vez por minuto.</p>
          </section>
        </div>
        <button className="primary" type="submit">
          {busy ? "Guardando…" : "Guardar configuración"}
        </button>
      </fieldset>
    </form>
  );
}
