# Drawer

A panel that slides in from an edge of the screen and can be swiped away.

Source after `bisque copy`: `<copy>/drawer/drawer.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { DrawerRoot, DrawerTrigger, DrawerPopup, DrawerContent, DrawerTitle, DrawerDescription, DrawerClose } from "./bisque/drawer/drawer.rx"

<DrawerRoot>
  <DrawerTrigger />
  <DrawerPopup>
    <DrawerContent>
      <DrawerTitle />
      <DrawerDescription />
      <DrawerClose />
    </DrawerContent>
  </DrawerPopup>
</DrawerRoot>
```

## DrawerRoot

Renders no element of its own. Holds the drawer's open state and its swipe, and shares them with the parts inside it. It is a DialogRoot underneath.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean` |  | Whether the drawer is open. Pass it with `onOpenChange` to control the drawer. |
| `defaultOpen` | `boolean` | `false` | Whether the drawer is open at first, when it isn't controlled. |
| `onOpenChange` | `(open: boolean) => void` |  | Called when a part, Escape, a press outside or a swipe asks to open or close the drawer. A controlled drawer changes only when `open` does. It is called in a change of its own, after the drawer's: a request it starts, or a handler that is itself an action, doesn't hold the drawer. |
| `swipeDirection` | `DrawerSwipeDirection` | `"down"` | The edge the drawer is swiped out through: `"up"`, `"down"`, `"left"` or `"right"`. |
| `swipeThreshold` | `number` | `half the drawer's size along `swipeDirection`` | How far a swipe must travel to close the drawer, in pixels. When it isn't given, half the drawer's size along `swipeDirection`. A fast flick closes it whatever the distance. |
| `modal` | `boolean` | `true` | Whether the drawer is opened with `showModal()`: in the top layer, with a backdrop, the page behind it inert and its scroll locked. As DialogRoot's. |
| `dismissible` | `boolean` | `true` | Whether Escape and a press outside close the drawer. With `false` only its own buttons and a swipe do. |
| `disablePointerDismissal` | `boolean` | `false` | Whether a press outside is ignored. Escape and a swipe still close the drawer. |

## DrawerTrigger

Renders `<button>`. The button that opens the drawer.

| Data attribute | Meaning |
| --- | --- |
| `data-popup-open` | Present while the drawer is open. |

## DrawerPopup

Renders `<dialog>`. The `<dialog>` element, which follows the swipe. Place it against its edge in CSS and translate it by the movement variables. Its `::backdrop` inherits the variables.

| Data attribute | Meaning |
| --- | --- |
| `data-ending-style` | Present while the drawer animates out. It stays open until the transitions and animations on it and its descendants finish. |
| `data-swipe-direction` | The edge it is swiped out through: `up`, `down`, `left` or `right`. |
| `data-swipe-dismiss` | Present when the drawer was last closed by a swipe, until it opens again. |
| `data-swiping` | Present while the drawer is being dragged. |

| CSS variable | Meaning |
| --- | --- |
| `--drawer-swipe-movement-x` | How far the drawer has been dragged horizontally, in pixels. `0px` at rest. |
| `--drawer-swipe-movement-y` | How far the drawer has been dragged vertically, in pixels. `0px` at rest. |
| `--drawer-swipe-progress` | The drag towards `swipeDirection` as a fraction of the drawer's size, from 0 to 1. |

## DrawerContent

Renders `<div>`. Holds the drawer's content. A mouse press inside it selects text instead of starting a swipe; a touch still swipes.

| Data attribute | Meaning |
| --- | --- |
| `data-drawer-content` | Always present. It marks the area where a mouse press doesn't start a swipe. |

## DrawerTitle

Renders `<h2>`. A heading that names the drawer. The popup's `aria-labelledby` points at it.

## DrawerDescription

Renders `<p>`. A paragraph that describes the drawer. The popup's `aria-describedby` points at it.

## DrawerClose

Renders `<button>`. A button that closes the drawer.
