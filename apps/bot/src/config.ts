import "./env.js";
import { z } from "zod";
import { snowflake } from "@noxis/shared";
const parsed = z
  .object({
    DISCORD_TOKEN: z.string().min(1),
    DISCORD_CLIENT_ID: snowflake,
    DISCORD_GUILD_ID: snowflake,
    OWNER_USER_IDS: z.string().min(1),
    MUSIC_ALLOWED_HOSTS: z.string().default(""),
    FFMPEG_PATH: z.string().optional(),
  })
  .safeParse(process.env);
if (!parsed.success)
  throw new Error(
    `Configuración BOT inválida: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
  );
export const config = {
  ...parsed.data,
  ownerIds: new Set(parsed.data.OWNER_USER_IDS.split(",").map((s) => snowflake.parse(s.trim()))),
  musicAllowedHosts: new Set(
    parsed.data.MUSIC_ALLOWED_HOSTS.split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  ),
};
