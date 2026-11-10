// Only emit numeric HTTP/Discord codes and known network codes. Error messages,
// request bodies, URLs and headers may contain secrets and must not be logged.
const networkCodes = new Set([
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "CERT_HAS_EXPIRED",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "SELF_SIGNED_CERT_IN_CHAIN",
]);

export function describeDeployFailure(error: unknown): string {
  const issue = error && typeof error === "object" ? error : {};
  const detail = issue as { status?: unknown; code?: unknown; cause?: unknown };
  const status =
    typeof detail.status === "number" &&
    Number.isInteger(detail.status) &&
    detail.status >= 100 &&
    detail.status <= 599
      ? detail.status
      : undefined;
  const code =
    typeof detail.code === "number" && Number.isSafeInteger(detail.code) && detail.code >= 0
      ? detail.code
      : undefined;
  const cause =
    detail.cause && typeof detail.cause === "object" ? (detail.cause as { code?: unknown }) : {};
  const connection = [detail.code, cause.code].find(
    (value): value is string => typeof value === "string" && networkCodes.has(value),
  );
  const details = [
    status === undefined ? undefined : `HTTP ${status}`,
    code === undefined ? undefined : `Discord ${code}`,
    connection,
  ]
    .filter(Boolean)
    .join(" · ");

  let advice =
    "Revisa la configuración local y comunica el estado HTTP y el código, sin compartir .env.";
  if (connection) {
    advice =
      "No se pudo completar la conexión con Discord. Revisa Internet, DNS, proxy y certificados del equipo.";
  } else if (status === 401 || code === 50014 || code === 40001) {
    advice = "Discord rechazó DISCORD_TOKEN. Usa el token del bot, sin el prefijo Bot.";
  } else if (code === 10002 || code === 20012) {
    advice =
      "Revisa DISCORD_CLIENT_ID: debe ser el Application ID de la misma aplicación que emitió el token.";
  } else if (code === 10004) {
    advice = "Revisa DISCORD_GUILD_ID y confirma que el bot esté invitado a ese servidor.";
  } else if (code === 50001 || code === 50013 || status === 403) {
    advice =
      "Revisa ambos IDs y autoriza la misma aplicación en ese servidor con bot y applications.commands. No hace falta Administrator para registrar comandos.";
  } else if (code === 50035) {
    advice =
      "Discord rechazó los datos de los comandos. Comunica HTTP 400 y Discord 50035 para revisar su definición.";
  } else if (status === 429) {
    advice = "Discord está limitando las solicitudes. Espera antes de repetir el registro.";
  }
  return `No se pudieron registrar los comandos${details ? ` (${details})` : " (sin código disponible)"}. ${advice}`;
}
