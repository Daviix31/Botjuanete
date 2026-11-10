import "./env.js";
import { REST, Routes } from "discord.js";
import { commands } from "./commands/index.js";
import { config } from "./config.js";
import { describeDeployFailure } from "./utils/deploy-error.js";
const rest = new REST({ version: "10", timeout: 15000, retries: 1 }).setToken(config.DISCORD_TOKEN);
try {
  await rest.put(
    Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID),
    { body: commands.map((c) => ({ ...c.data.toJSON(), dm_permission: false })) },
  );
  console.log(`Registrados ${commands.length} comandos en el servidor privado.`);
} catch (error) {
  console.error(describeDeployFailure(error));
  process.exitCode = 1;
}
