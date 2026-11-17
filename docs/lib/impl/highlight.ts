// A small syntax highlighter for the two languages the docs show: ReactiveScript (close enough to TSX) and CSS.
// It marks comments, strings, keywords, tags, attributes and numbers; nothing here parses.

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type Rule = [kind: string, pattern: RegExp];

const RX: Rule[] = [
  ["comment", /\/\/[^\n]*|\/\*[\s\S]*?\*\//y],
  ["string", /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/y],
  ["tag", /<\/?[A-Za-z][\w.]*|\/?>/y],
  [
    "keyword",
    /\b(?:import|from|export|default|component|source|action|effect|fn|context|provide|use|type|if|else|for|in|return|let|const|peek|pure|await|true|false|undefined|null)\b/y,
  ],
  ["attr", /[A-Za-z_][\w-]*(?==)/y],
  ["number", /\b\d[\d.]*\b/y],
  ["operator", /:=/y],
];

const CSS: Rule[] = [
  ["comment", /\/\*[\s\S]*?\*\//y],
  ["string", /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/y],
  ["keyword", /@[\w-]+/y],
  ["attr", /--[\w-]+|[a-z-]+(?=\s*:[^:\n{]*[;\n}])/y],
  ["tag", /[.#&][\w-]+|::?[\w-]+(?:\([^)]*\))?|\[[^\]]*\]/y],
  ["number", /-?\b\d[\d.]*(?:px|rem|em|ms|s|%|deg|fr|vh|vw|dvh)?\b/y],
];

/** `code` as HTML: escaped, with a `<span class="tok-…">` around each token it recognises. */
export function highlight(code: string, lang: string): string {
  const rules = lang === "css" ? CSS : lang === "rx" ? RX : [];
  let html = "";
  let plain = "";
  let index = 0;
  scan: while (index < code.length) {
    for (const [kind, pattern] of rules) {
      pattern.lastIndex = index;
      const match = pattern.exec(code);
      if (match && match[0].length > 0) {
        html += `${escape(plain)}<span class="tok-${kind}">${escape(match[0])}</span>`;
        plain = "";
        index += match[0].length;
        continue scan;
      }
    }
    // An identifier is consumed whole, so a keyword inside one (`information`) isn't marked.
    const word = /[A-Za-z_$][\w$-]*/y;
    word.lastIndex = index;
    const skipped = word.exec(code)?.[0] ?? code[index];
    plain += skipped;
    index += skipped.length;
  }
  return html + escape(plain);
}

/** A sentence from the source as HTML: escaped, with `backticked` words as inline code. */
export function prose(text: string): string {
  return escape(text).replace(/`([^`]+)`/g, "<code>$1</code>");
}
