# Menu

A list of actions in a popup, opened from a button and driven from the keyboard.

Source after `bisque-ui copy`: `<copy>/menu/menu.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { MenuRoot, MenuTrigger, MenuPopup, MenuArrow, MenuItem, MenuLinkItem, MenuSeparator, MenuGroup, MenuGroupLabel, MenuCheckboxItem, MenuRadioGroup, MenuRadioItem, MenuSubmenuRoot, MenuSubmenuTrigger } from "./bisque/menu/menu.rx"

<MenuRoot>
  <MenuTrigger />
  <MenuPopup>
    <MenuArrow />
    <MenuItem />
    <MenuLinkItem />
    <MenuSeparator />
    <MenuGroup>
      <MenuGroupLabel />
    </MenuGroup>
    <MenuCheckboxItem />
    <MenuRadioGroup>
      <MenuRadioItem />
    </MenuRadioGroup>
    <MenuSubmenuRoot>
      <MenuSubmenuTrigger />
      <MenuPopup />
    </MenuSubmenuRoot>
  </MenuPopup>
</MenuRoot>
```

## MenuRoot

Renders no element of its own. Holds the menu's open state and shares it with the parts inside it. Renders no element.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean` |  | Whether the menu is open. Pass it with `onOpenChange` to control the menu. |
| `defaultOpen` | `boolean` | `false` | Whether the menu is open at first, when it isn't controlled. |
| `onOpenChange` | `(open: boolean) => void` |  | Called with the new state after the browser or a part opened or closed the menu, and in a menubar whenever the bar opens or closes it (including moving to it with the arrow keys). Escape and a press outside can't be refused: a controlled menu that keeps `open` true is shown again. It is called in a change of its own, after the menu's: a request it starts, or a handler that is itself an action, doesn't hold the menu. |
| `disabled` | `boolean` | `false` | A disabled menu doesn't open, and its trigger is disabled. |

## MenuTrigger

Renders `<button>`. The button that opens and closes the menu. Its `popovertarget` keeps a press on it from counting as a press outside the open menu; the press itself is handled by the menu. Enter, Space and ArrowDown open the menu on its first item, ArrowUp on its last.

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the menu is disabled. |
| `data-popup-open` | Present while the menu is open. |

## MenuPopup

Renders `<div>`. The menu: an element with `popover="auto"` and the `menu` role, placed against the trigger with CSS anchor positioning. A submenu's popup is declared inside its parent's. Style it with `:popover-open` and `@starting-style`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `side` | `"top" \| "bottom" \| "left" \| "right"` | `"bottom"; "right" for a submenu and in a vertical menubar` | Which side of the trigger the popup sits on. The browser flips it when it doesn't fit. |
| `align` | `"start" \| "center" \| "end"` | `"start"` | Which edge of the trigger the popup lines up with, along the side. |
| `sideOffset` | `number` | `0` | The gap between the trigger and the popup, in pixels. |
| `alignOffset` | `number` | `0` | How far the popup is moved along the trigger's edge from its `align` position, in pixels. |

| Data attribute | Meaning |
| --- | --- |
| `data-side` | Which side of the trigger the popup is on: the `side` asked for, then the side the browser placed it on once open. |

## MenuItem

Renders `<div>`. An action in the menu. Choosing it with a press, Enter or Space runs its `onClick` and, by default, closes the menu.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `disabled` | `boolean` | `false` | A disabled item can't be chosen, and the arrow keys skip it. |
| `closeOnClick` | `boolean` | `true` | Whether choosing the item closes the menu and every menu it is nested in. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the item is disabled. |
| `data-highlighted` | Present while the item has the highlight: it has focus, from the keyboard or from the pointer moving over it. |

## MenuLinkItem

Renders `<a>`. A menu item that is a link. Enter follows it.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `closeOnClick` | `boolean` | `false` | Whether following the link closes the menu. Off by default, since the page usually changes anyway. |

| Data attribute | Meaning |
| --- | --- |
| `data-highlighted` | Present while the item has the highlight. |

## MenuCheckboxItem

Renders `<div>`. An item that toggles a setting on and off, with the `menuitemcheckbox` role. Choosing it leaves the menu open by default.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `checked` | `boolean` |  | Whether the item is checked. Pass it with `onCheckedChange` to control it. |
| `defaultChecked` | `boolean` | `false` | Whether the item is checked at first, when it isn't controlled. |
| `onCheckedChange` | `(checked: boolean) => void` |  | Called with the new state when the item is chosen. It is called in a change of its own, after the item's: a request it starts, or a handler that is itself an action, doesn't hold the menu. |
| `disabled` | `boolean` | `false` | A disabled item can't be chosen, and the arrow keys skip it. |
| `closeOnClick` | `boolean` | `false` | Whether choosing the item closes the menu. |

| Data attribute | Meaning |
| --- | --- |
| `data-checked` | Present when the item is checked. |
| `data-disabled` | Present when the item is disabled. |
| `data-highlighted` | Present while the item has the highlight. |
| `data-unchecked` | Present when the item is not checked. |

## MenuRadioGroup

Renders `<div>`. Groups radio items and holds which one is chosen.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string` |  | The value of the chosen item. Pass it with `onValueChange` to control the group. |
| `defaultValue` | `string` |  | The value chosen at first, when the group isn't controlled. |
| `onValueChange` | `(value: string) => void` |  | Called with the item's value when a radio item is chosen. It is called in a change of its own, after the group's: a request it starts, or a handler that is itself an action, doesn't hold the menu. |

## MenuRadioItem

Renders `<div>`. An item that chooses one value of its radio group, with the `menuitemradio` role. Choosing it leaves the menu open by default.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` (required) | `string` |  | The value the item stands for in its group. |
| `disabled` | `boolean` | `false` | A disabled item can't be chosen, and the arrow keys skip it. |
| `closeOnClick` | `boolean` | `false` | Whether choosing the item closes the menu. |

| Data attribute | Meaning |
| --- | --- |
| `data-checked` | Present when the item is the group's chosen one. |
| `data-disabled` | Present when the item is disabled. |
| `data-highlighted` | Present while the item has the highlight. |
| `data-unchecked` | Present when another item, or none, is chosen. |

## MenuGroup

Renders `<div>`. Groups related items. A `MenuGroupLabel` inside it names the group.

## MenuGroupLabel

Renders `<div>`. A label for its group: the group's `aria-labelledby` points at it. It isn't an item, so the keyboard skips it.

## MenuSeparator

Renders `<div>`. A line between items or groups, with the `separator` role.

## MenuSubmenuRoot

Renders no element of its own. A menu inside a menu. It holds a `MenuSubmenuTrigger`, which is an item of the parent menu, and the submenu's own `MenuPopup`, declared inside the parent's popup. Renders no element.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean` |  | Whether the submenu is open. Pass it with `onOpenChange` to control it. |
| `defaultOpen` | `boolean` | `false` | Whether the submenu is open at first, when it isn't controlled. |
| `onOpenChange` | `(open: boolean) => void` |  | Called with the new state when the submenu opens or closes, including when the browser closes it with its parent. It is called in a change of its own, after the submenu's: a request it starts, or a handler that is itself an action, doesn't hold the submenu. |
| `disabled` | `boolean` | `false` | A disabled submenu doesn't open. It is also disabled when its parent menu is. |

## MenuSubmenuTrigger

Renders `<button>`. The item of the parent menu that opens the submenu: on hover after a delay, on a press, and on ArrowRight, Enter and Space, which also move focus into it. Render it as a `<button>`, as the part does.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `disabled` | `boolean` | `false` | A disabled trigger doesn't open its submenu, and the arrow keys skip it. |
| `openOnHover` | `boolean` | `true` | Whether resting the pointer on the trigger opens the submenu. |
| `delay` | `number` | `100` | How long the pointer rests on the trigger before the submenu opens, in milliseconds. |
| `closeDelay` | `number` | `0` | How long after the pointer leaves, other than towards the submenu, before the submenu closes, in milliseconds. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the trigger is disabled. |
| `data-highlighted` | Present while the trigger has the highlight. |
| `data-popup-open` | Present while the submenu is open. |

## MenuArrow

Renders `<div>`. An element placed on the popup's edge that faces the trigger, centred on the trigger. It follows the popup when the browser flips it. Give it a shape in CSS and turn it per `data-side`.

| Data attribute | Meaning |
| --- | --- |
| `data-side` | Which side of the trigger the popup is on. Absent until the menu first opens; a close keeps the last side. |
