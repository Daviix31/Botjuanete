import { withGuildLock } from "../utils/locks.js";
import { ChannelType, PermissionFlagsBits as P, type Guild } from "discord.js";
import { templateType, templatePlan } from "@noxis/shared";
import { getGuildSettings, updateGuildSettings, recordAudit } from "@noxis/database";
import {
  assertActor,
  assertBot,
  assertAutoRole,
  dangerousPermissions,
} from "../utils/permissions.js";
export function applyTemplate(guild: Guild, actorId: string, input: unknown) {
  return withGuildLock(guild.id, () => applyTemplateUnlocked(guild, actorId, input));
}
async function applyTemplateUnlocked(guild: Guild, actorId: string, input: unknown) {
  const type = templateType.parse(input);
  await assertActor(guild, actorId, P.ManageGuild | P.ManageChannels | P.ManageRoles);
  await assertBot(guild, [P.ManageChannels, P.ManageRoles]);
  await Promise.all([guild.roles.fetch(), guild.channels.fetch()]);
  const created: string[] = [];
  const audit = async (id: string, kind: string) => {
    created.push(id);
    await recordAudit(guild.id, actorId, `template.create.${kind}`, id, { type });
  };
  async function role(name: string, permissions: bigint[]) {
    const found = guild.roles.cache.find((r) => r.name === name && !r.managed);
    if (found) {
      const bot = await guild.members.fetchMe();
      if (found.position >= bot.roles.highest.position)
        throw new Error("El rol existente queda fuera de la jerarquía del bot.");
      if (name === "Miembro" && (found.permissions.bitfield & dangerousPermissions) !== 0n)
        throw new Error(
          "El rol Miembro existente tiene permisos elevados; revísalo antes de aplicar.",
        );
      return found;
    }
    const made = await guild.roles.create({
      name,
      permissions,
      reason: `NOXIS plantilla · ${actorId}`,
    });
    await audit(made.id, "role");
    return made;
  }
  const member = await role("Miembro", []),
    staff = await role("NOXIS Staff", [P.ManageMessages, P.ModerateMembers]);
  const bot = await guild.members.fetchMe();
  async function category(name: string, privateRoleId?: string) {
    let found = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name === name,
    );
    if (found && privateRoleId) {
      if (
        found.type !== ChannelType.GuildCategory ||
        !found.permissionOverwrites.cache.get(guild.id)?.deny.has(P.ViewChannel)
      )
        throw new Error(
          "La categoría STAFF existente no es privada; no se modificó. Corrige sus permisos antes de continuar.",
        );
    }
    if (found) return found;
    const made = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
      permissionOverwrites: privateRoleId
        ? [
            { id: guild.id, deny: [P.ViewChannel] },
            { id: privateRoleId, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] },
            {
              id: bot.id,
              allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ReadMessageHistory],
            },
          ]
        : [],
      reason: `NOXIS plantilla · ${actorId}`,
    });
    await audit(made.id, "category");
    return made;
  }
  const info = await category("INFORMACIÓN"),
    community = await category(type === "gaming" ? "GAMING" : "COMUNIDAD"),
    support = await category("SOPORTE"),
    privateStaff = await category("STAFF · PRIVADO", staff.id);
  async function text(name: string, parent: string) {
    const found = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildText && c.name === name && c.parentId === parent,
    );
    if (found) return found;
    const made = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent,
      reason: `NOXIS plantilla · ${actorId}`,
    });
    await audit(made.id, "channel");
    return made;
  }
  const welcome = await text("bienvenida", info.id),
    goodbye = await text("despedidas", info.id);
  for (const name of ["reglas", "anuncios"]) await text(name, info.id);
  for (const name of ["general", "multimedia"]) await text(name, community.id);
  for (const name of ["soporte", "reportes"]) await text(name, support.id);
  await text("staff-chat", privateStaff.id);
  const logs = await text("logs", privateStaff.id);
  const voice = type === "gaming" ? "sala-gaming" : "sala-general";
  if (
    !guild.channels.cache.some(
      (c) => c.type === ChannelType.GuildVoice && c.name === voice && c.parentId === community.id,
    )
  ) {
    const c = await guild.channels.create({
      name: voice,
      type: ChannelType.GuildVoice,
      parent: community.id,
      reason: `NOXIS plantilla · ${actorId}`,
    });
    await audit(c.id, "voice");
  }
  const settings = await getGuildSettings(guild.id);
  const defaults = {
    welcomeChannelId: welcome.id,
    goodbyeChannelId: goodbye.id,
    logsChannelId: logs.id,
    autoRoleId: member.id,
  };
  await assertAutoRole(guild, member.id);
  const patch = Object.fromEntries(
    Object.entries(defaults).filter(
      ([key]) => settings[key as keyof typeof settings] === undefined,
    ),
  );
  if (Object.keys(patch).length) await updateGuildSettings(guild.id, patch, actorId);
  await recordAudit(guild.id, actorId, "template.apply", undefined, { type, created });
  return { type, created, plan: templatePlan(type) };
}
