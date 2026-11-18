# Splitter

Panels separated by bars that resize them, with a pointer or the keyboard.

Source after `bisque-ui copy`: `<copy>/splitter/splitter.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { SplitterRoot, SplitterPanel, SplitterHandle } from "./bisque/splitter/splitter.rx"

<SplitterRoot>
  <SplitterPanel id="first" />
  <SplitterHandle />
  <SplitterPanel id="second" />
</SplitterRoot>
```

## SplitterRoot

Renders `<div>`. Holds the panels' sizes and shares them with the panels and handles inside it. Renders a `<div>` that is a flex container in the orientation's direction: it sets `display: flex` and `flex-direction` inline, because the panels' sizes are flex grow factors.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `orientation` | `SplitterOrientation` | `"horizontal"` | Whether the panels sit side by side (`horizontal`, the handles are vertical bars) or are stacked (`vertical`). |
| `sizes` | `number[]` |  | The panels' sizes in percent, one per panel in document order. Pass it with `onSizesChange` to control the layout. A list without one size per panel is ignored and the panels' defaults apply; one that doesn't sum to 100 or breaks a panel's bounds is corrected. Pass it with only `onSizesCommit` and the handles follow the pointer and keys by themselves, then show `sizes` again once the owner's `onSizesCommit` has run. |
| `defaultSizes` | `number[]` |  | The sizes at first, when they aren't controlled, as `sizes`. Without them each panel starts at its `defaultSize`, and panels without one share what is left equally. A double-click on a handle goes back to them. |
| `onSizesChange` | `(sizes: number[], details: SplitterChangeDetails) => void` |  | Called on every change, many times during a drag, with the new sizes and details whose `reason` is `drag`, `keyboard` or `reset`. It is called in a change of its own, after the one that resized the panels. |
| `onSizesCommit` | `(sizes: number[], details: SplitterChangeDetails) => void` |  | Called when a change is final: when a drag that changed the sizes is released, on each key, and on a reset. Receives the sizes and the `reason`. Save a layout here: it is called in a change of its own, so it may be an action that waits for a server, and the panels can be resized again while the save is out. Persisting to storage is up to you; there is no storage option. |
| `keyboardStep` | `number` | `10` | How far an arrow key moves a handle, in percent of the group. |
| `disabled` | `boolean` | `false` | Whether every handle ignores the pointer and the keys. Disabled handles leave the tab order. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the group is disabled. |
| `data-dragging` | Present while a handle is being dragged. Set the cursor and `user-select: none` here, so they hold wherever the pointer goes. |
| `data-orientation` | The group's orientation: `horizontal` or `vertical`. |

## SplitterPanel

Renders `<div>`. A panel. Its size is written inline as its flex grow factor on a zero basis (`flex: <size> 1 0px`), so sizes are percentages of the space the panels share after the handles. It also sets `min-width: 0` (`min-height: 0` when stacked) so it can shrink below its content; what overflows is yours to decide with `overflow`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id` (required) | `string` |  | The panel's key, unique within its group: the root knows it by this, carries its size by it when panels are added or removed, and gives its element the DOM id that the handle's `aria-controls` points at (prefixed, so two groups can both have a panel `"left"`). |
| `defaultSize` | `number` |  | The size to start with, in percent. Without one, the panel shares what the panels with a default leave. |
| `minSize` | `number` | `0` | The smallest the panel can be dragged or stepped to, in percent. |
| `maxSize` | `number` | `100` | The largest the panel can be, in percent. |
| `collapsible` | `boolean` | `false` | Whether the panel can collapse to `collapsedSize`: when dragged past halfway between its minimum and collapsed sizes, by an arrow key when it is already at its minimum, by Home on the handle after it, or by Enter on the handle beside it. |
| `collapsedSize` | `number` | `0` | The panel's size when collapsed, in percent. At most `minSize`. |
| `onCollapse` | `() => void` |  | Called when the panel collapses, by a drag, a key or a change of `sizes`. Not called for a panel that starts collapsed. |
| `onExpand` | `() => void` |  | Called when a collapsed panel opens again. |

| Data attribute | Meaning |
| --- | --- |
| `data-collapsed` | Present while the panel is collapsed. |
| `data-orientation` | The group's orientation: `horizontal` or `vertical`. |

## SplitterHandle

Renders `<div>`. The bar between two panels: a focusable `role="separator"` whose value (`aria-valuenow`, `aria-valuemin`, `aria-valuemax`) is the size of the panel before it, which it names in `aria-controls`. Its `aria-orientation` is the bar's own, so it is `vertical` between side-by-side panels. Drag it, or focus it and use the arrow keys along the group's axis (mirrored right to left), Home and End (the smallest and largest size that panel can reach, exactly `aria-valuemin` and `aria-valuemax`; a collapsible panel's smallest is its collapsed size, so Home collapses it), and Enter (collapse or restore a collapsible panel beside it). A double-click puts the default sizes back. It sets `touch-action: none` so a touch drag moves it instead of scrolling.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `disabled` | `boolean` | `false` | Whether this handle alone ignores the pointer and the keys. It leaves the tab order. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the handle or the whole group is disabled. |
| `data-dragging` | Present while this handle is being dragged. |
| `data-orientation` | The group's orientation, not the bar's: `horizontal` between side-by-side panels. |
