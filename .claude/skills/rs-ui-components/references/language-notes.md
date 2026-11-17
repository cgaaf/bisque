# ReactiveScript 0.3.1, as observed in this repo

What was learned by running the compiler, with the symptom each one produces. Versions: `@reactivescript/*`
0.3.1, `solid-js` 2.0.0-rc.22, `@solidjs/vite-plugin` 3.0.0-next.57. Re-test an entry here before relying on it
after an upgrade, and delete the ones the compiler has since fixed.

## Syntax the parser refuses

| You wrote                          | You get                                                | Write instead                                  |
| ---------------------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| `x as HTMLElement`                 | `PARSE expected ')' near 'as …'`                       | Type the parameter or declaration              |
| `export type P<E> = …`             | `PARSE expected '{' near '<E …'`                       | A non-generic alias per use, in `types.rx`     |
| `render={(p) => <a {...p} />}`     | `PARSE expression near '<a …'`                         | Markup exists only in a view: a props function |
| `render={Link}`                    | `COMPONENT_AS_VALUE`                                   | The same                                       |
| A bare call, `createFocusScope(…)` | `PARSE expected a declaration or markup`               | Bind it: `_scope = createFocusScope(…)`        |
| `import { X } from "pkg/file.rx"`  | `MODULE_NOT_FOUND`; without `.rx`, `UNKNOWN_COMPONENT` | A relative path                                |

Accepted, and useful: `import("./impl/types.ts").T` as a type, intersection types, object spread in
an expression, a component with several root nodes, `portal { … }`, `effect () { …; return () => { … } }` for
mount and cleanup, an action calling another action, and method calls on DOM objects in imperative code
(`event.preventDefault()`).

## Checks that pass and then fail at run time

- **Children destructured before `provide`**: `RG-7b: no provision for <context>` when the child mounts. The
  destructuring is hoisted as an eager memo of `props.children`, above the `provide`.
- **A type imported from a JS or TS module**: passes the compiler, `rx-tsc` and Vitest; `vite build` fails with
  `MISSING_EXPORT`. The compiler elides a type import only from an `.rx` module, declared in a `.d.rx` or not.

## The type projection

- `rx-tsc` checks an imported `.ts` module against its real signature, so a `ref` parameter looks like it wants
  an accessor and every call is a type error. That is why `.rx` imports a `.js` facade with a generated `.d.ts`.
- A `.d.rx` in the TypeScript program crashes `rx-tsc` (`languageId not found`): `tsconfig.json` excludes them.
- A `.ts` file that imports an `.rx` entry sees no default export under `rx-tsc`. Tests are checked by `tsrs`
  instead, through the ambient declaration in `src/rx.d.ts`.
- A props function returns `PartProps` (loosely typed) on purpose: a precisely typed `ref` or handler for one
  element won't spread onto another.

## Tooling

- Vitest's `fsModuleCache` must stay off (`vite.config.ts`). It caches an `.rx` entry by its own content, but
  the entry's output depends on every module it imports: edit only a dependency and the run fails with
  "imported as an .rx dependency, but no program built so far contains it".
- `scripts/rx-check.mjs` calls the compiler directly and answers in milliseconds, with no types.
- The Vite plugin's `next` dist-tag has pointed at an older build than `3.0.0-next.57`, the first with `.rx`
  support. The version is pinned.

## Not yet tried here

Server rendering and hydration (upstream calls SSR in Vite "not yet"), `for … in` over a keyed collection
inside a part, scoped `<style>`, and anything async. Treat the guide as a claim to test, not a fact.
