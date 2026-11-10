import { randomBytes } from "node:crypto";
export const fixtures = {
  guildId: "111111111111111111",
  ownerId: "222222222222222222",
  channelId: "333333333333333333",
  roleId: "444444444444444444",
  strangerId: "555555555555555555",
  botId: "666666666666666666",
};
export function testEnv(databaseUrl: string) {
  return {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl,
    DATABASE_SSL: "false",
    DATABASE_POOL_MAX: "1",
    DISCORD_TOKEN: "test-bot-token-unused",
    DISCORD_CLIENT_ID: "777777777777777777",
    DISCORD_CLIENT_SECRET: "test-client-secret-unused",
    DISCORD_GUILD_ID: fixtures.guildId,
    OWNER_USER_IDS: fixtures.ownerId,
    SESSION_SECRET: randomBytes(48).toString("hex"),
    DASHBOARD_URL: "http://127.0.0.1:3000",
    API_PUBLIC_URL: "http://127.0.0.1:4000",
    DISCORD_REDIRECT_URI: "http://127.0.0.1:4000/auth/callback",
    NEXT_PUBLIC_API_URL: "http://127.0.0.1:4000",
    ENV_FILE: "/nonexistent/noxis-test-env",
    NEXT_TELEMETRY_DISABLED: "1",
    MUSIC_ALLOWED_HOSTS: "audio.example.com",
  };
}
