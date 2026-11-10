import { spawn, type ChildProcess } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { testEnv, fixtures as f } from "./test-env.js";
const database = await PGlite.create(),
  server = new PGLiteSocketServer({ db: database, port: 0, host: "127.0.0.1" });
await server.start();
Object.assign(process.env, testEnv(`postgresql://test:test@${server.getServerConn()}/noxis_test`));
const { migrate } = await import("../packages/database/scripts/migrate.js");
await migrate();
const { buildApp } = await import("../apps/api/src/app.js");
const { createSession } = await import("../apps/api/src/auth.js");
const discord = {
  resources: async () => ({
    id: f.guildId,
    name: "NOXIS TEST",
    channels: [
      { id: f.channelId, name: "general", type: 0 },
      { id: "333333333333333334", name: "soporte", type: 4 },
      { id: "333333333333333335", name: "sala-general", type: 2 },
    ],
    roles: [{ id: f.roleId, name: "Miembro", position: 1, managed: false }],
  }),
  authorize: async () => {},
  validateSettings: async () => {},
  validateAnnouncement: async () => {},
};
const app = await buildApp({ discord, logger: false });
await app.listen({ host: "127.0.0.1", port: 4000 });
process.env.NOXIS_E2E_COOKIE = await createSession({
  id: f.ownerId,
  username: "Owner",
  avatar: null,
});
function run(args: string[]) {
  return new Promise<number>((resolve) => {
    const c = spawn(process.execPath, args, { env: process.env, stdio: "inherit" });
    c.once("exit", (code) => resolve(code ?? 1));
    c.once("error", () => resolve(1));
  });
}
let web: ChildProcess | undefined;
try {
  const build = await run(["node_modules/next/dist/bin/next", "build", "apps/dashboard"]);
  if (build) throw new Error("No se pudo compilar el panel para E2E.");
  web = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "apps/dashboard", "-H", "127.0.0.1", "-p", "3000"],
    { env: process.env, stdio: "inherit" },
  );
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      ready = (await fetch("http://127.0.0.1:3000")).ok;
    } catch {}
    if (ready) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) throw new Error("El panel no inició.");
  process.exitCode = await run(["node_modules/@playwright/test/cli.js", "test"]);
} finally {
  web?.kill("SIGTERM");
  await app.close();
  const { closeDatabase } = await import("@noxis/database");
  await closeDatabase();
  await server.stop();
  await database.close();
}
