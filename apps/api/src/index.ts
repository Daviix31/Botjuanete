import "./env.js";
import { buildApp } from "./app.js";
import { config } from "./config.js";
import { closeDatabase } from "@noxis/database";
const app = await buildApp();
const shutdown = async () => {
  await app.close();
  await closeDatabase();
};
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
try {
  await app.listen({ host: config.API_HOST, port: config.API_PORT });
} catch {
  app.log.error("NOXIS API no pudo iniciar; revisa configuración y puerto.");
  await shutdown();
  process.exitCode = 1;
}
