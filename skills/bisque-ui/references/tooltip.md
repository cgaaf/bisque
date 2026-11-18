# Tooltip

A short label that appears when a button is hovered or focused.

Source after `bisque copy`: `<copy>/tooltip/tooltip.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipPopup, TooltipArrow } from "./bisque/tooltip/tooltip.rx"

<TooltipProvider>
  <TooltipRoot>
    <TooltipTrigger />
    <TooltipPopup>
      <TooltipArrow />
    </TooltipPopup>
  </TooltipRoot>
</TooltipProvider>
```

## TooltipProvider

Renders no element of its own. Groups the tooltips beneath it: once one has opened, moving to another trigger opens its tooltip at once and closes the first. Renders no element.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `delay` | `number` |  | How long the pointer rests on a trigger before its tooltip opens, in milliseconds. A trigger's own `delay` wins. |
| `closeDelay` | `number` |  | How long after the pointer leaves before a tooltip closes, in milliseconds. A trigger's own `closeDelay` wins. |
| `timeout` | `number` | `400` | How long after a tooltip closes another still opens at once when its trigger is hovered, in milliseconds. |

## TooltipRoot

Renders no element of its own. Holds one tooltip's open state and shares it with its trigger and popup. Renders no element.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean` |  | Whether the tooltip is open. Pass it with `onOpenChange` to control the tooltip. |
| `defaultOpen` | `boolean` | `false` | Whether the tooltip is open at first, when it isn't controlled. |
| `onOpenChange` | `(open: boolean) => void` |  | Called with the new state when hover, focus, a press, Escape or a press outside opens or closes the tooltip. It is called in a change of its own, after the tooltip's: a request it starts (text that loads on open), or a handler that is itself an action, doesn't hold the tooltip. |
| `disabled` | `boolean` | `false` | A disabled tooltip doesn't open, and closes if it was open. |
| `disableHoverablePopup` | `boolean` | `false` | Close the tooltip as soon as the pointer leaves the trigger, instead of letting it move onto the popup. |

## TooltipTrigger

Renders `<button>`. The button the tooltip describes. It opens the tooltip on hover after a delay and on keyboard focus at once, and closes it on leave, blur and press. While the tooltip is open its `aria-describedby` points at the popup.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `delay` | `number` | `the provider's, else 600` | How long the pointer rests on the trigger before the tooltip opens, in milliseconds. Falls back to the provider's, then to 600. |
| `closeDelay` | `number` | `the provider's, else 0` | How long after the pointer leaves before the tooltip closes, in milliseconds. Falls back to the provider's, then to 0. |
| `closeOnClick` | `boolean` | `true` | Whether pressing the trigger closes the tooltip. |

| Data attribute | Meaning |
| --- | --- |
| `data-popup-open` | Present on the trigger while its popup is open. |

## TooltipPopup

Renders `<div>`. The popup: an element with `popover="manual"` and the `tooltip` role, placed against the trigger with CSS anchor positioning. Style it with `:popover-open` and `@starting-style`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `side` | `"top" \| "bottom" \| "left" \| "right"` | `"top"` | Which side of the trigger the popup sits on. The browser flips it when it doesn't fit. |
| `align` | `"start" \| "center" \| "end"` | `"center"` | Which edge of the trigger the popup lines up with, along the side. |
| `sideOffset` | `number` | `0` | The gap between the trigger and the popup, in pixels. |
| `alignOffset` | `number` | `0` | How far the popup is moved along the trigger's edge from its `align` position, in pixels. |

| Data attribute | Meaning |
| --- | --- |
| `data-side` | Which side of the trigger the popup is on: the `side` asked for, then the side the browser placed it on once open. |

## TooltipArrow

Renders `<div>`. An element placed on the popup's edge that faces the trigger, centred on the trigger. It follows the popup when the browser flips it. Give it a shape in CSS and turn it per `data-side`.

| Data attribute | Meaning |
| --- | --- |
| `data-side` | Which side of the trigger the popup is on. Absent until the popup first opens; a close keeps the last side. |
