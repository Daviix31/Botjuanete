import {
  REST,
  Routes,
  PermissionFlagsBits,
  PermissionsBitField,
  ChannelType,
  type APIGuild,
  type APIGuildMember,
  type APIRole,
  type APIChannel,
  type APIUser,
} from "discord.js";
import type { GuildSettings } from "@noxis/shared";
import { config } from "./config.js";
export class AccessError extends Error {
  statusCode = 403;
}
export type GuildResources = {
  id: string;
  name: string;
  channels: { id: string; name: string; type: number }[];
  roles: { id: string; name: string; position: number; managed: boolean }[];
};
export interface DiscordAdmin {
  resources(actorId: string): Promise<GuildResources>;
  authorize(actorId: string, permission: bigint): Promise<void>;
  validateSettings(actorId: string, patch: GuildSettings): Promise<void>;
  validateAnnouncement(actorId: string, channelId: string): Promise<void>;
}
export function createDiscordAdmin(): DiscordAdmin {
  const rest = new REST({ version: "10", timeout: 10000, retries: 1 }).setToken(
    config.DISCORD_TOKEN,
  );
  const id = config.DISCORD_GUILD_ID;
  async function context(actorId: string) {
    const [guild, roles, member, bot] = await Promise.all([
      rest.get(Routes.guild(id)) as Promise<APIGuild>,
      rest.get(Routes.guildRoles(id)) as Promise<APIRole[]>,
      rest.get(Routes.guildMember(id, actorId)) as Promise<APIGuildMember>,
      rest.get(Routes.user("@me")) as Promise<APIUser>,
    ]);
    const botMember = (await rest.get(Routes.guildMember(id, bot.id))) as APIGuildMember;
    const permissions = (m: APIGuildMember) =>
      new PermissionsBitField(
        roles
          .filter((r) => r.id === id || m.roles.includes(r.id))
          .reduce((a, r) => a | BigInt(r.permissions), 0n),
      );
    return {
      guild,
      roles,
      member,
      botMember,
      botId: bot.id,
      actorPermissions: permissions(member),
      botPermissions: permissions(botMember),
    };
  }
  async function authorize(actorId: string, permission: bigint) {
    const c = await context(actorId);
    if (c.guild.owner_id !== actorId && !c.actorPermissions.has(permission))
      throw new AccessError("Tu cuenta no tiene los permisos necesarios en el servidor.");
  }
  function channelPermissions(
    base: PermissionsBitField,
    c: APIChannel,
    roles: string[],
    userId: string,
  ) {
    const bits = new PermissionsBitField(base.bitfield);
    if (bits.has(PermissionFlagsBits.Administrator)) return bits;
    if (!("permission_overwrites" in c)) return bits;
    const os = c.permission_overwrites ?? [];
    const apply = (allow: bigint, deny: bigint) => {
      bits.remove(deny);
      bits.add(allow);
    };
    const everyone = os.find((o) => o.id === id);
    if (everyone) apply(BigInt(everyone.allow), BigInt(everyone.deny));
    const matching = os.filter((o) => o.type === 0 && roles.includes(o.id));
    apply(
      matching.reduce((a, o) => a | BigInt(o.allow), 0n),
      matching.reduce((a, o) => a | BigInt(o.deny), 0n),
    );
    const member = os.find((o) => o.type === 1 && o.id === userId);
    if (member) apply(BigInt(member.allow), BigInt(member.deny));
    return bits;
  }
  async function validateAnnouncement(actorId: string, channelId: string) {
    const c = await context(actorId);
    if (c.guild.owner_id !== actorId && !c.actorPermissions.has(PermissionFlagsBits.ManageMessages))
      throw new AccessError("Necesitas Administrar mensajes.");
    const channel = (await rest.get(Routes.channel(channelId))) as APIChannel;
    if (
      !("guild_id" in channel) ||
      channel.guild_id !== id ||
      ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)
    )
      throw new AccessError("Elige un canal de texto de tu servidor.");
    const needed = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ];
    if (!channelPermissions(c.botPermissions, channel, c.botMember.roles, c.botId).has(needed))
      throw new AccessError("El bot no puede enviar embeds en ese canal.");
    if (
      c.guild.owner_id !== actorId &&
      !channelPermissions(c.actorPermissions, channel, c.member.roles, actorId).has([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
      ])
    )
      throw new AccessError("Tu cuenta no puede publicar en ese canal.");
  }
  return {
    authorize,
    validateAnnouncement,
    async resources(actorId) {
      await authorize(actorId, PermissionFlagsBits.ManageGuild);
      const [guild, roles, channels] = await Promise.all([
        rest.get(Routes.guild(id)) as Promise<APIGuild>,
        rest.get(Routes.guildRoles(id)) as Promise<APIRole[]>,
        rest.get(Routes.guildChannels(id)) as Promise<APIChannel[]>,
      ]);
      return {
        id,
        name: guild.name,
        channels: channels
          .filter((c) => "name" in c)
          .map((c) => ({ id: c.id, name: ("name" in c ? c.name : null) ?? c.id, type: c.type })),
        roles: roles.map((r) => ({
          id: r.id,
          name: r.name,
          position: r.position,
          managed: r.managed,
        })),
      };
    },
    async validateSettings(actorId, patch) {
      await authorize(actorId, PermissionFlagsBits.ManageGuild);
      for (const channelId of [patch.welcomeChannelId, patch.goodbyeChannelId, patch.logsChannelId])
        if (channelId) await validateAnnouncement(actorId, channelId);
      const c = await context(actorId);
      const auto = patch.autoRoleId;
      if (auto) {
        const r = c.roles.find((r) => r.id === auto);
        const botTop = Math.max(
          ...c.roles.filter((r) => c.botMember.roles.includes(r.id)).map((r) => r.position),
        );
        const dangerous =
          PermissionFlagsBits.Administrator |
          PermissionFlagsBits.ManageGuild |
          PermissionFlagsBits.ManageRoles |
          PermissionFlagsBits.ManageChannels |
          PermissionFlagsBits.BanMembers |
          PermissionFlagsBits.KickMembers |
          PermissionFlagsBits.ModerateMembers |
          PermissionFlagsBits.ManageWebhooks |
          PermissionFlagsBits.MentionEveryone |
          PermissionFlagsBits.ManageMessages |
          PermissionFlagsBits.ManageNicknames |
          PermissionFlagsBits.ManageThreads |
          PermissionFlagsBits.ManageEvents |
          PermissionFlagsBits.ViewAuditLog |
          PermissionFlagsBits.ManageGuildExpressions;
        if (
          !r ||
          r.id === id ||
          r.managed ||
          r.position >= botTop ||
          (BigInt(r.permissions) & dangerous) !== 0n ||
          !c.botPermissions.has(PermissionFlagsBits.ManageRoles)
        )
          throw new AccessError("Autorol no seguro o fuera de la jerarquía del bot.");
      }
      if (patch.tickets?.categoryId) {
        const cat = (await rest.get(Routes.channel(patch.tickets.categoryId))) as APIChannel;
        if (cat.type !== ChannelType.GuildCategory || cat.guild_id !== id)
          throw new AccessError("Categoría de tickets inválida.");
      }
      if (
        patch.tickets?.staffRoleId &&
        !c.roles.some((r) => r.id === patch.tickets!.staffRoleId && r.id !== id && !r.managed)
      )
        throw new AccessError("Rol de soporte inválido.");
    },
  };
}
