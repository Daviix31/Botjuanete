import type { Guild } from "../lib/api";
export function ChannelSelect({
  guild,
  value,
  onChange,
  label,
  types = [0, 5],
  empty = true,
}: {
  guild: Guild;
  value: string | null | undefined;
  onChange: (value: string) => void;
  label: string;
  types?: number[];
  empty?: boolean;
}) {
  return (
    <label>
      {label}
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} required={!empty}>
        <option value="">{empty ? "Desactivado / sin canal" : "Selecciona un canal"}</option>
        {guild.channels
          .filter((c) => types.includes(c.type))
          .map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
      </select>
    </label>
  );
}
export function RoleSelect({
  guild,
  value,
  onChange,
  label,
  empty = true,
}: {
  guild: Guild;
  value: string | null | undefined;
  onChange: (value: string) => void;
  label: string;
  empty?: boolean;
}) {
  return (
    <label>
      {label}
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} required={!empty}>
        <option value="">{empty ? "Sin rol" : "Selecciona un rol"}</option>
        {guild.roles
          .filter((r) => r.id !== guild.id && !r.managed)
          .sort((a, b) => b.position - a.position)
          .map((r) => (
            <option key={r.id} value={r.id}>
              @{r.name}
            </option>
          ))}
      </select>
    </label>
  );
}
export function Check({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="check">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
