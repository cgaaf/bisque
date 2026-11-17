// Builds the docs' API reference from the components' source: docs/generated/api/<family>.json.
//
// For each `export component` of a family it records the element it renders, its own props (name, type, default
// and the comment above each in the `…Props` type), and the `data-*` attributes its props function writes.
// What the source can't say (what a data attribute means, CSS variables set from TypeScript) comes from
// docs/api-notes/<family>.json, which is merged over the generated record.
//
//   node scripts/gen-api.mjs            write the files
//   node scripts/gen-api.mjs popover    write one family's (several names may be given)
//   node scripts/gen-api.mjs --check    fail if a file is out of date
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const src = join(root, "src");
const out = join(root, "docs/generated/api");
const notesDir = join(root, "docs/api-notes");
const check = process.argv.includes("--check");

const SKIP = new Set(["internal", "test", "platform"]);
const families = readdirSync(src, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isDirectory() && !SKIP.has(entry.name) && existsSync(join(src, entry.name, `${entry.name}.rx`)),
  )
  .map((entry) => entry.name)
  .toSorted();

/** What a data attribute means when the family's notes don't say. */
const COMMON = {
  "data-disabled": "Present when the part is disabled.",
  "data-popup-open": "Present on the trigger while its popup is open.",
  "data-side":
    "Which side of its anchor the popup is on: the one asked for, then the one the browser placed it on.",
  "data-highlighted": "Present on the item that has the highlight.",
  "data-checked": "Present when checked.",
  "data-unchecked": "Present when not checked.",
  "data-indeterminate": "Present when the state is indeterminate.",
  "data-selected": "Present when selected.",
  "data-pressed": "Present when pressed.",
  "data-orientation": "The orientation: `horizontal` or `vertical`.",
  "data-required": "Present when the field is required.",
  "data-readonly": "Present when the field is read-only.",
  "data-invalid": "Present when the field is invalid.",
  "data-valid": "Present when the field is valid.",
  "data-touched": "Present once the field has been focused and left.",
  "data-dirty": "Present once the field's value has changed.",
  "data-filled": "Present when the field has a value.",
  "data-focused": "Present while the field has focus.",
  "data-ending-style": "Present while the part animates out.",
  "data-starting-style": "Present while the part animates in.",
  "data-placeholder": "Present when no value is selected.",
  "data-swiping": "Present while the part is being dragged.",
  "data-swipe-direction": "The direction it can be swiped away in.",
  "data-expanded": "Present while expanded.",
  "data-index": "The part's index among its siblings.",
  "data-activation-direction": "The direction of the newly active item relative to the previous one.",
};

const read = (file) => readFileSync(file, "utf8");
const sources = new Map(families.map((family) => [family, read(join(src, family, `${family}.rx`))]));
const shared = ["popover.rx"].map((name) => read(join(src, "internal", name))).join("\n");

/** The text between the brace at `open` and its match. */
function braced(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return text.slice(open + 1, i);
  }
  return text.slice(open + 1);
}

/** The `//` comment lines directly above the line that starts at `index`, as one paragraph. */
function commentAbove(text, index) {
  const lines = text.slice(0, index).split("\n");
  lines.pop();
  const comment = [];
  while (lines.length && lines[lines.length - 1].trim().startsWith("//")) {
    comment.unshift(
      lines
        .pop()
        .trim()
        .replace(/^\/\/\s?/, ""),
    );
  }
  return comment.join(" ").trim();
}

/** Every `export type Name = …` in the library, by name: the text after the `=`, up to the next top-level line. */
const typeAliases = new Map();
for (const text of [...sources.values(), shared]) {
  for (const match of text.matchAll(/^export type (\w+) = /gm)) {
    const start = match.index + match[0].length;
    const rest = text.slice(start);
    const end = rest.search(/\n(?=\S)/);
    typeAliases.set(match[1], rest.slice(0, end < 0 ? undefined : end).trim());
  }
}

/** Splits `A & B & { … }` at the top level. */
function operands(type) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < type.length; i++) {
    const char = type[i];
    if ("{(<[".includes(char)) depth++;
    else if ("})>]".includes(char) && !(char === ">" && type[i - 1] === "=")) depth--;
    if (char === "&" && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** The members of an object type's body: `{ name, optional, type, description }`. */
function members(body) {
  const found = [];
  let comment = [];
  let pending = "";
  let depth = 0;
  const flush = () => {
    const text = pending.trim().replace(/[;,]$/, "");
    pending = "";
    const member = /^(\w+)(\?)?:\s*([\s\S]+)$/.exec(text);
    if (member) {
      found.push({
        name: member[1],
        optional: Boolean(member[2]),
        type: member[3].replace(/\s+/g, " "),
        description: comment.join(" ").trim(),
      });
    }
    comment = [];
  };
  // Members are separated by a newline or a `;` outside any bracket.
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (depth === 0 && trimmed.startsWith("//")) {
      comment.push(trimmed.replace(/^\/\/\s?/, ""));
      continue;
    }
    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];
      const arrow = char === ">" && trimmed[i - 1] === "=";
      if ("{(<[".includes(char)) depth++;
      else if ("})>]".includes(char) && !arrow) depth--;
      if (char === ";" && depth === 0) flush();
      else pending += char;
    }
    if (depth === 0) flush();
    else pending += " ";
  }
  if (pending.trim()) flush();
  return found;
}

/** A props type's own members: object-literal operands, and named `…Props` aliases defined in the library. */
function propsOf(type, seen = new Set()) {
  const props = [];
  for (const operand of operands(type)) {
    if (operand.startsWith("{")) props.push(...members(braced(operand, 0)));
    else {
      const omit = /^Omit<(\w+),/.exec(operand);
      const name = omit ? omit[1] : operand;
      if (typeAliases.has(name) && !seen.has(name)) {
        seen.add(name);
        props.push(...propsOf(typeAliases.get(name), seen));
      }
    }
  }
  return props;
}

/** Every `export component` / `export fn` in a file: name, signature and body. */
function declarations(text, keyword) {
  const found = new Map();
  const pattern = new RegExp(`^export ${keyword} (\\w+)\\(`, "gm");
  for (const match of text.matchAll(pattern)) {
    const rest = text.slice(match.index);
    const end = rest.search(/\n}\n/);
    const whole = rest.slice(0, end < 0 ? undefined : end + 2);
    // The parameter list ends at the `)` that closes the one opened after the name.
    let depth = 0;
    let close = 0;
    for (let i = match[0].length - 1; i < whole.length; i++) {
      if (whole[i] === "(") depth++;
      else if (whole[i] === ")" && --depth === 0) {
        close = i;
        break;
      }
    }
    found.set(match[1], {
      name: match[1],
      index: match.index,
      params: whole.slice(match[0].length, close),
      body: whole.slice(close + 1),
    });
  }
  return found;
}

const allFunctions = new Map();
const allComponents = new Map();
for (const text of [...sources.values(), shared]) {
  for (const [name, fn] of declarations(text, "fn")) allFunctions.set(name, fn);
  for (const [name, component] of declarations(text, "component")) allComponents.set(name, component);
}

/** The `data-*` keys a body writes, following calls to the library's props functions. */
function dataAttributes(body, seen = new Set()) {
  const names = new Set();
  for (const match of body.matchAll(/["\s](data-[a-z-]+)["=]/g)) {
    if (!match[1].startsWith("data-rs-ui") && match[1] !== "data-testid") names.add(match[1]);
  }
  for (const match of body.matchAll(/\b(\w+)\(/g)) {
    const fn = allFunctions.get(match[1]);
    if (fn && !seen.has(fn.name)) {
      seen.add(fn.name);
      for (const name of dataAttributes(fn.body, seen)) names.add(name);
    }
  }
  return names;
}

/** The element a component renders: the tag it spreads its props on, or that of the component it wraps. */
function elementOf(component, seen = new Set()) {
  const tag = /<([a-z][a-z0-9]*)\s[^>]*\{\.\.\./.exec(component.body);
  if (tag) return tag[1];
  const wrapped = /<([A-Z]\w+)\s[^>]*\{\.\.\./.exec(component.body);
  const inner = wrapped && allComponents.get(wrapped[1]);
  if (inner && !seen.has(inner.name)) {
    seen.add(inner.name);
    return elementOf(inner, seen);
  }
  return null;
}

function describe(family) {
  const text = sources.get(family);
  const notesFile = join(notesDir, `${family}.json`);
  const notes = existsSync(notesFile) ? JSON.parse(read(notesFile)) : {};
  const parts = [];

  for (const component of declarations(text, "component").values()) {
    const note = notes[component.name] ?? {};
    // `({ a = 1, b, ...rest }: Type)` or `(props: Type)`.
    const destructured = component.params.trim().startsWith("{");
    const pattern = destructured ? braced(component.params, component.params.indexOf("{")) : "";
    const type = component.params
      .slice(destructured ? pattern.length + 2 + component.params.indexOf("{") : 0)
      .replace(/^[^:]*:/, "")
      .trim();

    const defaults = new Map();
    for (const match of pattern.matchAll(/(\w+)\s*=\s*([^,]+)/g)) defaults.set(match[1], match[2].trim());
    for (const match of component.body.matchAll(/props\.(\w+) \?\? ("[^"]*"|-?\d[\d.]*|true|false)/g)) {
      if (!defaults.has(match[1])) defaults.set(match[1], match[2]);
    }

    const props = propsOf(type).map((prop) => {
      const stated = /\s*Default: ([^.]+(?:\.\d+)?)\.?\s*$/.exec(prop.description);
      const fallback = stated?.[1].replace(/^`|`$/g, "");
      return {
        name: prop.name,
        type: prop.type,
        default: defaults.get(prop.name) ?? fallback ?? null,
        required: !prop.optional,
        description: (
          note.props?.[prop.name] ?? prop.description.replace(/\s*Default: [^.]+(?:\.\d+)?\.?\s*$/, "")
        ).trim(),
      };
    });

    const wrapped = /<([A-Z]\w+)\s[^>]*\{\.\.\./.exec(component.body);
    const attributes = dataAttributes(component.body);
    if (wrapped && allComponents.has(wrapped[1])) {
      for (const name of dataAttributes(allComponents.get(wrapped[1]).body)) attributes.add(name);
    }
    // A note adds an attribute the source doesn't show, or (with null) removes one the part never sets.
    for (const [name, meaning] of Object.entries(note.dataAttributes ?? {})) {
      if (meaning === null) attributes.delete(name);
      else attributes.add(name);
    }

    const own = /\bown = (\w+)\(/.exec(component.body);
    const fn = own && allFunctions.get(own[1]);
    const description =
      note.description ??
      (commentAbove(text, component.index) ||
        (fn && sources.get(family).includes(`export fn ${fn.name}(`) ? commentAbove(text, fn.index) : ""));

    parts.push({
      name: component.name,
      element: note.element ?? elementOf(component),
      description,
      props: props.filter((prop) => prop.name !== "children"),
      dataAttributes: [...attributes].toSorted().map((name) => ({
        name,
        description: note.dataAttributes?.[name] ?? COMMON[name] ?? "",
      })),
      cssVariables: Object.entries(note.cssVariables ?? {}).map(([name, meaning]) => ({
        name,
        description: meaning,
      })),
    });
  }
  return { family, parts };
}

mkdirSync(out, { recursive: true });
const only = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
let stale = 0;
for (const family of only.length ? only : families) {
  const file = join(out, `${family}.json`);
  const next = `${JSON.stringify(describe(family), null, 2)}\n`;
  if (existsSync(file) && read(file) === next) continue;
  if (check) {
    console.error(`${file.slice(root.length)} is out of date: run pnpm gen:api`);
    stale++;
  } else {
    writeFileSync(file, next);
    console.log(`wrote ${file.slice(root.length)}`);
  }
}
if (stale) process.exit(1);
