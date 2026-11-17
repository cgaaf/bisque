# Writing a docs page

The docs site is `docs/`: a Vite app (`pnpm docs`, `pnpm build:docs`) whose pages are ReactiveScript programs.
`docs/pages/components/popover.rx` with `docs/demos/popover/` and `docs/api-notes/popover.json` is the page to
copy. Base UI's docs are the model for structure, not for wording: its source is in
`/Users/cgaaf/dev/personal/solid-bedrock/.reference/base-ui/docs/src/app/(docs)/react/components/<name>/page.mdx`
(read-only).

## How the site is put together

- `docs/main.ts` picks the page from the URL's path: `/components/popover/` loads
  `docs/pages/components/popover.rx`. Each page is its own program, loaded on demand. The navigation is a list
  in `docs/lib/impl/site.ts`.
- `docs/shell.rx` has what a page is made of:
  - `<DocsPage title subtitle>` wraps the page. Its children are the article's content.
  - `<Demo source="popover/hero"><PopoverHero /></Demo>` shows a live demo above its source files,
    `docs/demos/popover/hero.rx` and `hero.css`. Both files must exist.
  - `<Code file="popover/anatomy.rx.txt" />` shows a snippet that isn't run. The `.txt` keeps it out of the type
    check; the name before it picks the highlighting (`.rx.txt`, `.css.txt`).
  - `<ApiReference family="popover" />` renders the generated API record.
- Page typography applies to the article's direct children only: `h2`, `h3`, `p`, `ul`, `ol`, and
  `<div class="note">` for an aside. Give every `h2` and `h3` an `id`; the "On this page" list is built from them.
  Write a space between an inline element and the next line's text as `{" "}`.

## A component page

In this order, as Base UI's pages are:

1. **Title and one-sentence subtitle**, then the **hero demo**: the component as someone would ship it.
2. **Anatomy** (`h2#anatomy`): the import line and the parts nested as they are used, in a `.rx.txt` snippet.
   Imports are written as an app would, `from "./rs-ui/popover/popover.rx"`.
3. **What the browser does** (`h2#platform`): which native feature the family stands on, what the browser
   provides, what the library adds, and which Base UI parts don't exist here and why. This section is the
   library's point; get it from the family's source comments and `platform.md`, and state only what the source
   or a test shows. Leave out anything a report listed as not verified (accessibility-tree claims especially).
4. **Examples** (`h2#examples`): one `h3` per use that needs explaining, each with prose and usually a demo.
   Cover what the family's props make possible (controlled state, disabled, orientation, multiple…), how to
   animate it, and anything that surprises (a constraint the platform imposes).
5. **API reference** (`h2#api-reference`): `<ApiReference family="…" />`.

## Demos

- One component per file, exported by name: `docs/demos/<family>/<name>.rx` exports `<Family><Name>`
  (`PopoverHero`). It imports the library by relative path, `../../../src/<family>/<family>.rx`.
- The demo's root element has a class equal to the component's name, and `<name>.css` nests every rule under
  it, so demos can't style each other:

  ```css
  .PopoverHero {
    .Popup { … }
    .Popup:popover-open { … }
  }
  ```

  Parts get plain class names (`Trigger`, `Popup`, `Item`). A scoped `<style>` in the view can't be used: its
  rules don't reach the element a part renders (only `:global(…)` would), and the reader should see the CSS.

- The CSS is half the documentation of an unstyled, native-first library. Use the native hooks (`[open]`,
  `:popover-open`, `:checked`, `::backdrop`, `@starting-style`, `[data-side]`…) and comment the non-obvious
  line. Colours use `light-dark(…)` so a demo works in both themes; the palette in `popover/hero.css` is the
  house one. A popover or dialog comes with the browser's border, padding and `overflow`: reset what you change.
- Keep demos small and real: neutral, made-up content, no real people's names.
- A demo must look finished. Look at it (below) in light and dark.

## The API reference

`pnpm gen:api` writes `docs/generated/api/<family>.json` from the source: each part's element, its own props
with types and defaults, and the `data-*` attributes its props function writes. `node scripts/gen-api.mjs
<family>` writes one family. Never edit the generated file.

What the source doesn't say goes in `docs/api-notes/<family>.json`, keyed by part name:

```json
{
  "PopoverRoot": {
    "description": "One or two sentences on what the part is for.",
    "props": { "open": "What the prop does." },
    "dataAttributes": { "data-side": "When it is present and what its values are." },
    "cssVariables": { "--popup-width": "What it holds." },
    "element": "div"
  }
}
```

A data attribute set to `null` in the notes is left out: use it where the generator follows a shared props
function to an attribute the part then clears.

Every part needs a description, and every prop and data attribute a meaning, written for someone using the
library (the source comments are written for someone maintaining it). If a prop's comment in the source is
missing or wrong, fix the comment in `src/` too when it is a one-line change; otherwise put the text in the
notes. CSS variables a part sets from TypeScript are only known to the notes: search the family's source and
`src/internal/impl` for `--`.

## Checking a page

```bash
pnpm rx-check docs/pages/components/popover.rx     # compiles the page and everything it reaches
node scripts/shoot-docs.mjs components/popover --out <scratch>/popover.png   # needs the dev server
```

`shoot-docs` loads the page in headless Chromium, prints anything the console reported (a Solid diagnostic is a
bug to fix or report, not noise) and saves a screenshot to read. `--click`, `--hover`, `--press`, `--at`,
`--dark`, `--mobile` and `--full` are described at the top of the script. The dev server is
`pnpm exec vite --config vite.docs.config.ts --port <port> --strictPort`; pass the same `--port` to the script.

The dev server doesn't pick up an `.rx` file created after it started: the page then fails with "expected a
component function but got undefined". Restart the server after adding a demo or a page.
