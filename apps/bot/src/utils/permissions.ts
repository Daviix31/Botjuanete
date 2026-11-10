import {
  PermissionFlagsBits as P,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
  type Role,
} from "discord.js";
import { config } from "../config.js";
export const dangerousPermissions =
  P.Administrator |
  P.ManageGuild |
  P.ManageRoles |
  P.ManageChannels |
  P.BanMembers |
  P.KickMembers |
  P.ModerateMembers |
  P.ManageWebhooks |
  P.MentionEveryone |
  P.ManageMessages |
  P.ManageNicknames |
  P.ManageThreads |
  P.ManageEvents |
  P.ViewAuditLog |
  P.ManageGuildExpressions;
export function isOwner(id: string) {
  return config.ownerIds.has(id);
}
export function isOwnerOrAdmin(i: ChatInputCommandInteraction) {
  return Boolean(i.memberPermissions?.has(P.ManageMessages));
}
export function isManager(i: ChatInputCommandInteraction) {
  return Boolean(i.memberPermissions?.has(P.ManageGuild));
}
export async function assertActor(guild: Guild, actorId: string, permission: bigint) {
  if (guild.id !== config.DISCORD_GUILD_ID) throw new Error("Servidor no autorizado.");
  const actor = await guild.members.fetch({ user: actorId, force: true });
  if (actorId !== guild.ownerId && !actor.permissions.has(permission))
    throw new Error("No tienes los permisos necesarios en este servidor.");
  return actor;
}
export async function assertBot(guild: Guild, permissions: bigint[]) {
  const bot = await guild.members.fetchMe({ force: true });
  if (!bot.permissions.has(permissions))
    throw new Error("El bot no tiene los permisos necesarios.");
  return bot;
}
export function rolePolicy(input: {
  everyone: boolean;
  managed: boolean;
  rolePosition: number;
  targetPosition?: number;
  botPosition: number;
  actorPosition: number;
  actorIsGuildOwner: boolean;
  actorPermissions: bigint;
  rolePermissions: bigint;
  targetIsGuildOwner?: boolean;
}) {
  if (
    input.everyone ||
    input.managed ||
    input.rolePosition >= input.botPosition ||
    input.targetIsGuildOwner ||
    (input.targetPosition ?? -1) >= input.botPosition
  )
    throw new Error("Rol o miembro fuera de la jerarquía del bot.");
  if (
    !input.actorIsGuildOwner &&
    (input.rolePosition >= input.actorPosition ||
      (input.targetPosition ?? -1) >= input.actorPosition ||
      ((input.actorPermissions & P.Administrator) === 0n &&
        (input.actorPermissions & input.rolePermissions) !== input.rolePermissions))
  )
    throw new Error(
      "No puedes administrar roles o miembros por encima de tu jerarquía ni otorgar permisos que no tienes.",
    );
}
export async function assertRoleChange(
  guild: Guild,
  actorId: string,
  role: Role,
  target?: GuildMember,
) {
  const actor = await assertActor(guild, actorId, P.ManageRoles),
    bot = await assertBot(guild, [P.ManageRoles]);
  rolePolicy({
    everyone: role.id === guild.id,
    managed: role.managed,
    rolePosition: role.position,
    targetPosition: target?.roles.highest.position,
    botPosition: bot.roles.highest.position,
    actorPosition: actor.roles.highest.position,
    actorIsGuildOwner: actorId === guild.ownerId,
    actorPermissions: actor.permissions.bitfield,
    rolePermissions: role.permissions.bitfield,
    targetIsGuildOwner: target?.id === guild.ownerId,
  });
}
export async function assertAutoRole(guild: Guild, roleId: string) {
  const role = await guild.roles.fetch(roleId, { force: true }),
    bot = await assertBot(guild, [P.ManageRoles]);
  if (
    !role ||
    role.id === guild.id ||
    role.managed ||
    role.position >= bot.roles.highest.position ||
    (role.permissions.bitfield & dangerousPermissions) !== 0n
  )
    throw new Error("Autorol inseguro o fuera de la jerarquía del bot.");
  return role;
}
