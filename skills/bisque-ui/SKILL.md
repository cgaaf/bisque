---
name: bisque-ui
description: Build UI in a ReactiveScript (.rx) app with bisque-ui, the headless, unstyled, accessible component library (Dialog, Popover, Menu, Select, Combobox, Tabs, Form, Field, Switch, Toast and more). Use when adding, styling, animating, composing or wrapping Bisque parts, wiring them to a server (loading, saving, submitting), or when an app's code imports from a copied `bisque` folder.
license: MIT
---

# Using Bisque in an app

Bisque is headless: each part renders one native element with the right ARIA, keyboard and focus behaviour, and
no styles. It is platform first: whatever current Chrome, Firefox and Safari do natively is left to the browser.
A dialog is a `<dialog>`, popups are `popover` elements placed with CSS anchor positioning, disclosures are
`<details>`, checkboxes are checkboxes. It is experimental, like ReactiveScript 0.3: trust the copied source
over memory.

## Find the part before writing it

1. [references/components.md](references/components.md) lists every family.
2. `references/<family>.md` has its anatomy and, for each part, the element it renders, its props with types and
   defaults, its `data-*` attributes and CSS variables. Read it before using a family; don't guess prop names.
3. There is no Portal, Positioner, Backdrop or focus-trap part, and no positioning engine. Don't look for them:
   the top layer, `::backdrop`, `inert` and anchor positioning do that work.

## Setup

ReactiveScript 0.3 resolves an `.rx` import only by relative path, so the library is copied into the app:

```bash
pnpm add bisque-ui @reactivescript/runtime solid-js @solidjs/web
pnpm dlx bisque-ui copy src/bisque
```

- Import parts from the family file by a path relative to the importing file:
  `import { DialogRoot, DialogTrigger, DialogPopup } from "../bisque/dialog/dialog.rx"`.
- The tsconfig that `rx-tsc` reads must exclude the copy's `.d.rx` files: `"exclude": ["**/*.d.rx"]`.
- Re-run `bisque-ui copy` after upgrading the package; it replaces the folder. Never edit the copy: wrap a part
  in a component of your own instead (see Composition).
- Find which folder holds the copy by searching the app for `internal/props` or `dialog/dialog.rx`.

## Anatomy

- A family's `…Root` holds its state and provides it as a context; the other parts read it. Nest parts anywhere
  inside their Root, with your own markup between them. A part outside its Root fails with a message naming the
  missing context.
- Every part passes `class`, `style`, `id`, `data-*`, `aria-*` and other attributes on to its element.
- Every stateful Root works both ways: uncontrolled (`defaultOpen`, `defaultValue`, `defaultChecked`) or
  controlled (`open` with `onOpenChange`, `value` with `onValueChange`, held in a `source` of your own). A
  controlled Root changes only when its prop does, so the owner can refuse a change or answer it late.

```rx
import { DialogRoot, DialogTrigger, DialogPopup, DialogTitle, DialogDescription, DialogClose } from "./bisque/dialog/dialog.rx"

export component DeleteProject() {
  <DialogRoot>
    <DialogTrigger class="Button">Delete project</DialogTrigger>
    <DialogPopup class="Dialog">
      <DialogTitle>Delete this project?</DialogTitle>
      <DialogDescription>Its files are removed for everyone.</DialogDescription>
      <DialogClose class="Button">Cancel</DialogClose>
    </DialogPopup>
  </DialogRoot>
}
```

## Styling

- Put a class on the part and style it from a stylesheet. A view's `<style>` is scoped to the elements that view
  writes, and a part's element belongs to the part, so a scoped rule doesn't reach it: use a global stylesheet or
  `:global(.Class)`.
- Use the platform's selector for state the browser holds; the library adds `data-*` only where none exists.

```css
.Dialog[open] {
} /* <dialog>, <details> */
.Popup:popover-open {
} /* anything with the popover attribute */
.Checkbox:checked {
} /* native inputs */
.Input:user-invalid {
}
.Dialog::backdrop {
}
.Panel::details-content {
}

.Item[data-highlighted] {
} /* state only the library knows */
.Popup[data-side="top"] {
}
.Trigger[data-popup-open] {
}
.Dialog[data-ending-style] {
}
.Form[data-submitting] {
}
```

- Native elements keep the browser's defaults: a `<dialog>` or popover has a border, padding, background and
  `overflow: auto`; a checkbox needs `appearance: none`; `<summary>` has a marker. Reset what you replace.
- An anchored popup's `side`, `align` and offsets become inline `position-area`, `position-try-fallbacks` and a
  margin. Override them from CSS or `style`, and use `anchor-size()` to match a trigger's width.
- What you pass is merged with what the part sets: classes are joined, inline styles merged with yours winning
  (object or string), and your event handler runs before the part's.

## Animation

- In: `@starting-style` on the open state (`.Dialog[open]`, `.Popup:popover-open`). No attribute or script.
- Out: Dialog, Alert Dialog, Drawer, Collapsible and Accordion close late. The element gets
  `data-ending-style`, its transitions and animations run, then it closes. Style the end state under that
  attribute. Collapsible panels expose `--collapsible-panel-height` and `-width`.
- Popovers can't close late. Transition `display` and `overlay` with `allow-discrete`: Chrome animates out,
  Firefox and Safari close at once. Nothing breaks either way.
- `prefers-reduced-motion`: removing the animations is enough; the parts continue when there are none.

## Composition

- To give a part your defaults, write a component that renders it and passes the rest of its props on. Render
  `children` explicitly: a self-closing part with a spread passes none.
- Every part with behaviour is also a props function, named like the part in camelCase (`PopoverClose` →
  `popoverClose`), that takes the family's context and returns the props the part spreads on its element. Read
  the context with `use` (the context export is the family name in camelCase: `popover`, `dialog`) and combine
  props with `mergeProps` from the copy's `internal/props.js`. Check the function's signature in the family file:
  some take more arguments.

```rx
import { popover, popoverClose } from "./bisque/popover/popover.rx"
import { mergeProps } from "./bisque/internal/props.js"
import { AnchorProps } from "./bisque/internal/types.rx"

component CloseLink({ children, ...rest }: AnchorProps) {
  c = use popover
  merged = mergeProps(popoverClose(c), rest)
  <a {...merged} role="button" tabindex="0">{children}</a>
}
```

- A props function gives behaviour, not the element's semantics: add `role` and `tabindex` when you swap a button
  for something else. Some only work on one element because the platform feature does: `popovertarget` needs a
  `<button>`, a disclosure trigger must be the `<summary>` of its `<details>`. The reference says which element
  each part renders.

## Forms

- Checkbox, Switch, Radio and Input render real inputs: give one a `name` and it submits with its form, the
  browser enforces `required`, `pattern`, `min`, and `:user-invalid` styles it. Select, Slider, Number Field and
  other custom controls also submit through `name`.
- `FieldRoot name="…"` connects a control to its `FieldLabel`, `FieldDescription` and `FieldError`, and runs the
  native constraints, then your `validate` (return a message or `null`).
- `Form` validates on submit, focuses the first invalid field, then calls `onFormSubmit(values)` and waits for
  it: the form is `data-submitting` and ignores a second submit until it settles. Resolve to the server's errors
  keyed by field name (or nothing); each shows on its field until that field changes. Uncaught failures go to
  `onFormError`. `validationMode` is `"onSubmit"` (default), `"onBlur"` or `"onChange"`.

## Server data

ReactiveScript handles races, held frames and rollback; the parts are built to keep working through them. Design
every part that touches the network against a slow, failing server.

- Their own state (open, highlighted, typed) never waits for your request; your callbacks run after it.
- Show a save at once with `guess`, end the action with `refresh` so crossed answers settle on what the server
  holds, and show `pending?` progress. Prefer `readOnly` to `disabled` while a save is out, where the control has
  it: a disabled input loses focus.

```rx
alerts = await loadSetting("alerts", false) -> false
source failure := ""

<SwitchRoot checked={alerts} onCheckedChange={(next) => {
  guess alerts := next
  onFlush(() => { failure := "" })
  affects alerts
  try {
    await saveSetting("alerts", next)
    refresh alerts
  } catch (error) {
    failure := error.message
  }
}}>
  <SwitchThumb />
</SwitchRoot>
<span aria-live="polite">{pending? alerts ? "Saving…" : failure}</span>
```

- Options from a server: pass Combobox, Autocomplete or Select the answer that is on its way and say so with
  `loading`. Typing and the highlight stay live, and the empty state stays quiet until an answer lands.

```rx
source query := ""
results = await searchCountries(query) -> null
searching = results == null || pending? results

<ComboboxRoot loading={searching} onInputValueChange={(text) => { query := text }}>
  <ComboboxInput aria-label="Country" />
  <ComboboxPopup>
    {errored fallback(e) {
      <div role="alert">{e.message} <button type="button" onClick={() => { refresh results }}>Retry</button></div>
    } {
      <ComboboxEmpty>No country found.</ComboboxEmpty>
      <ComboboxList>
        {for country in results ?? [] {
          <ComboboxItem value={country.code} label={country.name}>{country.name}</ComboboxItem>
        }}
      </ComboboxList>
    }}
  </ComboboxPopup>
</ComboboxRoot>
```

- Content that loads inside a dialog, popover, menu or tab panel: the popup opens at once on your `loading`
  fallback and focus moves in when content arrives. Put `errored` inside the popup, not around it, so a failure
  is read and retried where it happened.
- A source written before an `await` in an action is held until the action ends, and so is a prop computed from
  it; a few parts then wait for your request. Write with `guess`, or clear messages in `onFlush`, so the change
  shows at once.

## Browsers

Current Chrome, Firefox and Safari only, with no fallbacks. Not there yet: popover exit animations outside Chrome,
server rendering (untested), screen-reader audits.
