// The docs site (docs/): `pnpm docs` serves it, `pnpm build:docs` builds it to dist/docs. Its build reaches
// every component family through the pages' demos, so it is also the check that the whole library bundles.
import { copyFileSync, existsSync, globSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import solid from "@solidjs/vite-plugin";

const root = resolve(import.meta.dirname, "docs");
const outDir = resolve(import.meta.dirname, "dist/docs");

/**
 * One entry serves every page, picked by the URL's path. A static host needs a file at each path, so the built
 * index.html is copied to `<page>/index.html` for every program under docs/pages, and to 404.html.
 */
function staticRoutes(): Plugin {
  return {
    name: "rs-ui-docs-routes",
    apply: "build",
    closeBundle() {
      const index = join(outDir, "index.html");
      // The build failed: its own error is the one to show.
      if (!existsSync(index)) return;
      for (const page of globSync("pages/**/*.rx", { cwd: root })) {
        const route = page.replace(/^pages\//, "").replace(/\.rx$/, "");
        if (route === "index" || route === "not-found") continue;
        const target = join(outDir, route, "index.html");
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(index, target);
      }
      copyFileSync(index, join(outDir, "404.html"));
    },
  };
}

/**
 * `import text from "./file.rx?text"`: a file's text as a string. Vite's own `?raw` can't be used for a demo's
 * source, because the ReactiveScript plugin compiles any `.rx` id whatever its query.
 */
function sourceText(): Plugin {
  const prefix = "\0rs-ui-text:";
  return {
    name: "rs-ui-docs-source-text",
    enforce: "pre",
    resolveId(source, importer) {
      if (!source.endsWith("?text") || !importer) return;
      // The suffix keeps other plugins from treating the module as the kind of file it quotes.
      return `${prefix}${resolve(dirname(importer), source.slice(0, -"?text".length))}.txt`;
    },
    load(id) {
      if (!id.startsWith(prefix)) return;
      const file = id.slice(prefix.length, -".txt".length);
      this.addWatchFile(file);
      return `export default ${JSON.stringify(readFileSync(file, "utf8"))};`;
    },
  };
}

export default defineConfig({
  root,
  base: process.env.DOCS_BASE ?? "/",
  plugins: [sourceText(), solid(), staticRoutes()],
  build: { outDir, emptyOutDir: true, target: "esnext" },
});
