#!/usr/bin/env node
// Writes the `.d.ts` beside every `.d.rx` under src/ and docs/.
//
// A `.d.rx` tells the ReactiveScript compiler how .rx may call a JS module. TypeScript (rx-tsc, the editor) needs
// the same module's types as .rx sees them: a `ref` parameter takes a plain value, a `ref` result is read without
// a call. rx-tsc does not derive that from the `.d.rx`, so this does: one `.d.ts` per `.d.rx`, never edited by hand.
//   node scripts/gen-dts.mjs           write them
//   node scripts/gen-dts.mjs --check   fail if one is missing or out of date
import { globSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const check = process.argv.includes("--check");
const stripRef = (text) => text.replace(/\bref\s+/g, "");

function convert(source, file) {
  const out = [`// Generated from ${file.split("/").pop()} by scripts/gen-dts.mjs. Do not edit.`];
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("//")) continue;
    const type = /^export (type .+)$/.exec(line);
    if (type) {
      out.push(`export ${type[1]};`);
      continue;
    }
    const fn = /^export (?:pure )?fn (\w+)\((.*)\)(?::\s*(.+?))?(?:\s+instantiates)?$/.exec(line);
    if (!fn) throw new Error(`${file}: can't convert "${line}" (one declaration per line)`);
    const [, name, params, result] = fn;
    out.push(`export declare function ${name}(${stripRef(params)}): ${result ? stripRef(result) : "void"};`);
  }
  return out.join("\n") + "\n";
}

let stale = 0;
for (const file of globSync("{src,docs}/**/*.d.rx")) {
  const target = file.replace(/\.d\.rx$/, ".d.ts");
  const text = convert(readFileSync(file, "utf8"), file);
  if (existsSync(target) && readFileSync(target, "utf8") === text) continue;
  if (check) {
    console.error(`${target} is out of date: run \`pnpm gen:dts\``);
    stale += 1;
  } else {
    writeFileSync(target, text);
    console.log(`wrote ${target}`);
  }
}
process.exit(stale ? 1 : 0);
