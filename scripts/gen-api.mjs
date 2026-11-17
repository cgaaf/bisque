// Builds the docs' API reference from the components' source: docs/generated/api/<family>.json.
//
// For each `export component` of a family it records the element it renders, its own props (name, type, default
// and the comment above each in the `…Props` type), and the `data-*` attributes its props function writes.
// What the source can't say (what a data attribute means, CSS variables set from TypeScript) comes from
// docs/api-notes/<family>.json, which is merged over the generated record.
//
// The data attributes are followed through every function the part calls, exported or not (a call resolves to the
// file's own function first). A prop's default is the literal of a top-level equation of the component body that
// is nothing but `props.x ?? literal` (or `source s := peek(props.x ?? literal)`), else a destructuring default,
// else "Default: …" at the end of its comment. A component that only renders another of the library's, passing a
// prop on, gets that prop's missing default and description from it.
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

/** Every `export component` (or every `fn`, exported or not) in a file: name, signature and body. */
function declarations(text, keyword, file) {
  const found = new Map();
  const pattern =
    keyword === "fn" ? /^(export )?fn (\w+)\(/gm : new RegExp(`^(export )${keyword} (\\w+)\\(`, "gm");
  for (const match of text.matchAll(pattern)) {
    const rest = text.slice(match.index);
    // The parameter list ends at the `)` that closes the one opened after the name.
    let depth = 0;
    let close = 0;
    for (let i = match[0].length - 1; i < rest.length; i++) {
      if (rest[i] === "(") depth++;
      else if (rest[i] === ")" && --depth === 0) {
        close = i;
        break;
      }
    }
    // A block body ends at the first `}` in the first column; `fn f(…): T => expression` is one line.
    const lineEnd = rest.indexOf("\n", close);
    const tail = rest.slice(close + 1, lineEnd < 0 ? undefined : lineEnd);
    let end;
    if (tail.trimEnd().endsWith("{")) {
      const block = rest.search(/\n}\n/);
      end = block < 0 ? rest.length : block + 2;
    } else end = lineEnd < 0 ? rest.length : lineEnd;
    const whole = rest.slice(0, end);
    found.set(match[2], {
      name: match[2],
      file,
      exported: Boolean(match[1]),
      index: match.index,
      params: whole.slice(match[0].length, close),
      body: whole.slice(close + 1),
    });
  }
  return found;
}

// Functions by file (a call resolves to its own file's function first), and the exported ones by name.
const functionsByFile = new Map();
const exportedFunctions = new Map();
const allComponents = new Map();
const files = [...sources, ["internal", shared]];
for (const [file, text] of files) {
  const own = declarations(text, "fn", file);
  functionsByFile.set(file, own);
  for (const [name, fn] of own) if (fn.exported) exportedFunctions.set(name, fn);
  for (const [name, component] of declarations(text, "component", file)) allComponents.set(name, component);
}
const functionIn = (file, name) => functionsByFile.get(file)?.get(name) ?? exportedFunctions.get(name);

/** The `data-*` keys a body (in `file`) writes, following calls to the library's functions. */
function dataAttributes(body, file, seen = new Set()) {
  const names = new Set();
  for (const match of body.matchAll(/["\s](data-[a-z-]+)["=]/g)) {
    if (!match[1].startsWith("data-rs-ui") && match[1] !== "data-testid") names.add(match[1]);
  }
  for (const match of body.matchAll(/\b(\w+)\(/g)) {
    const fn = functionIn(file, match[1]);
    if (fn && !seen.has(fn)) {
      seen.add(fn);
      for (const name of dataAttributes(fn.body, fn.file, seen)) names.add(name);
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

const FALLBACK = /props\.(\w+) \?\? ("[^"]*"|-?\d[\d.]*|true|false)/g;

/** The text of a component body's top-level equations: the body without its actions, functions and effects. */
function equations(body) {
  const kept = [];
  let depth = 0;
  let skipping = false;
  for (const line of body.slice(body.indexOf("{") + 1).split("\n")) {
    if (depth === 0) skipping = /^\s*(action|fn|effect)\b/.test(line);
    if (!skipping) kept.push(line);
    for (const char of line) {
      if (char === "{") depth++;
      else if (char === "}") depth--;
    }
  }
  return kept.join("\n");
}

/** The names a component takes out of its props by destructuring, in its parameters or its body. */
function destructured(component) {
  const names = new Set();
  const patterns = [];
  if (component.params.trim().startsWith("{"))
    patterns.push(braced(component.params, component.params.indexOf("{")));
  for (const match of component.body.matchAll(/^\s*\{([^}]*)\} = props$/gm)) patterns.push(match[1]);
  for (const pattern of patterns) {
    for (const match of pattern.matchAll(/(?:^|,)\s*(\w+)/g)) names.add(match[1]);
  }
  return names;
}

/**
 * The library component this one only renders, and which of its props it passes on as they are: by name
 * (`x={x}`, `x={props.x}`), or through a spread when it doesn't take the prop out first.
 */
function wrappedBy(component) {
  const first = /^\s*<([A-Za-z][\w]*)[\s>/]/m.exec(component.body.replace(/<style>[\s\S]*?<\/style>/g, ""));
  const inner = first && allComponents.get(first[1]);
  if (!inner) return null;
  const open = component.body.indexOf(`<${first[1]}`);
  const tag = component.body.slice(open, component.body.indexOf(">", open));
  const spread = /\{\.\.\.\w+\}/.test(tag);
  const taken = destructured(component);
  const passes = (name) =>
    new RegExp(String.raw`\s${name}=\{(?:props\.)?${name}\}`).test(tag) ||
    (spread && !taken.has(name) && !new RegExp(String.raw`\s${name}=`).test(tag));
  return { inner, passes };
}

const notesByFamily = new Map();
function notesOf(family) {
  if (!notesByFamily.has(family)) {
    const file = join(notesDir, `${family}.json`);
    notesByFamily.set(family, existsSync(file) ? JSON.parse(read(file)) : {});
  }
  return notesByFamily.get(family);
}

const describedParts = new Map();
/** A component's record: element, description, props (children included) and data attributes. */
function describePart(component, seen = new Set()) {
  if (describedParts.has(component.name)) return describedParts.get(component.name);
  const text = component.file === "internal" ? shared : sources.get(component.file);
  const note = notesOf(component.file)[component.name] ?? {};
  // `({ a = 1, b, ...rest }: Type)` or `(props: Type)`.
  const isDestructured = component.params.trim().startsWith("{");
  const pattern = isDestructured ? braced(component.params, component.params.indexOf("{")) : "";
  const type = component.params
    .slice(isDestructured ? pattern.length + 2 + component.params.indexOf("{") : 0)
    .replace(/^[^:]*:/, "")
    .trim();

  const defaults = new Map();
  for (const match of pattern.matchAll(/(\w+)\s*=\s*([^,]+)/g)) defaults.set(match[1], match[2].trim());
  // Only from the equations: `props.x ?? 0` in an action is what one step falls back to, not the prop's default.
  for (const match of equations(component.body).matchAll(FALLBACK)) {
    if (!defaults.has(match[1])) defaults.set(match[1], match[2]);
  }

  seen.add(component.name);
  const wrapper = wrappedBy(component);
  const inner =
    wrapper && !seen.has(wrapper.inner.name)
      ? new Map(describePart(wrapper.inner, seen).props.map((prop) => [prop.name, prop]))
      : new Map();

  const props = propsOf(type).map((prop) => {
    const stated = /\s*Default: ([^.]+(?:\.\d+)?)\.?\s*$/.exec(prop.description);
    // "Default: false, so …": the value is what comes before the comma.
    const fallback = stated?.[1].split(", so ")[0].replace(/^`|`$/g, "");
    const own = prop.description.replace(/\s*Default: [^.]+(?:\.\d+)?\.?\s*$/, "").trim();
    const passed = wrapper?.passes(prop.name) ? inner.get(prop.name) : undefined;
    const noted = note.defaults && Object.hasOwn(note.defaults, prop.name);
    return {
      name: prop.name,
      type: prop.type,
      default: noted
        ? note.defaults[prop.name]
        : (defaults.get(prop.name) ?? fallback ?? passed?.default ?? null),
      required: !prop.optional,
      description: (note.props?.[prop.name] ?? (own || passed?.description || "")).trim(),
    };
  });

  const wrapped = /<([A-Z]\w+)\s[^>]*\{\.\.\./.exec(component.body);
  const attributes = dataAttributes(component.body, component.file);
  const wrappedComponent = wrapped && allComponents.get(wrapped[1]);
  if (wrappedComponent) {
    for (const name of dataAttributes(wrappedComponent.body, wrappedComponent.file)) attributes.add(name);
  }
  // A note adds an attribute the source doesn't show, or (with null) removes one the part never sets.
  for (const [name, meaning] of Object.entries(note.dataAttributes ?? {})) {
    if (meaning === null) attributes.delete(name);
    else attributes.add(name);
  }

  const own = /\bown = (\w+)\(/.exec(component.body);
  const fn = own && functionIn(component.file, own[1]);
  const description =
    note.description ??
    (commentAbove(text, component.index) ||
      (fn?.exported && fn.file === component.file ? commentAbove(text, fn.index) : ""));

  const part = {
    name: component.name,
    hidden: note.hidden === true,
    element: note.element ?? elementOf(component),
    description,
    props,
    dataAttributes: [...attributes].toSorted().map((name) => ({
      name,
      description: note.dataAttributes?.[name] ?? COMMON[name] ?? "",
    })),
    cssVariables: Object.entries(note.cssVariables ?? {}).map(([name, meaning]) => ({
      name,
      description: meaning,
    })),
  };
  describedParts.set(component.name, part);
  return part;
}

function describe(family) {
  const parts = [];
  for (const component of declarations(sources.get(family), "component", family).values()) {
    const part = describePart(component);
    if (part.hidden) continue;
    parts.push({
      name: part.name,
      element: part.element,
      description: part.description,
      props: part.props.filter((prop) => prop.name !== "children"),
      dataAttributes: part.dataAttributes,
      cssVariables: part.cssVariables,
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
