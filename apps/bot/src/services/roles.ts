import { PermissionFlagsBits as P, type Guild } from "discord.js";
import { recordAudit } from "@noxis/database";
import { jobPayloadSchemas } from "@noxis/shared";
import { assertActor, assertBot, assertRoleChange } from "../utils/permissions.js";
export async function createRole(guild: Guild, actorId: string, input: unknown) {
  const data = jobPayloadSchemas["role.create"].parse(input);
  await assertActor(guild, actorId, P.ManageRoles);
  await assertBot(guild, [P.ManageRoles]);
  await recordAudit(guild.id, actorId, "role.create.request");
  const role = await guild.roles.create({
    name: data.name,
    color: parseInt(data.color.slice(1), 16),
    hoist: data.hoist,
    mentionable: data.mentionable,
    permissions: [],
    reason: `NOXIS · ${actorId}`,
  });
  await recordAudit(guild.id, actorId, "role.create", role.id);
  return { id: role.id, name: role.name };
}
export async function changeRole(
  guild: Guild,
  actorId: string,
  userId: string,
  roleId: string,
  add: boolean,
) {
  const [role, target] = await Promise.all([
    guild.roles.fetch(roleId, { force: true }),
    guild.members.fetch({ user: userId, force: true }),
  ]);
  if (!role) throw new Error("Rol no encontrado.");
  await assertRoleChange(guild, actorId, role, target);
  await recordAudit(
    guild.id,
    actorId,
    add ? "role.assign.request" : "role.remove.request",
    role.id,
    { userId },
  );
  if (add) await target.roles.add(role, `NOXIS · ${actorId}`);
  else await target.roles.remove(role, `NOXIS · ${actorId}`);
  await recordAudit(guild.id, actorId, add ? "role.assign" : "role.remove", role.id, { userId });
  return { id: role.id, userId };
}
