---
name: rs-ui-components
description: How to write, change or review a component in rs-ui, the headless ReactiveScript (.rx) component library. Use when adding a component family or part under src/, editing a .rx or .d.rx file, adding a DOM primitive in src/internal, writing a fixture or test for a component, or fixing a ReactiveScript compiler error (PARSE, REACTIVE_WRITE_IN_OWNED_SCOPE, CONTEXT_NOT_FOUND, COMPONENT_AS_VALUE…) or a "no provision" runtime error in this repo.
---

# Writing rs-ui components

The language itself is documented in `node_modules/@reactivescript/compiler/guide/` (`language.md` first, then
`libraries.md`; `diagnostics.md` when the compiler reports a code). This skill is what those guides don't say:
how a headless component is shaped here, and how ReactiveScript 0.3.1 actually behaves at the edges a component
library hits. Everything in it was checked against the compiler; `references/language-notes.md` has the detail.

## Platform first

Before writing behaviour, ask what the browser already does. If the latest Chrome, Firefox and Safari all ship
it, the component uses it and adds no JavaScript for it; `pnpm baseline` says whether a feature qualifies.
`references/platform.md` lists what qualifies today, what doesn't yet, and what that means for a component's
parts and state. Read it before designing a family. A family that ends up as a few attributes on a native
element is finished, not thin.

## Read real components first

They are the specification of the house style. Pick the one closest to what you're building:

| File                                                 | Shows                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/dialog/dialog.rx`                               | A family on a native element (`<dialog>`): state mirrored to the browser, ids registered by child parts |
| `src/popover/popover.rx` + `src/internal/popover.rx` | An anchored popup on `popover` and CSS anchor positioning; the shared state other popups build on       |
| `src/alert-dialog/alert-dialog.rx`                   | Reusing another family through thin wrappers                                                            |
| `src/checkbox/checkbox.rx`                           | A form control and its Field integration                                                                |
| `src/menu/menu.rx`                                   | Behaviour the platform lacks: roving focus, typeahead, item kinds, nested contexts                      |

Families that still import `src/internal/popup.rx`, `createFloating`, `createFocusScope`, `createDismiss` or
`createPresence` predate platform first and are being moved off them: don't copy that plumbing.

Base UI is the reference for what each part means and for ARIA. Its React source and a Solid 2 port are on this
machine when available (`solid-bedrock`: `src/<component>` and `.reference/base-ui`). Take the behaviour that
the platform doesn't cover; where the browser's own behaviour differs from Base UI's, the browser's wins.

## The shape of a family

One file per family, `src/<family>/<family>.rx`, exporting:

- `export context <family>` and its `<Family>Context` type: the state parts read, plus the **actions** parts may
  call. A context is read-only, so anything a child must change is an action in it.
- `<Family>Root`, which owns the state and provides the context.
- For each part: a **props function** `<family><Part>(ref c: <Family>Context, …): PartProps` and a component
  `<Family><Part>` that spreads it on the default element.

The props function is this library's answer to Base UI's `render` prop. `.rx` has no JSX expressions and a
component can't be passed as a value, so a consumer who wants a different element writes their own small
component, reads the context, and spreads the same props: `t = collapsibleTrigger(use collapsible)`.
Give every part that has behaviour a props function; a part that only places children doesn't need one. Where
the behaviour comes from the element itself (`popovertarget` works only on a button), say so on the function.

Conventions the existing families follow, and consumers will rely on:

- **The browser's state is the truth.** Where a native element holds the state (`<dialog>`, `popover`,
  `<details>`, an `<input>`), the component mirrors it from the element's events and pushes a controlled prop
  back onto it. `src/internal/impl/native.ts` has the drivers.
- **Style hooks are native first**: `[open]`, `:popover-open`, `:checked`, `::backdrop`. A `data-*` attribute
  (present or absent: `""` or `undefined`) is for state with no selector: `data-highlighted`,
  `data-ending-style`, `data-disabled` on a non-native control. ARIA states are the strings `"true"`/`"false"`.
- Controlled or uncontrolled, the same way everywhere: `source uncontrolled := peek(props.defaultX ?? …)`,
  `current = props.x ?? uncontrolled`, and an action that writes `uncontrolled` and calls `props.onXChange`.
- A part accepts every attribute of its element (`DivProps`, `ButtonProps` from `src/internal/types.rx`) and
  merges them with `mergeProps(own, rest)`, so the consumer's `class`, `style`, handlers and `ref` are kept.
- Parts ship no styles. The exception is placement: a popup's anchoring declarations are written inline
  (`anchoredStyle`), where a stylesheet can override them.

## Rules the compiler won't explain

1. **Provide before anything reads `children`.** In a component that has `provide`, take `props` whole, write
   the `provide`, and only then destructure. Destructuring `children` first (in the parameter list too)
   instantiates the children before the context exists: it compiles, then throws `no provision for …` at run time.
   The same applies to a thin wrapper around a providing part: take `props` whole and write
   `<Inner {...props}>{props.children}</Inner>`. If the context has a default there is no error at all; the
   children just read the default.
2. **Render children explicitly** beneath a `provide`: `{children}`. Children that arrive only through a spread
   are invisible to the checker (`CONTEXT_NOT_FOUND`), and a self-closing `<Inner {...props} />` passes none: its
   own empty children win over the spread's.
3. **A handler body goes in a named `action`** unless it is written directly on an element
   (`onClick={() => { … }}`). In an object literal, a `ref`, or an argument, a statement-bodied arrow is
   `REACTIVE_WRITE_IN_OWNED_SCOPE`. Element refs are actions too: `action setPopup(element: HTMLElement) { popup := element }`, passed as `ref: setPopup`.
4. **`use` works only in a component.** A `fn` takes the context as a `ref` parameter.
5. **Spreads are last-wins.** Never `{...own} {...rest}`: the consumer's `onClick` would replace the part's.
   `mergeProps` runs both, consumer first. For a disabled part that isn't a native control, wrap the consumer's
   props in `withoutHandlers(rest, disabled)`.
6. **Types come through `src/internal/types.rx`.** Importing a type from a `.ts` or `.js` module leaves a value
   import in the output, which Vitest tolerates and the bundler rejects. Add an alias there instead. `.rx` also
   has no `as`, no generic type aliases and no `import type`: type an event parameter to narrow it
   (`event: KeyboardEvent & { currentTarget: HTMLElement }`).
7. **An element setter in a props object goes through `createRef`.** A `ref` inside a spread object is applied
   again whenever the object recomputes, and the repeat runs inside a computation, where calling an action
   throws `ACTION_CALLED_IN_OWNED_SCOPE`. `setPopup = createRef(writePopup)` ignores the same element twice.
8. **A read doesn't see the same run's write.** After `x := v`, `x` is still the old value: keep `v` in a `let`.

## The JavaScript boundary

`.rx` has no `document`, no `window`, no focus, no layout. That work lives in TypeScript under
`src/internal/impl/`, written as Solid primitives, and reaches `.rx` through three files that must agree:

- `src/internal/dom.js`: a facade that re-exports the implementation. `.rx` imports this, never the `.ts`.
- `src/internal/dom.d.rx`: what `.rx` may call. One declaration per line. `ref` marks a parameter passed live
  (the implementation receives an accessor) or a result read without a call.
- `src/internal/dom.d.ts`: generated from the `.d.rx` by `pnpm gen:dts`, so `rx-tsc` types calls as `.rx` sees
  them. Never edited.

Keep state, derivation and context in `.rx`. Add a primitive only for what needs the DOM **and** that the
platform doesn't do; look in `native.d.rx` (drivers for native elements) and the other `.d.rx` files first. A
call that returns nothing is still bound: `_dialog = createNativeDialog(…)`.

Inside a primitive: `createEffect(compute, apply)` with the cleanup returned from `apply`; read an accessor once
with `untrack`; and never let one primitive depend on another's effect having run first.

`createRovingFocus` suits a container that holds only items (a menu, a toolbar). Where free content sits
between the items, as in an accordion, handle the keys on the item itself, or arrow keys typed into an input in
that content get taken.

Lists use the DOM as the registry: an item carries `data-rs-ui-item` (and `data-disabled`), and
`createRovingFocus` finds items by querying. Parts don't register with a parent to be navigable.

## Tests

A test mounts a fixture, which is a small `.rx` entry (`export default component Fixture`) in the family's
`fixtures/` folder, and drives it as a user would. There are two kinds:

- `<family>.browser.test.ts` runs in Chromium, Firefox and WebKit (`pnpm test:browser`), with `mount` from
  `src/test/browser.ts`. Anything that touches a native feature, focus, layout or real input belongs here: its
  `user` sends trusted events, the only kind native behaviour answers to.
- `<family>.test.ts` runs in jsdom (`pnpm test`), with `mount` from `src/test/mount.ts`. Use it for logic that
  needs no browser: value maths, parsing, state transitions.

```ts
import { frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";

const { getByRole, user } = mount(basic);
await user.click(getByRole("button", { name: "Open" }));
```

Assert what every engine guarantees, not what one does: Safari doesn't focus a clicked button and skips buttons
when tabbing; Firefox makes a scrollable popup a Tab stop. Open things from the keyboard when focus return is
under test, and measure placement with `getBoundingClientRect()` after `await frame()`. A closed native element
is still in the document, so check `dialog.open` or `:popover-open`, not presence. Cover: the default state,
each way to change it (pointer and every key), controlled and uncontrolled, disabled, and form submission where
the part has a value. A test that passes on its first run has not yet been shown to fail: break the behaviour
once and watch it go red.

Each family also has a demo, `demo/<family>.rx`: one exported component showing typical use, added to
`demo/app.rx`. The demo build is what proves a family bundles.

A component is done when its tests pass in all three engines, `pnpm typecheck` and `pnpm lint` are clean, and
the test output has no Solid diagnostics. `pnpm check` is the whole suite; run it when a stage of work is
finished, not per component.
