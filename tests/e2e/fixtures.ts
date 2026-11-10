import { test as base, chromium } from "@playwright/test";
export { expect } from "@playwright/test";
// A fresh browser per test also supports serverless Chromium's single-process mode.
export const test = base.extend({
  context: async ({ launchOptions, headless, baseURL, contextOptions }, use) => {
    const browser = await chromium.launch({ ...launchOptions, headless });
    const context = await browser.newContext({ ...contextOptions, baseURL });
    try {
      await use(context);
    } finally {
      await context.close().catch(() => undefined);
      await browser.close();
    }
  },
});
