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

More that isn't there, found while building components:

- **No re-exports.** `export { X as Y } from "./a.rx"` is a `PARSE` error. A family that reuses another's part
  wraps it in a thin component that renders `{children}` (see `src/alert-dialog`).
- **No `Math`, `Number`, `Intl` or `typeof`** in `.rx` (`UNBOUND`, or `PARSE` for `typeof`). Arithmetic helpers
  and formatting go in a JS module (`src/internal/range-format.js`). `Intl.*` works as a type.
- **`children` is never `undefined`**, even on a self-closing component, so it can't tell you whether children
  were passed.
- **`==` is strict**: it compiles to `===`.
- **A `fn` with a `ref` parameter must be bound before it is another `fn`'s result**: `item = itemState(c)` then
  `item` on the last line. Returning the call directly, or passing it straight to another call
  (`withoutHandlers(fieldControlProps(f), true)`), is `INSTANTIATION_NOT_BOUND`.

- **No `Object` global and no computed keys** (`{ [k]: v }` is `PARSE`): build such objects in TypeScript.
- **A function-type parameter on a `fn` needs parentheses**: `fn f(x: (() => void))`. Unparenthesised it is
  `PARSE expected ')'`. Usually the better answer is to put the action in the context.
- **A ternary can't break before `?`** (`PARSE expression near '? …'`). Keep it on one line.
- **A context and a function can't share a name** (`DUPLICATE_DECLARATION`, then `NOT_A_CONTEXT`). A part that
  needs its own context beside its props function names the context differently (`tabsListOptions`).
- **DOM constructors aren't values**: `x instanceof Node` is `UNBOUND`. Type the event instead
  (`FocusEvent & { relatedTarget: Node | null }`).
- **Quoted keys can't be destructured** (`{ "aria-label": label } = props` is `PARSE`), and `from` can't be a
  local name. Read `props["aria-label"]`.
- **A type and a component can't share a name**: the component becomes "unknown component". Rename the type.

Accepted, and useful: a context with a default (`export context x: T = { … }`): `use x` with no provider above
returns it, which is how an optional parent (a Field around a control, a TooltipProvider) is read. The default
is emitted before the module's actions, so it may call a `fn` but not reference an `action`. Also: `import("./impl/types.ts").T` as a type, intersection types, object spread in
an expression, a component with several root nodes, `portal { … }`, `effect () { …; return () => { … } }` for
mount and cleanup, an action calling another action, and method calls on DOM objects in imperative code
(`event.preventDefault()`).

## Checks that pass and then fail at run time

- **Children destructured before `provide`**: `RG-7b: no provision for <context>` when the child mounts. The
  destructuring is hoisted as an eager memo of `props.children`, above the `provide`.
- **A type imported from a JS or TS module**: passes the compiler, `rx-tsc` and Vitest; `vite build` fails with
  `MISSING_EXPORT`. The compiler elides a type import only from an `.rx` module, declared in a `.d.rx` or not.

## Behaviour that surprises

- **A list source aliases the array that seeded it.** The runtime wraps the seed in a store and a root write
  replaces its contents in place, so two sources seeded from one prop array change together and the consumer's
  array is mutated. Seed with a copy: `source items := peek([...props.defaultValue])`.
- **An action returns a promise.** Its return value isn't available synchronously, and a write isn't readable
  in the same run, so a decision that must be made synchronously from fresh state (whether to
  `preventDefault()` a submit after validating) belongs in TypeScript. See `src/internal/impl/field.ts`.
- **`effect (x)` compares its inputs by content**: writing equal content into an object source doesn't re-run
  it.
- **`ref={c.someAction}` inside `{if …}` markup** reads the context untracked (`STRICT_READ_UNTRACKED`). Wrap
  it in a local action.

- **`for … in` keeps rows by object identity.** Only a keyed _equation_ (`rows key id = …`) keeps a row when
  its object is replaced; a keyed `source` does not, in either form. Hold the data in a plain source and loop
  over a keyed equation of it (`src/toast/toast.rx`).
- **Module state is one value per app**, and plain TypeScript can't import an `.rx` module's named exports, so
  state that outside code must reach is a JS object passed in (the toast manager), not a module source.
- **A write before an `await` in an action is hidden until the action ends.** `onFlush(() => { … })` shows it
  early.
- **An action called from an effect's cleanup can throw** `ACTION_CALLED_IN_OWNED_SCOPE` when the cleanup runs
  because a `for` row was removed.
- **A destructured prop can shadow a context**: `{ toast, ...rest } = props` beside `provide toast` is
  `NOT_A_CONTEXT`. Rename it in the pattern (`{ toast: _toast, … }`).
- **One fixture can't import from another**: put a shared component in a library module.

## The type projection

- `rx-tsc` narrows a source inside an `if`, and with it the type of a write there: `if (!flag) { flag := true }`
  is TS2345. Test through a local (`let unset = !flag`). Relatedly, `source b := false` is typed `false`:
  annotate it `: boolean`.

- `rx-tsc` checks an imported `.ts` module against its real signature, so a `ref` parameter looks like it wants
  an accessor and every call is a type error. That is why `.rx` imports a `.js` facade with a generated `.d.ts`.
- Solid's `ToggleEvent`, `HTMLDialogElement` and the other DOM types are available in `.rx` annotations.
- A `.d.rx` in the TypeScript program crashes `rx-tsc` (`languageId not found`): `tsconfig.json` excludes them.
- A `.ts` file that imports an `.rx` entry sees no default export under `rx-tsc`. Tests are checked by `tsrs`
  instead, through the ambient declaration in `src/rx.d.ts`.
- A props function returns `PartProps` (loosely typed) on purpose: a precisely typed `ref` or handler for one
  element won't spread onto another.

## Tooling

- Vitest's `fsModuleCache` must stay off (`vite.config.ts`). It caches an `.rx` entry by its own content, but
  the entry's output depends on every module it imports: edit only a dependency and the run fails with
  "imported as an .rx dependency, but no program built so far contains it".
- The Vite dev server can serve stale output after an imported `.rx` changes, for the same reason. Restart it
  with `--force`.
- A component's `<style>` is scoped to that component's own elements, and a rule that matches none of them is
  dropped. To style a library part from a demo, write `:global(.popup[data-open])`.
- `scripts/rx-check.mjs` calls the compiler directly and answers in milliseconds, with no types.
- The Vite plugin's `next` dist-tag has pointed at an older build than `3.0.0-next.57`, the first with `.rx`
  support. The version is pinned.

## Testing notes

- Only awaited `user` events flush. After `element.dispatchEvent(…)` or `fireEvent`, call `flush()` (exported by
  `src/test/mount.ts`) before asserting.
- jsdom normalises a transform: `translate3d(0, 5px, 0)` reads back as `translate3d(0px, 5px, 0px)`.

- Delays: fake only the timers, `vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })` (add `"Date"` for code that measures elapsed
  time), so
  `requestAnimationFrame` stays real and presence can still unmount. Give user-event
  `advanceTimers: (ms) => vi.advanceTimersByTime(ms)`, and call `flush()` after advancing.
- `vitest run src/toggle` also runs `src/toggle-group`: the path is a prefix match.
- `console.log` in a test isn't shown. Assert on the value instead.
- A button outside a popup can't close it in a test: its pointerdown dismisses the popup, then its click reopens
  it. Close from the trigger or with Escape.

## Testing in the three engines

- The test viewport is 414px wide. A popup near the right edge gets flipped, so keep fixtures narrow.
- `user.hover(element)` waits for the element to stay visible, and hangs on a popup that closes as the pointer
  arrives. Move to coordinates instead: `user.hover(container, { position })`. The pointer stays where the last
  test left it, so start a hover test by moving it somewhere neutral.
- `:focus-visible` after a scripted `focus()` depends on how focus last moved. `user.keyboard("{Tab}")` then
  `element.focus()` works in all three; a modifier key doesn't count in Firefox or WebKit.
- Fake timers with real pointer input misfire in WebKit. Use real timers with a margin.
- WebKit can round a geometry difference to `-0`, which `toBe(0)` rejects. Compare `Math.abs(…)`.
- `preventDefault()` on an Escape keydown stops an enclosing `popover="auto"` from closing on it, and on a
  click it cancels the `popovertarget` toggle, in all three engines.
- A popup can't be written inside a `<p>`: the compiler refuses it (`CONTENT_MODEL`), as the HTML parser would
  close the paragraph.

## Not yet tried here

Server rendering and hydration (upstream calls SSR in Vite "not yet"), `for … in` over a keyed collection
inside a part, and anything async. Treat the guide as a claim to test, not a fact.
