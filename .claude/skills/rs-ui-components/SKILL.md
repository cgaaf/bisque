---
name: rs-ui-components
description: How to write, change or review a component in rs-ui, the headless ReactiveScript (.rx) component library. Use when adding a component family or part under src/, editing a .rx or .d.rx file, adding a DOM primitive in src/internal, writing a fixture or test for a component, or fixing a ReactiveScript compiler error (PARSE, REACTIVE_WRITE_IN_OWNED_SCOPE, CONTEXT_NOT_FOUND, COMPONENT_AS_VALUE…) or a "no provision" runtime error in this repo.
---

# Writing rs-ui components

The language itself is documented in `node_modules/@reactivescript/compiler/guide/` (`language.md` first, then
`libraries.md`; `diagnostics.md` when the compiler reports a code). This skill is what those guides don't say:
how a headless component is shaped here, and how ReactiveScript 0.3.1 actually behaves at the edges a component
library hits. Everything in it was checked against the compiler; `references/language-notes.md` has the detail.

## Read real components first

They are the specification of the house style. Pick the one closest to what you're building:

| File                             | Shows                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------- |
| `src/collapsible/collapsible.rx` | The smallest complete family: controlled state, context, props functions        |
| `src/checkbox/checkbox.rx`       | A form control: hidden native input, state attributes shared with an indicator  |
| `src/dialog/dialog.rx`           | Portal, focus scope, dismissal, presence, ids registered by child parts         |
| `src/menu/menu.rx`               | Anchored popup on `createPopupState`, roving focus, item kinds, nested contexts |
| `src/internal/popup.rx`          | An instantiating `fn` shared across families                                    |

Behaviour, parts and ARIA follow Base UI. A Solid 2 port of it is the best behavioural reference when one is
available on the machine (`solid-bedrock`: its `src/<component>` and tests); port behaviour, not code.

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
Give every part that has behaviour a props function; a part that only places children doesn't need one.

Conventions the existing families follow, and consumers will rely on:

- State is exposed as `data-*` attributes, present or absent (`""` or `undefined`): `data-open`/`data-closed`,
  `data-checked`/`data-unchecked`, `data-disabled`, `data-highlighted`, and `data-starting-style`/
  `data-ending-style` on anything that animates. ARIA states are the strings `"true"`/`"false"`.
- Controlled or uncontrolled, the same way everywhere: `source uncontrolled := peek(props.defaultX ?? …)`,
  `current = props.x ?? uncontrolled`, and an action that writes `uncontrolled` and calls `props.onXChange`.
- A part accepts every attribute of its element (`DivProps`, `ButtonProps` from `src/internal/types.rx`) and
  merges them with `mergeProps(own, rest)`, so the consumer's `class`, handlers and `ref` are kept.
- Parts ship no styles and no inline visual CSS. Positioning written by `createFloating` is the exception.

## Rules the compiler won't explain

1. **Provide before anything reads `children`.** In a component that has `provide`, take `props` whole, write
   the `provide`, and only then destructure. Destructuring `children` first (in the parameter list too)
   instantiates the children before the context exists: it compiles, then throws `no provision for …` at run time.
2. **Render children explicitly** beneath a `provide`: `{children}`. Children that arrive only through a spread
   are invisible to the checker (`CONTEXT_NOT_FOUND`).
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
7. **A read doesn't see the same run's write.** After `x := v`, `x` is still the old value: keep `v` in a `let`.

## The JavaScript boundary

`.rx` has no `document`, no `window`, no focus, no layout. That work lives in TypeScript under
`src/internal/impl/`, written as Solid primitives, and reaches `.rx` through three files that must agree:

- `src/internal/dom.js`: a facade that re-exports the implementation. `.rx` imports this, never the `.ts`.
- `src/internal/dom.d.rx`: what `.rx` may call. One declaration per line. `ref` marks a parameter passed live
  (the implementation receives an accessor) or a result read without a call.
- `src/internal/dom.d.ts`: generated from the `.d.rx` by `pnpm gen:dts`, so `rx-tsc` types calls as `.rx` sees
  them. Never edited.

Keep state, derivation and context in `.rx`; add a primitive only for what needs the DOM, and look in
`dom.d.rx` first, since most behaviours already exist (presence, focus scope, dismissal, scroll lock, floating
position, roving focus and typeahead). A call that returns nothing is still bound: `_scope = createFocusScope(…)`.

Inside a primitive: `createEffect(compute, apply)` with the cleanup returned from `apply`; read an accessor once
with `untrack`; and never let one primitive depend on another's effect having run first.

Lists use the DOM as the registry: an item carries `data-rs-ui-item` (and `data-disabled`), and
`createRovingFocus` finds items by querying. Parts don't register with a parent to be navigable.

## Tests

A test mounts a fixture, which is a small `.rx` entry (`export default component Fixture`) in the family's
`fixtures/` folder, and drives it as a user would:

```ts
import { mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";

const { getByRole, user } = mount(basic);
await user.click(getByRole("button", { name: "Open" }));
```

Queries cover the whole document, so portalled content is found. Assert on roles, ARIA, `data-*` state, focus
and what the consumer's callbacks received. Something that unmounts after an exit animation is awaited with
`expect.poll`. Cover: the default state, each way to change it (pointer and every key), controlled and
uncontrolled, disabled, and form submission where the part has a value. A test that passes on its first run has
not yet been shown to fail: break the behaviour once and watch it go red.

Each family also has a demo, `demo/<family>.rx`: one exported component showing typical use, added to
`demo/app.rx`. The demo build is what proves a family bundles.

A component is done when its tests pass, `pnpm typecheck` and `pnpm lint` are clean, and the test output has no
Solid diagnostics. `pnpm check` is the whole suite; run it when a stage of work is finished, not per component.
