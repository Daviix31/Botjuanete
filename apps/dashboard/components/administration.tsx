"use client";
import { useEffect, useState } from "react";
import type { Guild, RequestApi } from "../lib/api";
import { RoleSelect, Check } from "./fields";
type Plan = { roles: string[]; categories: string[]; channels: string[] };
export function Administration({
  guild,
  api,
  notify,
}: {
  guild: Guild;
  api: RequestApi;
  notify: (s: string) => void;
}) {
  const [type, setType] = useState("comunidad"),
    [plan, setPlan] = useState<Plan | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [name, setName] = useState(""),
    [color, setColor] = useState("#D62828"),
    [userId, setUserId] = useState(""),
    [roleId, setRoleId] = useState(""),
    [operation, setOperation] = useState("role.assign");
  useEffect(() => {
    let active = true;
    setConfirmed(false);
    api<{ plan: Plan }>(`/api/templates/preview?type=${type}`)
      .then((r) => {
        if (active) setPlan(r.plan);
      })
      .catch((e) => notify(e.message));
    return () => {
      active = false;
    };
  }, [type, api, notify]);
  async function enqueue(kind: string, payload: unknown) {
    setBusy(true);
    try {
      await api("/api/jobs", "POST", { kind, payload, requestId: crypto.randomUUID() });
      notify("Acción en cola. Revisa su resultado en Actividad.");
      setConfirmed(false);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid2">
      <section className="panel">
        <h2>Plantillas de servidor</h2>
        <p>Configura la estructura de tu servidor de Discord.</p>
        <label>
          Tipo de comunidad
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="comunidad">Comunidad</option>
            <option value="gaming">Gaming</option>
          </select>
        </label>
        {plan && (
          <div className="plan">
            <h3>Vista previa</h3>
            <p>
              <b>Roles:</b> {plan.roles.join(", ")}
            </p>
            <p>
              <b>Categorías:</b> {plan.categories.join(", ")}
            </p>
            <p>
              <b>Canales:</b> {plan.channels.join(", ")}
            </p>
            <p className="muted">
              Se reutilizan recursos compatibles y se crean los que faltan. Tu configuración
              guardada se conserva.
            </p>
          </div>
        )}
        <Check
          label="He revisado la estructura y confirmo su creación"
          value={confirmed}
          onChange={setConfirmed}
        />
        <button
          className="primary"
          disabled={!confirmed || !plan || busy}
          onClick={() => enqueue("template.apply", { type, confirmed: true })}
        >
          Aplicar plantilla
        </button>
      </section>
      <section className="panel">
        <h2>Roles</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void enqueue("role.create", { name, color });
          }}
        >
          <fieldset disabled={busy}>
            <label>
              Nombre del nuevo rol
              <input
                required
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Color del rol
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            </label>
            <p>Los roles nuevos se crean sin permisos especiales.</p>
            <button className="secondary">Crear rol</button>
          </fieldset>
        </form>
        <div className="divider" />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void enqueue(operation, { userId, roleId });
          }}
        >
          <fieldset disabled={busy}>
            <label>
              ID del miembro
              <input
                required
                inputMode="numeric"
                pattern="[1-9][0-9]{16,19}"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </label>
            <RoleSelect
              guild={guild}
              label="Rol a administrar"
              value={roleId}
              onChange={setRoleId}
              empty={false}
            />
            <label>
              Operación
              <select value={operation} onChange={(e) => setOperation(e.target.value)}>
                <option value="role.assign">Asignar rol</option>
                <option value="role.remove">Quitar rol</option>
              </select>
            </label>
            <button className="primary">Aplicar cambio de rol</button>
          </fieldset>
        </form>
      </section>
    </div>
  );
}
