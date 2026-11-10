import "./env.js";
import { z } from "zod";
import { snowflake } from "@noxis/shared";
const schema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: snowflake,
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DISCORD_REDIRECT_URI: z.url(),
  OWNER_USER_IDS: z.string().min(1),
  DISCORD_GUILD_ID: snowflake,
  SESSION_SECRET: z
    .string()
    .min(32)
    .refine((s) => !s.includes("CAMBIA_ESTO"), "Configura un secreto aleatorio"),
  DASHBOARD_URL: z.url(),
  API_PUBLIC_URL: z.url().default("http://localhost:4000"),
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});
const result = schema.safeParse(process.env);
if (!result.success)
  throw new Error(
    `Configuración API inválida: ${result.error.issues.map((i) => i.path.join(".")).join(", ")}`,
  );
const ownerIds = new Set(
  result.data.OWNER_USER_IDS.split(",").map((s) => snowflake.parse(s.trim())),
);
if (
  result.data.NODE_ENV === "production" &&
  [result.data.DASHBOARD_URL, result.data.API_PUBLIC_URL, result.data.DISCORD_REDIRECT_URI].some(
    (u) => new URL(u).protocol !== "https:",
  )
)
  throw new Error("Producción requiere HTTPS en API, panel y callback");
if (new URL(result.data.DISCORD_REDIRECT_URI).origin !== new URL(result.data.API_PUBLIC_URL).origin)
  throw new Error("El callback debe pertenecer a API_PUBLIC_URL");
export const config = { ...result.data, ownerIds };
export const sessionKey = new TextEncoder().encode(config.SESSION_SECRET);
