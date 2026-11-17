import solid from "@solidjs/vite-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Without `ssr: true` the plugin compiles for the browser only, which ReactiveScript checks as a client-only
  // ("spa") program. Nothing here is server rendered yet.
  plugins: [solid()],
  // Vitest runs in Node: without this it would load the server builds of Solid and the ReactiveScript runtime.
  resolve: process.env.VITEST ? { conditions: ["browser", "development"] } : undefined,
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/test/setup.ts"],
    // An `.rx` entry is compiled together with every `.rx` module it imports, but Vitest caches it by its own
    // content. With the cache on, editing only a dependency fails with "imported as an .rx dependency, but no
    // program built so far contains it".
    fsModuleCache: false,
  },
});
