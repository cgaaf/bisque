# rs-ui

Headless, unstyled, accessible components written in ReactiveScript (`.rx`), which compiles to Solid 2.0.
[Base UI](https://base-ui.com) is the feature goal: same parts, ARIA, keyboard behaviour and `data-*` state hooks.
ReactiveScript is 0.3 and experimental: when the compiler and a doc disagree, the compiler wins, and the docs to
trust are the ones installed with it.

## Where the language is documented

Read these before writing `.rx`; they ship with the installed compiler, so they match its version:

- `node_modules/@reactivescript/compiler/guide/language.md`: the whole language on one page. Start here.
- `…/guide/reference.md`: grammar and rules. `…/guide/libraries.md`: calling JS from `.rx` (`.d.rx`, `ref`).
- `…/guide/diagnostics.md`: every error code, why, and the fix. Look a code up here before guessing.
- `…/guide/async.md`: `await`, actions, guesses. Rarely needed in this library.

`.claude/skills/rs-ui-components` covers writing a component here, including the 0.3 behaviour those guides
don't mention. The `solid-2.0` skills (linked from `solid-js` by pnpm) cover the TypeScript in `src/internal/impl`.

## Things that will surprise you

- `.rx` can only import another `.rx` by relative path. There is no package resolution for it yet, so the library
  is distributed as source and `package.json` has no build step.
- Vite compiles an `.rx` program whole, from an entry, and reports only what that entry reaches. `pnpm typecheck:rx`
  is the only check that sees every `.rx` file.
- `src/internal/*.d.ts` are generated from the `.d.rx` beside them (`pnpm gen:dts`). Edit the `.d.rx`.
- A bundler problem can pass every test: Vitest tolerates an import of a name that doesn't exist. `pnpm build:demo`
  is the check that catches it.
- Solid's dev warnings in test output (`[STRICT_READ_UNTRACKED]` and the like) are bugs in `src/internal/impl`,
  not noise.

## Commands

`pnpm check` runs everything (format, lint, both type checks, tests, demo build). While working on one component:

```bash
pnpm rx-check src/menu/fixtures/basic.rx   # compile one program; add `--emit menu.rx` to see the JavaScript
pnpm vitest run src/menu                   # that component's tests
```

Toolchain: oxlint, oxfmt, `tsrs` for `.ts`. `.rx` is type-checked by `rx-tsc`, which is built on TypeScript's own
compiler and can't run on tsrs; oxlint and oxfmt don't read `.rx`.
