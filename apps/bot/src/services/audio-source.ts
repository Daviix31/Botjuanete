import ipaddr from "ipaddr.js";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request } from "node:https";
import type { IncomingMessage } from "node:http";
export function isPublicAddress(address: string): boolean {
  try {
    let parsed = ipaddr.parse(address);
    if (parsed.kind() === "ipv6" && (parsed as ipaddr.IPv6).isIPv4MappedAddress())
      parsed = (parsed as ipaddr.IPv6).toIPv4Address();
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}
export function validateAudioUrl(raw: string, allowed: Set<string>) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("URL de audio inválida.");
  }
  if (u.protocol !== "https:" || u.username || u.password || u.hash || (u.port && u.port !== "443"))
    throw new Error("Usa HTTPS sin credenciales, fragmentos ni puertos alternativos.");
  if (!allowed.has(u.hostname.toLowerCase()) || isIP(u.hostname.replace(/^\[|\]$/g, "")))
    throw new Error("Dominio de audio no autorizado.");
  return u;
}
export async function openAudio(
  raw: string,
  allowed: Set<string>,
  signal: AbortSignal,
): Promise<IncomingMessage> {
  const u = validateAudioUrl(raw, allowed),
    addresses = await lookup(u.hostname, { all: true });
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
    throw new Error("La fuente de audio no tiene una dirección pública segura.");
  signal.throwIfAborted();
  const selected = addresses[0]!;
  return new Promise((resolve, reject) => {
    const req = request(
      u,
      {
        signal,
        family: selected.family,
        headers: { "User-Agent": "NOXIS-BOT/0.2", Accept: "audio/*" },
        lookup: (_hostname, _options, cb) => cb(null, selected.address, selected.family),
      },
      (res) => {
        const mime = (res.headers["content-type"] ?? "").split(";")[0]!.toLowerCase();
        if (
          res.statusCode !== 200 ||
          !/^(audio\/(mpeg|mp3|mp4|aac|ogg|opus|wav|wave|x-wav|flac|x-flac|webm)|application\/ogg)$/.test(
            mime,
          )
        ) {
          res.destroy();
          reject(new Error("La fuente debe responder audio directo HTTP 200, sin redirecciones."));
          return;
        }
        if (Number(res.headers["content-length"] ?? 0) > 150 * 1024 * 1024) {
          res.destroy();
          reject(new Error("El archivo de audio supera el límite de 150 MB."));
          return;
        }
        resolve(res);
      },
    );
    req.setTimeout(15000, () => req.destroy(new Error("La fuente de audio tardó demasiado.")));
    req.on("error", reject);
    req.end();
  });
}
