// The docs site (docs/): `pnpm docs` serves it, `pnpm build:docs` builds it to dist/docs. Its build reaches
// every component family through the pages' demos, so it is also the check that the whole library bundles.
import { copyFileSync, existsSync, globSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import solid from "@solidjs/vite-plugin";
import { highlight } from "./docs/lib/impl/highlight.ts";

const root = resolve(import.meta.dirname, "docs");
const outDir = resolve(import.meta.dirname, "dist/docs");

/**
 * One entry serves every page, picked by the URL's path. A static host needs a file at each path, so the built
 * index.html is copied to `<page>/index.html` for every program under docs/pages, and to 404.html.
 */
function staticRoutes(): Plugin {
  return {
    name: "bisque-docs-routes",
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
 * `import html from "./file.rx?highlighted"`: a file highlighted as HTML, here and not in the browser, so a page
 * is sent neither Shiki nor its grammars. A `.txt` snippet is highlighted as the language its name ends with
 * before that (`anatomy.rx.txt`).
 */
function highlightedSource(): Plugin {
  const prefix = "\0bisque-highlighted:";
  const query = "?highlighted";
  return {
    name: "bisque-docs-highlighted-source",
    enforce: "pre",
    resolveId(source, importer) {
      if (!source.endsWith(query) || !importer) return;
      // The suffix keeps other plugins from treating the module as the kind of file it quotes: the ReactiveScript
      // plugin compiles any `.rx` id whatever its query.
      return `${prefix}${resolve(dirname(importer), source.slice(0, -query.length))}.txt`;
    },
    load(id) {
      if (!id.startsWith(prefix)) return;
      const file = id.slice(prefix.length, -".txt".length);
      this.addWatchFile(file);
      const name = file.replace(/\.txt$/, "");
      const lang = name.endsWith(".css") ? "css" : name.endsWith(".rx") ? "rx" : "text";
      const html = highlight(readFileSync(file, "utf8").trimEnd(), lang);
      // Rolldown gives a `.txt` id the "text" module type and would quote this module a second time, so the page
      // showed `export default "…"`. Saying it is JavaScript keeps the suffix's job without that.
      return { code: `export default ${JSON.stringify(html)};`, moduleType: "js" };
    },
  };
}

export default defineConfig({
  root,
  base: process.env.DOCS_BASE ?? "/",
  plugins: [highlightedSource(), solid(), staticRoutes()],
  build: { outDir, emptyOutDir: true, target: "esnext" },
});
