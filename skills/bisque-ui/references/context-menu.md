# Context Menu

A menu that opens at the pointer on a right-click or a long press.

Source after `bisque copy`: `<copy>/context-menu/context-menu.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { ContextMenuRoot, ContextMenuTrigger, ContextMenuPopup, ContextMenuItem, ContextMenuLinkItem, ContextMenuSeparator, ContextMenuGroup, ContextMenuGroupLabel, ContextMenuCheckboxItem, ContextMenuRadioGroup, ContextMenuRadioItem, ContextMenuSubmenuRoot, ContextMenuSubmenuTrigger } from "./bisque/context-menu/context-menu.rx"

<ContextMenuRoot>
  <ContextMenuTrigger />
  <ContextMenuPopup>
    <ContextMenuItem />
    <ContextMenuLinkItem />
    <ContextMenuSeparator />
    <ContextMenuGroup>
      <ContextMenuGroupLabel />
    </ContextMenuGroup>
    <ContextMenuCheckboxItem />
    <ContextMenuRadioGroup>
      <ContextMenuRadioItem />
    </ContextMenuRadioGroup>
    <ContextMenuSubmenuRoot>
      <ContextMenuSubmenuTrigger />
      <ContextMenuPopup />
    </ContextMenuSubmenuRoot>
  </ContextMenuPopup>
</ContextMenuRoot>
```

## ContextMenuRoot

Renders no element of its own. Holds the context menu's open state and shares it with the parts inside it. It is a `MenuRoot`. Renders no element.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean` |  | Whether the menu is open. Pass it with `onOpenChange` to control the menu. |
| `defaultOpen` | `boolean` | `false` | Whether the menu is open at first, when it isn't controlled. Default: false. |
| `onOpenChange` | `(open: boolean) => void` |  | Called with the new state after the browser or a part opened or closed the menu. It is called in a change of its own, after the menu's: a request it starts, or a handler that is itself an action, doesn't hold the menu. |
| `disabled` | `boolean` | `false` | A disabled context menu doesn't open, and the browser's own menu shows instead. |

## ContextMenuTrigger

Renders `<div>`. The area that opens the menu: on a right-click at the pointer, on a long press at the finger, and on the context-menu key or Shift+F10 below the focused element inside it. It holds the empty, fixed-position element the popup is anchored to. The area isn't focusable itself.

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the context menu is disabled. |
| `data-popup-open` | Present while the menu is open. |

## ContextMenuPopup

Renders `<div>`. The menu: a `MenuPopup`, an element with `popover="auto"` and the `menu` role, placed below and to the right of the point it opened at. A submenu's popup is also a `ContextMenuPopup`, declared inside its parent's.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `side` | `"top" \| "bottom" \| "left" \| "right"` | `"bottom"; "right" for a submenu and in a vertical menubar` | Which side of the point the popup sits on. The browser flips it when it doesn't fit. |
| `align` | `"start" \| "center" \| "end"` | `"start"` | Which way from the point the popup extends, along the side. |
| `sideOffset` | `number` | `0` | The gap between the point and the popup, in pixels. |
| `alignOffset` | `number` | `0` | How far the popup is moved along the side from its `align` position, in pixels. |

| Data attribute | Meaning |
| --- | --- |
| `data-side` | Which side of the point the popup is on: the `side` asked for, then the side the browser placed it on once open. |

## ContextMenuItem

Renders `<div>`. An action in the menu: a `MenuItem`. Choosing it runs its `onClick` and, by default, closes the menu.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `disabled` | `boolean` | `false` | A disabled item can't be chosen, and the arrow keys skip it. Default: false. |
| `closeOnClick` | `boolean` | `true` | Whether choosing the item closes the menu and every menu it is nested in. Default: true. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the item is disabled. |
| `data-highlighted` | Present while the item has the highlight. |

## ContextMenuLinkItem

Renders `<a>`. A menu item that is a link: a `MenuLinkItem`. Enter follows it.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `closeOnClick` | `boolean` | `false` | Whether following the link closes the menu. Default: false. |

| Data attribute | Meaning |
| --- | --- |
| `data-highlighted` | Present while the item has the highlight. |

## ContextMenuCheckboxItem

Renders `<div>`. An item that toggles a setting on and off: a `MenuCheckboxItem`. Choosing it leaves the menu open by default.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `checked` | `boolean` |  | Whether the item is checked. Pass it with `onCheckedChange` to control it. |
| `defaultChecked` | `boolean` | `false` | Whether the item is checked at first, when it isn't controlled. Default: false. |
| `onCheckedChange` | `(checked: boolean) => void` |  | Called with the new state when the item is chosen. It is called in a change of its own, after the item's: a request it starts, or a handler that is itself an action, doesn't hold the menu. |
| `disabled` | `boolean` | `false` | A disabled item can't be chosen, and the arrow keys skip it. Default: false. |
| `closeOnClick` | `boolean` | `false` | Whether choosing the item closes the menu. Default: false. |

| Data attribute | Meaning |
| --- | --- |
| `data-checked` | Present when the item is checked. |
| `data-disabled` | Present when the item is disabled. |
| `data-highlighted` | Present while the item has the highlight. |
| `data-unchecked` | Present when the item is not checked. |

## ContextMenuRadioGroup

Renders `<div>`. Groups radio items and holds which one is chosen: a `MenuRadioGroup`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string` |  | The value of the chosen item. Pass it with `onValueChange` to control the group. |
| `defaultValue` | `string` |  | The value chosen at first, when the group isn't controlled. |
| `onValueChange` | `(value: string) => void` |  | Called with the item's value when a radio item is chosen. It is called in a change of its own, after the group's: a request it starts, or a handler that is itself an action, doesn't hold the menu. |

## ContextMenuRadioItem

Renders `<div>`. An item that chooses one value of its radio group: a `MenuRadioItem`. Choosing it leaves the menu open by default.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` (required) | `string` |  | The value the item stands for in its group. |
| `disabled` | `boolean` | `false` | A disabled item can't be chosen, and the arrow keys skip it. Default: false. |
| `closeOnClick` | `boolean` | `false` | Whether choosing the item closes the menu. Default: false. |

| Data attribute | Meaning |
| --- | --- |
| `data-checked` | Present when the item is the group's chosen one. |
| `data-disabled` | Present when the item is disabled. |
| `data-highlighted` | Present while the item has the highlight. |
| `data-unchecked` | Present when another item, or none, is chosen. |

## ContextMenuGroup

Renders `<div>`. Groups related items: a `MenuGroup`. A `ContextMenuGroupLabel` inside it names the group.

## ContextMenuGroupLabel

Renders `<div>`. A label for its group: a `MenuGroupLabel`, which the group's `aria-labelledby` points at.

## ContextMenuSeparator

Renders `<div>`. A line between items or groups, with the `separator` role: a `MenuSeparator`.

## ContextMenuSubmenuRoot

Renders no element of its own. A menu inside the context menu: a `MenuSubmenuRoot`. It holds a `ContextMenuSubmenuTrigger` and the submenu's own `ContextMenuPopup`. Renders no element.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean` |  | Whether the submenu is open. Pass it with `onOpenChange` to control it. |
| `defaultOpen` | `boolean` | `false` | Whether the submenu is open at first, when it isn't controlled. Default: false. |
| `onOpenChange` | `(open: boolean) => void` |  | Called with the new state when the submenu opens or closes. It is called in a change of its own, after the submenu's: a request it starts, or a handler that is itself an action, doesn't hold the submenu. |
| `disabled` | `boolean` | `false` | A disabled submenu doesn't open. Default: false. |

## ContextMenuSubmenuTrigger

Renders `<button>`. The item that opens the submenu: a `MenuSubmenuTrigger`. It opens on hover, on a press, and on ArrowRight, Enter and Space.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `disabled` | `boolean` | `false` | A disabled trigger doesn't open its submenu. Default: false. |
| `openOnHover` | `boolean` | `true` | Whether resting the pointer on the trigger opens the submenu. Default: true. |
| `delay` | `number` | `100` | How long the pointer rests on the trigger before the submenu opens, in milliseconds. Default: 100. |
| `closeDelay` | `number` | `0` | How long after the pointer leaves, other than towards the submenu, before it closes, in milliseconds. Default: 0. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the trigger is disabled. |
| `data-highlighted` | Present while the trigger has the highlight. |
| `data-popup-open` | Present while the submenu is open. |
