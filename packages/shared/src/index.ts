import { z } from "zod";
export const snowflake = z.string().regex(/^[1-9]\d{16,19}$/, "ID de Discord inválido");
export const hexColor = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i)
  .default("#D62828");
export const httpsUrl = z
  .string()
  .max(1000)
  .url()
  .refine((raw) => {
    const u = new URL(raw);
    return u.protocol === "https:" && !u.username && !u.password;
  }, "Se requiere una URL HTTPS sin credenciales");
const channelId = snowflake.nullable().optional();
export const settingsPatchSchema = z
  .object({
    welcomeChannelId: channelId,
    goodbyeChannelId: channelId,
    logsChannelId: channelId,
    autoRoleId: channelId,
    welcomeMessage: z.string().min(1).max(2000).optional(),
    goodbyeMessage: z.string().min(1).max(2000).optional(),
    antiSpam: z
      .object({
        enabled: z.boolean().optional(),
        mode: z.enum(["observe", "timeout"]).optional(),
        maxMessages: z.number().int().min(3).max(30).optional(),
        intervalMs: z.number().int().min(3000).max(60000).optional(),
        timeoutSeconds: z.number().int().min(10).max(3600).optional(),
        strikes: z.number().int().min(2).max(10).optional(),
      })
      .strict()
      .optional(),
    antiRaid: z
      .object({
        enabled: z.boolean().optional(),
        maxJoins: z.number().int().min(3).max(100).optional(),
        intervalMs: z.number().int().min(5000).max(120000).optional(),
      })
      .strict()
      .optional(),
    antiPhishing: z
      .object({
        enabled: z.boolean().optional(),
        blockedHosts: z
          .array(
            z
              .string()
              .regex(/^(?!-)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i)
              .max(253),
          )
          .max(100)
          .optional(),
      })
      .strict()
      .optional(),
    antiNuke: z
      .object({
        enabled: z.boolean().optional(),
        maxActions: z.number().int().min(2).max(30).optional(),
        intervalMs: z.number().int().min(5000).max(120000).optional(),
      })
      .strict()
      .optional(),
    tickets: z
      .object({ enabled: z.boolean().optional(), categoryId: channelId, staffRoleId: channelId })
      .strict()
      .optional(),
    levels: z.object({ enabled: z.boolean().optional() }).strict().optional(),
  })
  .strict();
export type GuildSettings = z.infer<typeof settingsPatchSchema>;
export const announcementSchema = z
  .object({
    title: z.string().trim().min(1).max(256),
    description: z.string().trim().min(1).max(4000),
    color: hexColor,
    image: httpsUrl.nullable().optional(),
  })
  .strict();
export type Announcement = z.infer<typeof announcementSchema>;
export const templateType = z.enum(["comunidad", "gaming"]);
export const jobPayloadSchemas = {
  "announcement.send": z.object({ channelId: snowflake, embed: announcementSchema }).strict(),
  "template.apply": z.object({ type: templateType, confirmed: z.literal(true) }).strict(),
  "role.create": z
    .object({
      name: z.string().trim().min(1).max(100),
      color: hexColor,
      hoist: z.boolean().default(false),
      mentionable: z.boolean().default(false),
    })
    .strict(),
  "role.assign": z.object({ userId: snowflake, roleId: snowflake }).strict(),
  "role.remove": z.object({ userId: snowflake, roleId: snowflake }).strict(),
  "music.control": z
    .object({
      action: z.enum(["pausa", "reanudar", "saltar", "detener", "volumen"]),
      volume: z.number().int().min(0).max(100).optional(),
    })
    .strict(),
  "music.play": z
    .object({ url: httpsUrl, title: z.string().trim().min(1).max(150), voiceChannelId: snowflake })
    .strict(),
} as const;
export type JobKind = keyof typeof jobPayloadSchemas;
export const jobRequestSchema = z
  .object({
    kind: z.enum(Object.keys(jobPayloadSchemas) as [JobKind, ...JobKind[]]),
    payload: z.unknown(),
    requestId: z.uuid(),
  })
  .strict();
export function parseJob(kind: JobKind, payload: unknown) {
  return jobPayloadSchemas[kind].parse(payload);
}
export function renderMemberMessage(
  template: string,
  userId: string,
  username: string,
  guild: string,
) {
  return template
    .replace(
      /\{(user|username|server)\}/g,
      (_, name: string) => ({ user: `<@${userId}>`, username, server: guild })[name] ?? "",
    )
    .slice(0, 2000);
}
export const templatePlan = (type: z.infer<typeof templateType>) => ({
  roles: ["Miembro", "NOXIS Staff"],
  categories: [
    "INFORMACIÓN",
    type === "gaming" ? "GAMING" : "COMUNIDAD",
    "SOPORTE",
    "STAFF · PRIVADO",
  ],
  channels: [
    "bienvenida",
    "despedidas",
    "reglas",
    "anuncios",
    "general",
    "multimedia",
    "soporte",
    "reportes",
    "staff-chat",
    "logs",
    type === "gaming" ? "sala-gaming" : "sala-general",
  ],
});
export function levelFromXp(xp: number) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100));
}
export const disabledMentions = {
  parse: [] as ("roles" | "users" | "everyone")[],
  repliedUser: false,
};
