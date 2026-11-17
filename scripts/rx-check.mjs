#!/usr/bin/env node
// Checks one `.rx` program from its entry, without types: the fastest answer to "does this compile?".
//   node scripts/rx-check.mjs src/collapsible/fixtures/basic.rx [--emit <module-suffix>]
// `--emit collapsible.rx` also prints the JavaScript that module compiled to.
import { createRequire } from "node:module";
import path from "node:path";

const { app } = createRequire(import.meta.url)("@reactivescript/compiler");
const [entryArg, flag, suffix] = process.argv.slice(2);
if (!entryArg) {
  console.error("usage: rx-check <entry.rx> [--emit <module-suffix>]");
  process.exit(2);
}
const entry = path.resolve(entryArg);
const out = JSON.parse(app(entry, "dom", "@solidjs/web", true));
if (out.diagnostics) {
  for (const d of out.diagnostics) {
    const line = d.range ? d.range.start.line : d.line;
    console.log(`${path.relative(process.cwd(), d.file)}:${line}: error ${d.code} [${d.rule}] ${d.msg}`);
  }
  process.exit(1);
}
if (out.error) {
  console.log(out.error);
  process.exit(1);
}
console.log(
  `ok: ${Object.keys(out.modules)
    .map((p) => path.relative(process.cwd(), p))
    .join(", ")}`,
);
if (flag === "--emit" && suffix) {
  for (const [file, mod] of Object.entries(out.modules)) if (file.endsWith(suffix)) console.log(mod.code);
}
