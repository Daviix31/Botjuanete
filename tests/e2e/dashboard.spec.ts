import { test, expect } from "./fixtures.js";
test("acceso anónimo y diseño móvil", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Acceso restringido" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Continuar con Discord" })).toHaveAttribute(
    "href",
    /4000\/auth\/discord$/,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test("panel autorizado persiste configuración y ofrece los módulos", async ({ page, context }) => {
  await context.addCookies([
    {
      name: "noxis_session",
      value: process.env.NOXIS_E2E_COOKIE!,
      url: "http://127.0.0.1:4000",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "NOXIS TEST" })).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Canal de bienvenida", exact: true })
    .selectOption("333333333333333333");
  await page
    .getByRole("textbox", { name: "Mensaje de bienvenida", exact: true })
    .fill("Bienvenido {user} a NOXIS.");
  await page.getByRole("button", { name: "Guardar configuración" }).click();
  await expect(page.getByRole("status")).toContainText("Configuración guardada");
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Mensaje de bienvenida", exact: true }),
  ).toHaveValue("Bienvenido {user} a NOXIS.");
  await page.getByRole("navigation").getByRole("button", { name: "Anuncios", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Canal del anuncio", exact: true })
    .selectOption("333333333333333333");
  await page.getByRole("textbox", { name: "Título", exact: true }).fill("Noche NOXIS");
  await page
    .getByRole("textbox", { name: "Contenido", exact: true })
    .fill("Todos invitados al evento.");
  await expect(page.locator(".embed-preview")).toContainText("Noche NOXIS");
  await page.getByRole("button", { name: "Enviar anuncio", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Anuncio en cola");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Actividad", exact: true })
    .click();
  await expect(page.getByText("announcement.send", { exact: false })).toBeVisible();
  await expect(page.getByText("Pendiente", { exact: true })).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Administración", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Aplicar plantilla" })).toBeDisabled();
  await page.getByLabel("He revisado la estructura y confirmo su creación").check();
  await page.getByRole("button", { name: "Aplicar plantilla" }).click();
  await expect(page.getByRole("status")).toContainText("Acción en cola");
  await page.getByRole("navigation").getByRole("button", { name: "Música", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Título de la pista", exact: true })
    .fill("Audio de prueba");
  await page
    .getByRole("textbox", { name: "URL de audio HTTPS", exact: true })
    .fill("https://audio.example.com/song.mp3");
  await page.getByRole("textbox", { name: "Nombre de playlist", exact: true }).fill("NOXIS");
  await page.getByRole("button", { name: "Guardar pista en playlist" }).click();
  await expect(page.getByRole("status")).toContainText("Pista guardada");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Comunidad", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Tu comunidad" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "/tmp/noxis-dashboard-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("navigation").getByRole("button", { name: "Resumen", exact: true }).click();
  await page.screenshot({ path: "/tmp/noxis-dashboard-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Acceso restringido" })).toBeVisible();
  expect(errors).toEqual([]);
});
