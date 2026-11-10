export const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
export type User = { id: string; username: string; avatar: string | null };
export type Me = { user: User; csrf: string; guildId: string };
export type Guild = {
  id: string;
  name: string;
  channels: { id: string; name: string; type: number }[];
  roles: { id: string; name: string; position: number; managed: boolean }[];
};
export type Overview = {
  configuredServers: number;
  securityEvents7d: number;
  pendingAnnouncements: number;
  savedPlaylists: number;
  openTickets: number;
  rankedMembers: number;
};
export type Job = {
  id: string;
  kind: string;
  status: string;
  error: string | null;
  created_at: string;
};
export type RequestApi = <T>(path: string, method?: string, body?: unknown) => Promise<T>;
export function createApi(csrf: string, onUnauthorized?: () => void): RequestApi {
  return async <T>(path: string, method = "GET", body?: unknown) => {
    const response = await fetch(`${API}${path}`, {
      method,
      credentials: "include",
      cache: "no-store",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(method !== "GET" ? { "X-CSRF-Token": csrf } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json().catch(() => ({ error: "Respuesta inválida de la API." }));
    if (response.status === 401) onUnauthorized?.();
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? "Tu sesión ha caducado. Vuelve a iniciar sesión."
          : (data.error ?? "No se pudo completar la solicitud."),
      );
    return data as T;
  };
}
