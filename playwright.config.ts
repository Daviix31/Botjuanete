import { defineConfig } from "@playwright/test";
import chromium from "@sparticuz/chromium";
const custom = process.env.CHROMIUM_EXECUTABLE_PATH;
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
    launchOptions: custom
      ? {
          executablePath: custom,
          args: chromium.args.filter(
            (a) =>
              !a.includes("disable-web-security") && !a.includes("allow-running-insecure-content"),
          ),
        }
      : {},
    screenshot: "only-on-failure",
  },
});
