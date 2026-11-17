// Tests that need a real browser: `*.browser.test.ts`, run in Chromium, Firefox and WebKit through Playwright.
// The components are built on native features (popover, <dialog>, CSS anchor positioning) that jsdom lacks, and
// the library's baseline is what all three engines ship, so all three are tested.
import solid from "@solidjs/vite-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [solid()],
  test: {
    include: ["src/**/*.browser.test.ts"],
    setupFiles: ["src/test/browser-setup.ts"],
    // See vite.config.ts: an `.rx` entry can't be cached by its own content.
    fsModuleCache: false,
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      screenshotFailures: false,
      instances: [{ browser: "chromium" }, { browser: "firefox" }, { browser: "webkit" }],
    },
  },
});
