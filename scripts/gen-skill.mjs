// Builds the reference files of the agent skill the package ships: skills/bisque-ui/references/.
//
// pnpm links a dependency's `skills/<name>/` into an app's agent skill directories once the app approves it
// (https://pnpm.io/agent-skills). SKILL.md is written by hand; what it points to is generated here, so the skill
// can't drift from the components:
//   references/components.md   every family, one line each, from its docs page's subtitle
//   references/<family>.md     anatomy, then each part's element, props, data attributes and CSS variables,
//                              from docs/generated/api/<family>.json (pnpm gen:api) and docs/demos/<family>/anatomy.rx.txt
// It also checks SKILL.md's frontmatter against the Agent Skills specification (https://agentskills.io/specification).
//
//   node scripts/gen-skill.mjs           write the files
//   node scripts/gen-skill.mjs --check   fail if a file is out of date or SKILL.md's frontmatter is invalid
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const skillName = "bisque-ui";
const skillDir = join(root, "skills", skillName);
const out = join(skillDir, "references");
const apiDir = join(root, "docs/generated/api");
const check = process.argv.includes("--check");
const problems = [];

// SKILL.md frontmatter: `name` matches the directory, 1-64 of a-z, 0-9 and single inner hyphens; `description`
// 1-1024 characters.
const skill = readFileSync(join(skillDir, "SKILL.md"), "utf8");
const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(skill)?.[1] ?? "";
const field = (key) => new RegExp(`^${key}:\\s*(.*)$`, "m").exec(frontmatter)?.[1]?.trim() ?? "";
const name = field("name");
const description = field("description").replace(/^"(.*)"$/, "$1");
if (name !== skillName) problems.push(`SKILL.md: name is "${name}", must be "${skillName}" (its directory)`);
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) || name.length > 64)
  problems.push(`SKILL.md: invalid name "${name}"`);
if (description.length < 1 || description.length > 1024)
  problems.push(`SKILL.md: description must be 1-1024 characters, is ${description.length}`);
if (skill.split("\n").length > 500)
  problems.push("SKILL.md: keep it under 500 lines; move detail to references/");

const families = readdirSync(apiDir)
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.slice(0, -".json".length))
  .toSorted();

const cell = (text) => (text ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
const code = (text) => (text ? `\`${cell(text)}\`` : "");

function subtitle(family) {
  const page = join(root, "docs/pages/components", `${family}.rx`);
  if (!existsSync(page)) return { title: family, subtitle: "" };
  const source = readFileSync(page, "utf8");
  return {
    title: /title="([^"]*)"/.exec(source)?.[1] ?? family,
    subtitle: /subtitle="([^"]*)"/.exec(source)?.[1] ?? "",
  };
}

function familyPage(family) {
  const api = JSON.parse(readFileSync(join(apiDir, `${family}.json`), "utf8"));
  const { title, subtitle: summary } = subtitle(family);
  const anatomyFile = join(root, "docs/demos", family, "anatomy.rx.txt");
  const lines = [`# ${title}`, "", summary, ""];
  lines.push(
    `Source after \`bisque-ui copy\`: \`<copy>/${family}/${family}.rx\`. Parts are named exports of that file.`,
    "",
  );
  if (existsSync(anatomyFile)) {
    lines.push("## Anatomy", "", "```rx", readFileSync(anatomyFile, "utf8").trimEnd(), "```", "");
  }
  for (const part of api.parts) {
    lines.push(`## ${part.name}`, "");
    const element = part.element ? `Renders \`<${part.element}>\`. ` : "Renders no element of its own. ";
    lines.push(`${element}${part.description ?? ""}`.trim(), "");
    if (part.props.length > 0) {
      lines.push("| Prop | Type | Default | Description |", "| --- | --- | --- | --- |");
      for (const prop of part.props) {
        const label = prop.required ? `${code(prop.name)} (required)` : code(prop.name);
        lines.push(`| ${label} | ${code(prop.type)} | ${code(prop.default)} | ${cell(prop.description)} |`);
      }
      lines.push("");
    }
    if (part.dataAttributes.length > 0) {
      lines.push("| Data attribute | Meaning |", "| --- | --- |");
      for (const attribute of part.dataAttributes)
        lines.push(`| ${code(attribute.name)} | ${cell(attribute.description)} |`);
      lines.push("");
    }
    if (part.cssVariables.length > 0) {
      lines.push("| CSS variable | Meaning |", "| --- | --- |");
      for (const variable of part.cssVariables)
        lines.push(`| ${code(variable.name)} | ${cell(variable.description)} |`);
      lines.push("");
    }
  }
  return (
    lines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd() + "\n"
  );
}

function index() {
  const lines = [
    "# Components",
    "",
    "Each family is one file, `<copy>/<family>/<family>.rx`. Read the family's own reference before using it.",
    "",
    "| Family | What it is | Reference |",
    "| --- | --- | --- |",
  ];
  for (const family of families) {
    const { title, subtitle: summary } = subtitle(family);
    lines.push(`| ${title} | ${cell(summary)} | [${family}.md](${family}.md) |`);
  }
  return lines.join("\n") + "\n";
}

const files = new Map([["components.md", index()]]);
for (const family of families) files.set(`${family}.md`, familyPage(family));

if (check) {
  for (const [file, content] of files) {
    const path = join(out, file);
    if (!existsSync(path) || readFileSync(path, "utf8") !== content)
      problems.push(`skills/${skillName}/references/${file} is out of date: run pnpm gen:api`);
  }
  if (existsSync(out))
    for (const file of readdirSync(out))
      if (!files.has(file))
        problems.push(`skills/${skillName}/references/${file} is stale: run pnpm gen:api`);
} else {
  if (existsSync(out)) rmSync(out, { recursive: true });
  mkdirSync(out, { recursive: true });
  for (const [file, content] of files) writeFileSync(join(out, file), content);
  console.log(`Wrote ${files.size} files to skills/${skillName}/references.`);
}

if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}
