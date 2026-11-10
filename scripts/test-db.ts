import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
// Isolated PostgreSQL WASM engine for repeatable local tests. Production uses PostgreSQL 17.
const db = await PGlite.create();
const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 55432 });
await server.start();
console.log("NOXIS test DB: PostgreSQL WASM listo en 127.0.0.1:55432 (solo pruebas).");
const close = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.once("SIGTERM", () => void close());
process.once("SIGINT", () => void close());
