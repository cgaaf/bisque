#!/usr/bin/env node
// Writes the `.d.ts` beside every `.d.rx` under src/ and docs/.
//
// A `.d.rx` tells the ReactiveScript compiler how .rx may call a JS module. TypeScript (rx-tsc, the editor) needs
// the same module's types as .rx sees them: a `ref` parameter takes a plain value, a `ref` result is read without
// a call. rx-tsc does not derive that from the `.d.rx`, so this does: one `.d.ts` per `.d.rx`, never edited by hand.
//
// Nothing else compares a `.d.rx` with the TypeScript it describes, so where the module is a facade over
// TypeScript (`export * from "./impl/x.ts"`) this also writes `x.conform.ts`: types only, in which each declared
// function must be assignable from its implementation, a `ref` being Solid’s `Accessor`. `pnpm typecheck:ts`
// then fails on a declaration that names something the implementation lacks, passes a value where it takes an
// accessor (or the reverse), or promises a result it doesn’t return. `pure` and `instantiates` stay unchecked.
//   node scripts/gen-dts.mjs           write them
//   node scripts/gen-dts.mjs --check   fail if one is missing or out of date
import { globSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const check = process.argv.includes("--check");
const stripRef = (text) => text.replace(/\bref\s+/g, "");

// Where the type starting at `from` ends: the next comma or closing bracket of the list it is written in.
function typeEnd(text, from) {
  let depth = 0;
  for (let i = from; i < text.length; i += 1) {
    const char = text[i];
    if (char === ">" && text[i - 1] === "=") continue;
    if ("([{<".includes(char)) depth += 1;
    else if (")]}>".includes(char)) {
      if (depth === 0) return i;
      depth -= 1;
    } else if (char === "," && depth === 0) return i;
  }
  return text.length;
}

// `ref name: T` becomes `name: Accessor<T>`, and `ref T` in a result becomes `Accessor<T>`.
function refToAccessor(text) {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ref = /^ref\s+/.exec(text.slice(i));
    if (!ref || /[\w$.]/.test(text[i - 1] ?? "")) {
      out += text[i];
      i += 1;
      continue;
    }
    i += ref[0].length;
    const name = /^\w+\??:\s*/.exec(text.slice(i));
    if (name) {
      out += name[0];
      i += name[0].length;
    }
    const end = typeEnd(text, i);
    out += `Accessor<${refToAccessor(text.slice(i, end))}>`;
    i = end;
  }
  return out;
}

const DECLARATION = /^export (?:pure )?fn (\w+)\((.*)\)(?::\s*(.+?))?(?:\s+instantiates)?$/;

// The check of a facade’s implementation against its `.d.rx`, or undefined when the module isn’t such a facade.
function conformance(source, file) {
  const facade = file.replace(/\.d\.rx$/, ".js");
  if (!existsSync(facade)) return undefined;
  const code = readFileSync(facade, "utf8")
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith("//"));
  const modules = code.map((line) => /^export \* from "(\.[^"]+\.ts)";$/.exec(line)?.[1]);
  if (modules.length === 0 || modules.includes(undefined)) return undefined;
  const types = [];
  const checks = [];
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("export type ")) types.push(`${line};`);
    const fn = DECLARATION.exec(line);
    if (!fn) continue;
    const [, name, params, result] = fn;
    const declared = `(${refToAccessor(params)}) => ${result ? refToAccessor(result) : "void"}`;
    checks.push(`  Conforms<Implementation["${name}"], ${declared}>,`);
  }
  const body = [...types, "export type Checked = [", ...checks, "];"].join("\n");
  return [
    `// Generated from ${file.split("/").pop()} by scripts/gen-dts.mjs. Do not edit.`,
    "// An error here means the declaration and the implementation disagree: fix whichever is wrong.",
    ...(body.includes("Accessor<") ? [`import type { Accessor } from "solid-js";`, ""] : []),
    `type Implementation = ${modules.map((path) => `typeof import("${path}")`).join(" & ")};`,
    "type Conforms<Actual extends Declared, Declared> = Actual;",
    body,
    "",
  ].join("\n");
}

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
    const fn = DECLARATION.exec(line);
    if (!fn) throw new Error(`${file}: can't convert "${line}" (one declaration per line)`);
    const [, name, params, result] = fn;
    out.push(`export declare function ${name}(${stripRef(params)}): ${result ? stripRef(result) : "void"};`);
  }
  return out.join("\n") + "\n";
}

let stale = 0;
function emit(target, text) {
  if (text === undefined) return;
  if (existsSync(target) && readFileSync(target, "utf8") === text) return;
  if (check) {
    console.error(`${target} is out of date: run \`pnpm gen:dts\``);
    stale += 1;
  } else {
    writeFileSync(target, text);
    console.log(`wrote ${target}`);
  }
}

for (const file of globSync("{src,docs}/**/*.d.rx")) {
  const source = readFileSync(file, "utf8");
  emit(file.replace(/\.d\.rx$/, ".d.ts"), convert(source, file));
  emit(file.replace(/\.d\.rx$/, ".conform.ts"), conformance(source, file));
}
process.exit(stale ? 1 : 0);
