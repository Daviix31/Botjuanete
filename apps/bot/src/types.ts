import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import type { BotClient } from "./client.js";
export type CommandData =
  SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
export interface BotCommand {
  data: CommandData;
  execute(interaction: ChatInputCommandInteraction, client: BotClient): Promise<void>;
}
