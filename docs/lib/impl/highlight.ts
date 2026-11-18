// Syntax highlighting for the two languages the docs show: ReactiveScript, with its own TextMate grammar
// (rx.tmLanguage.json, vendored from the VS Code extension), and CSS, run by Shiki. The build does this
// (vite.docs.config.ts, `?highlighted`), so a page is sent a file's HTML and not Shiki and its grammars. A page
// must not import this module: site.ts loads it on demand for the one caller that highlights text at run time.
import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import type { LanguageRegistration, ThemeRegistration } from "shiki/core";
import tsx from "shiki/langs/tsx.mjs";
import css from "shiki/langs/css.mjs";
import rxGrammar from "./rx.tmLanguage.json" with { type: "json" };

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The scopes each `tok-…` class in site.css colours. A more specific scope wins over a shorter one. */
const KINDS: Record<string, string[]> = {
  comment: ["comment", "punctuation.definition.comment"],
  string: ["string", "punctuation.definition.string"],
  keyword: [
    "keyword",
    "storage",
    "keyword.operator.assignment.write.rx",
    "constant.language.import-export-all",
  ],
  operator: ["keyword.operator", "keyword.operator.expression", "keyword.operator.new"],
  tag: ["entity.name.tag", "support.class.component", "entity.other.attribute-name.class.css"],
  attr: ["entity.other.attribute-name", "support.type.property-name", "variable.css"],
  number: ["constant.numeric", "constant.language", "keyword.other.unit", "constant.other.color"],
  function: ["entity.name.function", "support.function"],
  type: ["entity.name.type", "support.type", "entity.other.inherited-class"],
};

// Each kind's colour is a marker that `highlight` turns back into a class, so the colours stay in site.css and
// follow the theme toggle.
const theme: ThemeRegistration = {
  name: "bisque-docs",
  type: "light",
  fg: "",
  bg: "",
  settings: Object.entries(KINDS).map(([kind, scope]) => ({
    scope,
    settings: { foreground: `var(--tok-${kind})` },
  })),
};

/** The vendored grammar is a TextMate grammar; JSON's inferred type is too loose to say so. */
function isGrammar(value: unknown): value is LanguageRegistration {
  return typeof value === "object" && value !== null && "scopeName" in value && "patterns" in value;
}
const rx: unknown = { ...rxGrammar, name: "rx", embeddedLangs: ["tsx", "css"] };
if (!isGrammar(rx)) throw new Error("rx.tmLanguage.json is not a TextMate grammar");

const highlighter = createHighlighterCoreSync({
  engine: createJavaScriptRegexEngine(),
  themes: [theme],
  langs: [tsx, css, rx],
});

/** `code` as HTML: escaped, with a `<span class="tok-…">` around each token the grammar names. */
export function highlight(code: string, lang: string): string {
  if (lang !== "rx" && lang !== "css") return escape(code);
  const { tokens } = highlighter.codeToTokens(code, { lang, theme: "bisque-docs" });
  return tokens
    .map((line) =>
      line
        .map(({ content, color }) => {
          const kind = color?.match(/^var\(--tok-(\w+)\)$/)?.[1];
          return kind ? `<span class="tok-${kind}">${escape(content)}</span>` : escape(content);
        })
        .join(""),
    )
    .join("\n");
}
