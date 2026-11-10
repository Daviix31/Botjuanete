import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
const path = fileURLToPath(new URL("../.env", import.meta.url));
try {
  const template = await readFile(new URL("../.env.example", import.meta.url), "utf8"),
    password = randomBytes(24).toString("hex");
  await writeFile(
    path,
    template
      .replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${randomBytes(48).toString("hex")}`)
      .replace(/^POSTGRES_PASSWORD=.*$/m, `POSTGRES_PASSWORD=${password}`)
      .replace(
        /^DATABASE_URL=.*$/m,
        `DATABASE_URL=postgresql://noxis:${password}@localhost:5432/noxis_bot`,
      ),
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Archivo .env creado con secretos locales aleatorios. Completa los datos de tu aplicación de Discord y OWNER_USER_IDS.",
  );
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === "EEXIST")
    console.log("Tu .env ya existe; se conservó sin cambios.");
  else {
    console.error("No se pudo preparar .env.");
    process.exitCode = 1;
  }
}
