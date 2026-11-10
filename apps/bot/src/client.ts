import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import type { BotCommand } from "./types.js";
export class BotClient extends Client {
  commands = new Collection<string, BotCommand>();
  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
      ],
      partials: [Partials.Channel, Partials.Message],
    });
  }
}
