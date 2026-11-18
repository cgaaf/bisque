# Preview Card

A card that previews what a link points to while the link is hovered or focused.

Source after `bisque-ui copy`: `<copy>/preview-card/preview-card.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { PreviewCardRoot, PreviewCardTrigger, PreviewCardPopup, PreviewCardArrow } from "./bisque/preview-card/preview-card.rx"

<PreviewCardRoot>
  <PreviewCardTrigger />
  <PreviewCardPopup>
    <PreviewCardArrow />
  </PreviewCardPopup>
</PreviewCardRoot>
```

## PreviewCardRoot

Renders no element of its own. Holds the card's open state and shares it with the link and the card. Renders no element, so it can wrap the paragraph the link is in.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean` |  | Whether the card is open. Pass it with `onOpenChange` to control it. |
| `defaultOpen` | `boolean` | `false` | Whether the card is open at first, when it isn't controlled. |
| `onOpenChange` | `(open: boolean) => void` |  | Called with the new state when hover, focus, Escape or a press outside opens or closes the card. It is called in a change of its own, after the card's: a request it starts (a preview that loads on open), or a handler that is itself an action, doesn't hold the card. |

## PreviewCardTrigger

Renders `<a>`. The link the card previews. It opens the card on hover and on keyboard focus, after the delay.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `delay` | `number` | `600` | How long the pointer rests on the link, or focus stays on it, before the card opens, in milliseconds. |
| `closeDelay` | `number` | `300` | How long after the pointer leaves the link and the card before the card closes, in milliseconds. |

| Data attribute | Meaning |
| --- | --- |
| `data-popup-open` | Present while the card is open. |

## PreviewCardPopup

Renders `<div>`. The card: an element with `popover="manual"`, placed against the link with CSS anchor positioning. It takes no role. Style it with `:popover-open` and `@starting-style`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `side` | `"top" \| "bottom" \| "left" \| "right"` | `"bottom"` | Which side of the link the card sits on. The browser flips it when it doesn't fit. |
| `align` | `"start" \| "center" \| "end"` | `"center"` | Which edge of the link the card lines up with, along the side. |
| `sideOffset` | `number` | `0` | The gap between the link and the card, in pixels. |
| `alignOffset` | `number` | `0` | How far the card is moved along the link's edge from its `align` position, in pixels. |

| Data attribute | Meaning |
| --- | --- |
| `data-side` | Which side of the link the card is on: the `side` asked for, then the side the browser placed it on once open. |

## PreviewCardArrow

Renders `<div>`. An element placed on the card's edge that faces the link, centred on the link. It follows the card when the browser flips it. Give it a shape in CSS and turn it per `data-side`.

| Data attribute | Meaning |
| --- | --- |
| `data-side` | Which side of the link the card is on. Absent until the card first opens; a close keeps the last side. |
