# Platform first: what the browser does, and what is left for the library

The rule: a feature shipped in the latest Chrome, Firefox and Safari is used natively, with no JavaScript
standing in for it. `pnpm baseline` reports which features qualify (`pnpm baseline <web-features-id>` for any
other). The lists below were true for Chrome 157, Firefox 160 and Safari 27.2; re-run the command before relying
on the "not yet" list, because features move off it with each release.

## Use natively

| Need                                                               | Use                                                                                                                      | So the library does not                                                |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Modal layer, focus containment, Escape, focus return, backdrop     | `<dialog>` with `showModal()`, the `cancel` event, `::backdrop`, `requestClose()`                                        | portal, trap focus, track a dismissal stack, render a backdrop element |
| Non-modal layer, light dismiss, Escape, nesting                    | `popover="auto"` (`"manual"` where the part decides when to close), `showPopover({ source })`, `beforetoggle` / `toggle` | portal, listen for outside presses, manage z-index                     |
| Placing a popup against its trigger, flipping at the viewport edge | CSS anchor positioning: the implicit anchor from the invoker, `position-area`, `position-try-fallbacks`, `anchor-size()` | measure, compute positions, depend on a positioning library            |
| Trigger opens or closes its target                                 | `popovertarget`, `command` / `commandfor`                                                                                | attach click handlers for it                                           |
| Disclosure, and one-open-at-a-time groups                          | `<details>`, `<summary>`, `<details name>`, the `toggle` event                                                           | hold open state the browser already holds, hide content itself         |
| Entry animation                                                    | `@starting-style` in the consumer's CSS                                                                                  | set a starting-style attribute for a frame                             |
| Checked, selected and invalid state                                | native `<input>` (`appearance: none`), `:checked`, `:indeterminate`, `:user-invalid`, `:has()`                           | mirror a hidden input, track touched state for styling                 |
| Radio group keyboard behaviour                                     | native radios sharing a `name`                                                                                           | add roving focus                                                       |
| Making the page behind inert                                       | the top layer, `inert`                                                                                                   | toggle `aria-hidden` on siblings                                       |
| Scrollbar colour and thickness                                     | `scrollbar-color`, `scrollbar-width`                                                                                     | need ScrollArea for that                                               |

## Not shipped in all three yet: the library still does these

- **Exit animation of a top-layer element.** Firefox does not transition `display` and only Chrome has
  `overlay`, so a closing dialog or popover leaves the top layer at once. A `<dialog>` can be closed late,
  because every way of closing it can be intercepted: it gets `data-ending-style`, its animations run, then it
  closes. A popover can't: a press outside closes it immediately and can't be delayed, so its exit is left to
  CSS and only animates where the engine can.
- **Animating to `auto` height** (`interpolate-size`: Chrome only). A disclosure panel's measured size is still
  written to a CSS variable.
- **Hover-triggered popups** (`interestfor`: Chrome only; `popover="hint"`: not in Safari). Tooltip and
  PreviewCard use `popover="manual"` with the library's hover-intent logic, and since a manual popover gets no
  Escape or light dismiss from the browser, the library closes those two itself.
- **Closing a dialog on a press outside** (`<dialog closedby>`: not in Safari). Detected from a click on the
  dialog's own backdrop area.
- **A popup opened from something other than a button.** Only a `popovertarget` button is exempt from light
  dismiss; an element passed as `showPopover({ source })` is not, so a press on a combobox's input would close
  an `auto` popup. Combobox and Autocomplete use `popover="manual"` and close themselves.
- **Roving focus** (`focusgroup`: Chrome only). Menu, Tabs, Toolbar and ToggleGroup keep `createRovingFocus`.
- **Styleable `<select>`** (`appearance: base-select`: not in Firefox). Select stays a custom listbox.
- **Knowing which fallback position was used.** There is no shipped way to read it, so popups have no
  `data-side` after a flip and no arrow part.

Always the library's: ARIA roles and relationships the elements don't imply, typeahead, `aria-activedescendant`
lists, multi-thumb sliders, number parsing, toast queues and timers, and Field's label/description/error wiring.

## What follows for a component's design

- **The browser holds the state; the component mirrors it.** A popover closes itself on light dismiss. Read
  `open` back from `toggle` / `beforetoggle`, call `onOpenChange` from there, and make a controlled `open` prop
  an effect that calls `showPopover()` / `hidePopover()` to match.
- **Content stays in the document.** Closed means not displayed, not unmounted. There are no Portal parts and no
  `keepMounted`.
- **Style hooks are native first**: `[open]`, `:popover-open`, `:checked`, `::backdrop`, `::details-content`.
  Add a `data-*` attribute only for state that has no selector (`data-highlighted`, `data-ending-style`).
- **Fewer parts than Base UI.** A Positioner exists there because JavaScript positions a wrapper; here the popup
  is the positioned element. Parts that only existed to carry behaviour the platform now has are dropped.
- **Tests run in real browsers.** jsdom implements none of `showModal()`, `popover` or anchor positioning.
