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
- **An object with methods of its own can't go through a store.** A keyed equation (`rows key id = …`) and a
  `source` both wrap what they hold; a TanStack Table row read back from one fails in its own methods
  (`this[memoKey] is not a function`). Loop over ids and look the object up in the row (`src/table/table.rx`).
- **A source that holds an array or object is one store proxy for its whole life**, changed in place. A library
  that compares references never sees it change: read it with `deep` and pass a copy (`plain` in
  `src/internal/impl/table.ts`).
- **No optional call**: `row.getIsSelected?.()` is `PARSE member near '()'`. Make the call in TypeScript.
- **A `//` comment inside an element, before a child element, was rendered as text** (a docs demo). Put it
  above the view.
- **Module state is one value per app**, and plain TypeScript can't import an `.rx` module's named exports, so
  state that outside code must reach is a JS object passed in (the toast manager), not a module source.
- **A write before an `await` in an action is hidden until the action ends.** `onFlush(() => { … })` shows it
  early.
- **An action called from an effect's cleanup can throw** `ACTION_CALLED_IN_OWNED_SCOPE` when the cleanup runs
  because a `for` row was removed.
- **A destructured prop can shadow a context**: `{ toast, ...rest } = props` beside `provide toast` is
  `NOT_A_CONTEXT`. Rename it in the pattern (`{ toast: _toast, … }`).
- **One fixture can't import from another**: put a shared component in a library module.

## Actions, holds and components

An action (anything that writes and awaits) is one change: what its run writes before the `await` is held until it
ends. That is right for an app's own state and wrong for a component's interactive state. The rule for a
component is not "no `await` in a handler" (a form written only in `.rx` that awaits its handler prop, shows
`busy`, takes typing during the request and writes the returned error afterwards works). It is: **nothing the
handler's run writes before the `await` may be state that must stay live, and that includes writes made by
actions it calls.** `HELD_WRITE` doesn't see a called action's writes. What was observed:

- **An equation over a held value and a component's own state freezes that state.** Every equation is one memo,
  so a write to a source waits for a change in flight whenever some equation reads that source beside something
  the change holds (spec rule H-3), even an equation nothing reads. In a part, the held value is usually a prop:
  the app wrote a source in an action and is waiting (`step := 2; await save()`), or wrote what a loading
  question reads (`q := text` with `answer = await ask(q)` and no `loading on`), and passes the part something
  computed from it. The part's own writes then wait for the app's server. Three places make such an equation:
  - a provision, `provide menu = { open: open, disabled: props.disabled }`, and any `self = { … }` like it;
  - a props object, `own = { "data-open": c.open ? "" : undefined, "data-disabled": c.disabled ? "" : undefined }`,
    in a component or a props function. This is why one context per value, or functions in the provision
    (`{ open: () => open }`), don't help here: the part that builds one object from both joins them again;
  - `merged = mergeProps(own, rest)`, which reads every field, so the state in `own` waits on **any** attribute
    the consumer passed (`class={saving ? "dim" : ""}`).

  Attributes written one by one on an element, and two spreads (`{...own} {...rest}`), don't join. A prop
  computed from the held write that comes out equal (`disabled={step == 3}`, false before and after) holds
  nothing. An app that writes with `guess` is not affected.

- **`latest e` reads past the hold**, wherever it is written: at the prop (`isDisabled = latest props.disabled ?? false`),
  around a provision, or around the merge (`merged = latest mergeProps(own, rest)`). The part's state is then
  live, at three costs. The part shows the prop's new value before the app's own screen does. A provision that
  reads `latest`, directly or through an equation, is `lane`, and an **exported** context must say so
  (`export context accordion: lane AccordionContext`, else `ROW_NARROWER_THAN_INFERRED`); readers of a `lane`
  context do not wait. And the part stops counting as a reader that holds the app's change: where the part was
  the only plain reader of a re-asked answer, the app's write (`q`) now shows at once while the part keeps the
  previous answer. With a prop that is the answer to a request, `latest` keeps the previous answer while a new
  one is out, lets a first load reach the `loading` fallback, and lets a failure reach `errored`.
- **A plain equation below a `latest` one runs twice** each time an action writes a source it also reads: once
  for the change in flight and once for the screen, the second time with equal content. Counted in a probe
  (`provide menu = { n: n, d: d }` with `d = latest props.disabled ?? false`: 9 runs for 4 clicks, 5 without
  `latest`; a write made in an inline handler, or to a source the equation doesn't read, adds none). Wrapping
  that equation's whole right-hand side in `latest` brings it back to one run, and then the same is true of the
  equations below it, through a context too. In the families this shows as `UNSTABLE_MEMO_OUTPUT` after four
  actions in a row (Select, Combobox, Menu, Menubar, Navigation Menu, Tabs, Toast, Scroll Area, Popover, Drawer),
  as text typed into a Field's input being overwritten (`UNCOMMITTED_INPUT_OVERWRITTEN`), and as failing
  optimistic saves in Number Field and Slider. So `latest` is applied where a family's tests stay green, which
  is every merge but Dialog's and most props that reach no provision; the rest are `test.fails` cases in the
  families' `held` tests. A family with no test that acts four times in a row proves little about this.
- **`latest x` on a store row copies the row on every run**, so its memo never settles (`t = latest props.toast`).
  And `latest mergeProps(own, rest)` on an input whose `own` carries the controlled `value` shows the value
  ahead of the keystroke: write `mergeProps(own, latest rest)` there (Input, FieldControl).
- **A write made in `onFlush` is its own change, unless it has company.** A `busy` flag set in `onFlush` before
  the `await` and cleared after it shows as set for the whole wait. It waits only if the same callback also
  writes a source the action wrote before its `await` (the callback is one instant and joins the hold), or if
  an equation reads the flag beside a held source (the first entry).
- **`affects x` with `pending? x` is the language's busy flag.** A context whose provision reads `pending?` is
  `lane`; it needs the declaration only when it is exported. Its readers do not wait: the `pending?` field shows
  at once and the other fields keep updating.
- **An action started inside a handler's run takes that run's writes with it.** Calling the consumer's
  `onFormSubmit` (an action) directly from the submit handler froze the fields. Call it in its own instant,
  `onFlush(() => { props.onX(v) })`, or make the component's own write in `onFlush`.
- **An awaiting handler must catch its failures**: the compiler refuses one that doesn't
  (`UNCAUGHT_ACTION_FAILURE`). Calling an action returns a promise of what its body returns, so JavaScript can
  wait for it.

- **Calling a consumer's callback prop inside a handler's run puts the callback's writes in that instant.** If
  the callback writes something a loading question reads (`query := text` with `results = await search(query)`),
  the component's own writes are held with it: a combobox's filter, highlight and open state froze until the
  answer came. Call every consumer callback in its own instant: `onFlush(() => { props.onOpenChange(next) })`.
- **A component source written inside that `onFlush` change joins its hold**, and so does the next handler's
  write to it. Clear such a source from `onSettled(() => …)` registered inside the `onFlush` callback.
- **Only a plain read holds a change; a `pending? x` probe does not.**
- **`pending? x` at a component's root on a value with no first answer defers the whole mount**
  (`ASYNC_OUTSIDE_LOADING_BOUNDARY`, at run time only). `x = await f() -> v` gives a first value; `pending? x`
  is then false during the first load, so "not answered yet" is `x == null` with `-> null`.
- **A failing value read through a prop with no `errored` region above halts the whole reactive system**
  (`REACTIVITY_HALTED`); the compiler doesn't warn. A component guards the props an app is likely to compute
  from a request: `isLoading = (props.loading ?? false) catch (e) => false`.
- **No actions in an effect's cleanup.** When a new answer removes `for` rows, the cleanup runs in an owned scope
  and the action throws (`ACTION_CALLED_IN_OWNED_SCOPE`) into the app's `errored` boundary. Keep such
  registries in TypeScript (`createLabels`), or read the DOM (`createItemObserver`).
- **A spread's `value` is re-applied whenever the props object recomputes**, with whatever is bound then, which
  can write old text over a keystroke (`UNCOMMITTED_INPUT_OVERWRITTEN`). Drive an input's value from a
  primitive that writes only on change (`createInputValue`).
- **A `for` over a new answer keeps a row's element only when the new row is equal in content.**
- Several `setX([...untrack(x), item])` calls from TypeScript in one flush lose all but the last: use the
  updater form.
- `loading` is a keyword and can't name an equation. `${error}` on a caught error renders `{}`: read
  `error.message` in TypeScript. An inline arrow's parameter can't be type-annotated: use a named action.

`createSubmission` (`src/internal/impl/field.ts`) does a submit's waiting in TypeScript with plain signals: it
starts the consumer's handler in a microtask, sets `pending`, and writes the result when the promise settles. The
language does not require that (the rule at the top of this section is enough), and it can stay. The consumer's
handler may be an action; its hold is its own. Test the real cases with a fixture whose server takes time: a
second request while one is out, input that changes while one is out, a request that fails, and the part's own
state while an app action that feeds one of its props is waiting (`src/accordion/fixtures/held.rx`).

Solid's attribution engine finds a further class of bug (`EFFECT_RELAY_TEAR`, `STRICT_READ_UNTRACKED`,
`SILENT_HOLD`). The docs dev server loads it; Vitest doesn't, so those show on a docs page and not in a test.
`node scripts/shoot-docs.mjs` prints them.

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
- Playwright waits for a disabled control to become enabled, so a click on one times out: assert `:disabled`.
  It won't click an `aria-disabled` element without `{ force: true }`, and an open popup intercepts clicks on
  whatever it covers: press an uncovered point. `position` on `document.body` is relative to the body's box.
- A Solid diagnostic fails the test it happened in (`src/test/browser-setup.ts`); the browser's console doesn't
  reliably reach the terminal.
- A listener for a non-delegated event (`toggle`) inside a props object is removed and re-added whenever the
  object recomputes, and one added during a dispatch misses that event. Attach such a listener once, in a
  TypeScript primitive.
- WebKit leaves focus on a popover that has just been hidden if a button press opened it. The part moves focus.
- WebKit's native radio group doesn't wrap at its ends with the arrow keys; Chromium and Firefox do.
- An author `display` rule that matches a closed popover (`.menu > * { display: block }`) overrides the
  browser's `display: none` and renders it in place. Exclude `[popover]` in fixture styles.
- A `<style>` inside a component's root element is refused (`STYLE_PLACEMENT`): put it at the top of the view.
- Solid delegates `onKeyDown` to the document, so a native listener on a container (roving focus) runs before
  an item's handler.
- WebKit's Tab skips links as well as buttons: use an `<input>` where a test needs a Tab stop.
- `user.hover` moves the pointer in one step. Code that watches the pointer's path (a safe area) sees only the
  end point, so hover twice.
- Two popovers shown by script with no user gesture both close on one Escape, in all three engines. Open them
  with real input in tests.
- Firefox delivers `toggle` late (not there after two frames): poll for its effect.
- Real `dragAndDrop` in Firefox makes test files running beside it fail, and its drags flake. Drags are real in
  Chromium and WebKit and dispatched in Firefox (`mouseDrag` in the drawer and toast tests). A drop point must
  be on the target element and inside the viewport; a failed drag leaves the button down for the next test.
- Fake timers advance during `user.*` calls (about 50ms for a hover). Install them before the interaction that
  starts the timer and assert with a tolerance.
- Testing Library gives a `<summary>` no `button` role: query it by text.
- Firefox throws from `setPointerCapture` for a dispatched pointer id; primitives catch it.
- A popup can't be written inside a `<p>`: the compiler refuses it (`CONTENT_MODEL`), as the HTML parser would
  close the paragraph.

## Not yet tried here

Server rendering and hydration (upstream calls SSR in Vite "not yet"), `for … in` over a keyed collection
inside a part, and anything async. Treat the guide as a claim to test, not a fact.
