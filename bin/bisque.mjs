#!/usr/bin/env node
// Copies the component source into an app.
//
// ReactiveScript 0.3 resolves an `.rx` import only by relative path, so an app can't import components from
// node_modules. Until it can, the components live in the app's own tree:
//   pnpm exec bisque copy [directory]     default: src/bisque
// Run it again after upgrading the package to refresh the copy. Tests and fixtures are left out.
//
// The directory is replaced only when every file in it is one this package ships or one the last copy wrote
// (listed in .bisque-copy.json), so a copy is refreshed but a folder holding anything else (the app's own source,
// a file added to the copy) is never deleted.
import { createRequire } from "node:module";
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [command, target = "src/bisque"] = process.argv.slice(2);
if (command !== "copy") {
  console.log("usage: bisque copy [directory]   (default: src/bisque)");
  process.exit(command ? 1 : 0);
}

const source = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const destination = path.resolve(target);
// Table is built on @tanstack/table-core, the one package a family needs beyond ReactiveScript and Solid. It
// is copied only into an app that has the package: its TypeScript imports the package's types, so a copy
// without it would fail the app's type check whether or not the app used a table.
const hasTableCore = (() => {
  try {
    createRequire(path.join(process.cwd(), "package.json")).resolve("@tanstack/table-core");
    return true;
  } catch {
    return false;
  }
})();
const isTable = (file) =>
  /[\\/]src[\\/]table([\\/]|$)/.test(file) || /[\\/]internal[\\/](impl[\\/])?table\.[a-z.]+$/.test(file);
const skipped = (file) =>
  file.endsWith(".test.ts") ||
  /[\\/]fixtures([\\/]|$)/.test(file) ||
  /[\\/]test([\\/]|$)/.test(file) ||
  file.endsWith("rx.d.ts") ||
  (!hasTableCore && isTable(file));

// What the last copy wrote, relative to the copy with `/` separators.
const MANIFEST = ".bisque-copy.json";
function readManifest() {
  try {
    const list = JSON.parse(readFileSync(path.join(destination, MANIFEST), "utf8"));
    return Array.isArray(list) ? list.filter((file) => typeof file === "string") : [];
  } catch {
    return [];
  }
}

function refuse(reason) {
  console.error(`${target}: ${reason} Choose another directory, or remove it yourself.`);
  process.exit(1);
}

// The working directory or a folder above it is never a copy, whatever it holds.
const relative = path.relative(destination, process.cwd());
if (relative === "" || !relative.startsWith("..")) refuse("contains the current directory.");

if (existsSync(destination)) {
  if (!statSync(destination).isDirectory()) refuse("exists and isn't a directory.");
  // Every file in it must be one this version ships or one the last copy wrote (its manifest, so files an
  // upgrade removed don't block the refresh), ignoring what the OS leaves in folders.
  const junk = new Set([".DS_Store", "Thumbs.db", "desktop.ini", MANIFEST]);
  const written = new Set(readManifest());
  const foreign = readdirSync(destination, { recursive: true, withFileTypes: true })
    .filter((entry) => !entry.isDirectory() && !junk.has(entry.name))
    .map((entry) =>
      path.relative(destination, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"),
    )
    .filter((file) => !written.has(file))
    .filter((file) => skipped(path.join(source, file)) || !existsSync(path.join(source, file)));
  if (foreign.length > 0) {
    const listed = foreign.slice(0, 3).join(", ") + (foreign.length > 3 ? ", …" : "");
    refuse(`holds things Bisque doesn't ship (${listed}), so it isn't a copy to replace.`);
  }
  rmSync(destination, { recursive: true });
}
cpSync(source, destination, { recursive: true, filter: (file) => !skipped(file) });
const files = readdirSync(destination, { recursive: true, withFileTypes: true })
  .filter((entry) => !entry.isDirectory())
  .map((entry) =>
    path.relative(destination, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"),
  )
  .toSorted();
writeFileSync(path.join(destination, MANIFEST), JSON.stringify(files, null, 1) + "\n");

const families = readdirSync(destination, { withFileTypes: true }).filter(
  (entry) => entry.isDirectory() && entry.name !== "internal",
);
console.log(`Copied ${families.length} component families to ${target}.`);
if (!hasTableCore) {
  console.log("Table was left out: it needs @tanstack/table-core. Install it and copy again to add Table.");
}
console.log(`Import them by relative path, e.g. import { DialogRoot } from "./bisque/dialog/dialog.rx"`);
console.log(`The app needs "exclude": ["**/*.d.rx"] in the tsconfig rx-tsc reads.`);
