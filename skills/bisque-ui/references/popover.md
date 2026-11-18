# Popover

An accessible popup anchored to a button.

Source after `bisque-ui copy`: `<copy>/popover/popover.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { PopoverRoot, PopoverTrigger, PopoverPopup, PopoverArrow, PopoverTitle, PopoverDescription, PopoverClose } from "./bisque/popover/popover.rx"

<PopoverRoot>
  <PopoverTrigger />
  <PopoverPopup>
    <PopoverArrow />
    <PopoverTitle />
    <PopoverDescription />
    <PopoverClose />
  </PopoverPopup>
</PopoverRoot>
```

## PopoverRoot

Renders no element of its own. Holds the popover's open state and shares it with the parts inside it.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean` |  | Whether the popover is open. Pass it with `onOpenChange` to control the popover. |
| `defaultOpen` | `boolean` | `false` | Whether the popover is open at first, when it isn't controlled. |
| `onOpenChange` | `(open: boolean) => void` |  | Called with the new state after the browser or a part opened or closed the popover. A press outside and Escape can't be refused: a controlled popover that keeps `open` true is shown again. It is called in a change of its own, after the popover's: a request it starts, or a handler that is itself an action, doesn't hold the popover or hide it again after the browser showed it. |

## PopoverTrigger

Renders `<button>`. The button that opens and closes the popover. The browser's `popovertarget` does both on a press.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `openOnHover` | `boolean` | `false` | Whether resting the pointer on the trigger also opens the popover. A press still toggles it. |
| `delay` | `number` | `300` | With `openOnHover`: how long the pointer rests on the trigger before it opens, in ms. |
| `closeDelay` | `number` | `0` | With `openOnHover`: how long after the pointer leaves trigger and popup before it closes, in ms. |

| Data attribute | Meaning |
| --- | --- |
| `data-popup-open` | Present on the trigger while its popup is open. |

## PopoverPopup

Renders `<div>`. The popup: an element with `popover="auto"`, placed against the trigger with CSS anchor positioning. Style it with `:popover-open`, `::backdrop` and `@starting-style`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `side` | `"top" \| "bottom" \| "left" \| "right"` | `"bottom"` | Which side of the trigger it sits on; the browser flips it when it doesn't fit. |
| `align` | `"start" \| "center" \| "end"` | `"center"` | Which edge of the trigger it lines up with. |
| `sideOffset` | `number` | `0` | Gap between trigger and popup, in pixels. |
| `alignOffset` | `number` | `0` | How far the popup is moved along the trigger's edge from its `align` position, in pixels. |

| Data attribute | Meaning |
| --- | --- |
| `data-side` | Which side of its anchor the popup is on: the one asked for, then the one the browser placed it on. |

## PopoverTitle

Renders `<h2>`. A heading that names the popup. The popup's `aria-labelledby` points at it.

## PopoverDescription

Renders `<p>`. A paragraph that describes the popup. The popup's `aria-describedby` points at it.

## PopoverClose

Renders `<button>`. A button that closes the popover.

## PopoverArrow

Renders `<div>`. An element placed on the popup's edge that faces the trigger, centred on the trigger. It follows the popup when the browser flips it. Give it a shape in CSS and turn it per `data-side`.

| Data attribute | Meaning |
| --- | --- |
| `data-side` | Which side of the trigger the popup is on. Absent until the popup first opens; a close keeps the last side. |
