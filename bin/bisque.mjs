#!/usr/bin/env node
// Copies the component source into an app.
//
// ReactiveScript 0.3 resolves an `.rx` import only by relative path, so an app can't import components from
// node_modules. Until it can, the components live in the app's own tree:
//   npx bisque-ui copy [directory]     default: src/bisque
// Run it again after upgrading the package to refresh the copy. Tests and fixtures are left out.
import { cpSync, existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [command, target = "src/bisque"] = process.argv.slice(2);
if (command !== "copy") {
  console.log("usage: bisque copy [directory]   (default: src/bisque)");
  process.exit(command ? 1 : 0);
}

const source = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const destination = path.resolve(target);
const skipped = (file) =>
  file.endsWith(".test.ts") ||
  /[\\/]fixtures([\\/]|$)/.test(file) ||
  /[\\/]test([\\/]|$)/.test(file) ||
  file.endsWith("rx.d.ts");

if (existsSync(destination)) {
  // Only replace a folder this command wrote: one that holds the library's `internal` folder.
  if (readdirSync(destination).length > 0 && !existsSync(path.join(destination, "internal"))) {
    console.error(`${target} exists and doesn't look like a copy of Bisque. Choose another directory.`);
    process.exit(1);
  }
  rmSync(destination, { recursive: true });
}
cpSync(source, destination, { recursive: true, filter: (file) => !skipped(file) });

const families = readdirSync(destination).filter((name) => name !== "internal");
console.log(`Copied ${families.length} component families to ${target}.`);
console.log(`Import them by relative path, e.g. import { DialogRoot } from "./bisque/dialog/dialog.rx"`);
console.log(`The app needs "exclude": ["**/*.d.rx"] in the tsconfig rx-tsc reads.`);
