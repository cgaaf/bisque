# Sortable

A list whose items can be reordered by drag and drop, with the pointer or the keyboard.

Source after `bisque copy`: `<copy>/sortable/sortable.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { SortableGroup, SortableRoot, SortableItem, SortableHandle } from "./bisque/sortable/sortable.rx"

<SortableGroup>                  // only to move items between lists
  <SortableRoot value={order} onValueChange={(next) => { order := next }}>
    {for id in order {
      <SortableItem id={id}>
        <SortableHandle />       // optional: without it the whole item is the handle
      </SortableItem>
    }}
  </SortableRoot>
</SortableGroup>
```

## SortableGroup

Renders `<div>`. Lets items move between the SortableRoots inside it. It owns every list's order, by each root's `listId`, runs the drag across them, and holds the keyboard instructions and the live region for all of them. Renders a `<div>`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `SortableLists` |  | Each list's order: an object from each root's `listId` to the ids of its items. Pass it with `onValueChange` to control the lists. |
| `defaultValue` | `SortableLists` |  | Each list's order at first, when it isn't controlled. Render the items from the `value` each root's context gives. |
| `onValueChange` | `(value: SortableLists, details: SortableDragDetails) => void` |  | Called once per drop that changes an order, with every list's new order and the drag's details (`id`, `from` and `to` as `{ list, index }`, `reason`). It is called in a change of its own, so it may be an action that saves: the lists show the new order until it has run, then the value you hold (your guess, or the old order until you write the new one). |
| `disabled` | `boolean` | `false` | Whether nothing in the group can be dragged. |
| `messages` | `Partial<SortableMessages>` |  | The texts announced while an item is moved, its handles' instructions and role description, over the English defaults. In a group these are used for every list; the roots' own `messages` are not. |
| `onSortStart` | `(details: SortableDragDetails) => void` |  | Called when an item is picked up, with the drag's details. In a group, only the group's callbacks are called. |
| `onSortMove` | `(details: SortableDragDetails) => void` |  | Called each time the place the dragged item would land changes, with that place as `to`. |
| `onSortEnd` | `(details: SortableDragDetails) => void` |  | Called on a drop, whether or not the order changed, with where the item landed as `to`. |
| `onSortCancel` | `(details: SortableDragDetails) => void` |  | Called when a drag is called off (Escape, a cancelled pointer, or focus leaving the handle mid-drag) and nothing moved. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the group is disabled. |
| `data-dragging` | Present while an item in one of its lists is dragged. |

## SortableRoot

Renders `<ul>`. One list: a `<ul>` that owns the order of its items, or, in a SortableGroup, shows the group's order for its `listId`. Render the items from the order, in that order: the list never moves them itself. Beside it (or, in a group, inside the group) sits a visually hidden element with the keyboard instructions and an assertive live region.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string[]` |  | The order: the ids of the items. Pass it with `onValueChange` to control the list. |
| `defaultValue` | `string[]` |  | The order at first, when it isn't controlled. The items then come from the order in the context: a small component inside the root reads `use sortable` and loops over `value`. |
| `onValueChange` | `(value: string[], details: SortableDragDetails) => void` |  | Called once per drop that changes the order, with the new order and the drag's details (`id`, `from` and `to` as `{ list, index }`, `reason`). Nothing is called while an item is carried. It is called in a change of its own, so it may be an action that saves: the list shows the new order until it has run, then the value you hold (your guess, or the old order until you write the new one). |
| `listId` | `string` | `""` | In a SortableGroup, which of the group's lists this is: a key of the group's `value`. |
| `orientation` | `SortableOrientation` | `"vertical"` | Whether the items run down (`vertical`) or along the inline direction (`horizontal`, right to left in a right-to-left page). It picks the arrow keys that move an item and the axis it is measured along. |
| `disabled` | `boolean` | `false` | Whether nothing in the list can be dragged and nothing can be dropped into it. |
| `messages` | `Partial<SortableMessages>` |  | The texts announced while an item is moved (`pickedUp`, `moved`, `dropped`, `cancelled`: functions of the item's label, its position, the list's size and label), the handles' `instructions` and `roleDescription`, over the English defaults. |
| `onSortStart` | `(details: SortableDragDetails) => void` |  | Called when an item is picked up, with the drag's details. Not called for a root in a group: give the group the callbacks. |
| `onSortMove` | `(details: SortableDragDetails) => void` |  | Called each time the place the dragged item would land changes, with that place as `to`. |
| `onSortEnd` | `(details: SortableDragDetails) => void` |  | Called on a drop, whether or not the order changed, with where the item landed as `to`. |
| `onSortCancel` | `(details: SortableDragDetails) => void` |  | Called when a drag is called off (Escape, a cancelled pointer, or focus leaving the handle mid-drag) and nothing moved. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the list is disabled. |
| `data-dragging` | While one of its items is dragged: `pointer` or `keyboard`, for what is dragging it. |
| `data-drop-target` | Present while the dragged item would land in this list. |
| `data-orientation` | The list's orientation: `vertical` or `horizontal`. |

## SortableItem

Renders `<li>`. An item, a `<li>`, identified by its `id`. It is never moved in the DOM during a drag: the dragged item and the items making way for it get an offset in CSS variables, which your `translate` applies. Without a SortableHandle inside it, the item is its own handle: it takes focus (`tabindex="0"`), is described by the instructions, and a press anywhere on it drags, except on a control inside it. A touch on such an item drags after a long press, so a swipe still scrolls.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id` (required) | `string` |  | The item's id in the list's order. Unique across a group. |
| `disabled` | `boolean` | `false` | Whether this item can't be dragged. It still makes way for others. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the item or its list is disabled. |
| `data-dragging` | On the item being dragged: `pointer` or `keyboard`. Animate a keyboard step with a transition; a pointer drag is followed as it is. |
| `data-drop-target` | On the item the dragged one would land beside: `before` it, or `after` it when that is the end of the list. For a drop indicator instead of a gap. |
| `data-orientation` | The list's orientation: `vertical` or `horizontal`. |
| `data-shifted` | Present on an item that makes way for the dragged one. Give these a `transition` on `translate`: the attribute goes as the drop changes the order, so nothing animates back. |

| CSS variable | Meaning |
| --- | --- |
| `--sortable-x` | The item's horizontal offset in px: how far the dragged item has been carried, or how far an item steps aside. `0px` at rest. |
| `--sortable-y` | The item's vertical offset in px, the same way. |

## SortableHandle

Renders `<button>`. A `<button>` that drags its item: Space or Enter picks the item up, and a press drags it once it moves a few pixels (a press that doesn't move is a click). It has `touch-action: none`, the messages' `roleDescription` as `aria-roledescription`, the instructions as its description, and `aria-pressed` while its item is dragged. Give it an `aria-label`. Disabled with its item or list.

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when its item or list is disabled. |
| `data-dragging` | Present while its item is dragged. |
