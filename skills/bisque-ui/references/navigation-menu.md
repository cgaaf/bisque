# Navigation Menu

A site's main links, with panels of more links that open from it.

Source after `bisque copy`: `<copy>/navigation-menu/navigation-menu.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { NavigationMenuRoot, NavigationMenuList, NavigationMenuItem, NavigationMenuTrigger, NavigationMenuIcon, NavigationMenuContent, NavigationMenuArrow, NavigationMenuLink } from "./bisque/navigation-menu/navigation-menu.rx"

<NavigationMenuRoot>
  <NavigationMenuList>
    <NavigationMenuItem>
      <NavigationMenuTrigger>
        <NavigationMenuIcon />
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <NavigationMenuArrow />
        <NavigationMenuLink />
      </NavigationMenuContent>
    </NavigationMenuItem>
    <NavigationMenuItem>
      <NavigationMenuLink />
    </NavigationMenuItem>
  </NavigationMenuList>
</NavigationMenuRoot>
```

## NavigationMenuRoot

Renders `<nav>`. The `<nav>` that holds which item is open and shares it with the parts inside.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string \| null` |  | The open item's value, or `null` for none. Pass it with `onValueChange` to control the menu. |
| `defaultValue` | `string` |  | The item open at first, when the menu isn't controlled. |
| `onValueChange` | `(value: string \| null) => void` |  | Called once per change with the open item's value, or `null` when it closed, including when the browser closed it (Escape, a press outside). It is called in a change of its own, after the menu's: a request it starts, or a handler that is itself an action, doesn't hold the menu. |
| `orientation` | `NavigationMenuOrientation` | `"horizontal"` | Whether the list runs `horizontal`ly or `vertical`ly: which arrow keys move along it and which one opens an item. |
| `delay` | `number` | `50` | How long the pointer rests on a trigger before its content opens, in milliseconds. While another item is open, the switch is immediate. |
| `closeDelay` | `number` | `50` | How long after the pointer leaves the trigger and its content before the content closes, in milliseconds. |

| Data attribute | Meaning |
| --- | --- |
| `data-orientation` | The menu's orientation: `horizontal` or `vertical`. |

## NavigationMenuList

Renders `<ul>`. The `<ul>` of items. It is one Tab stop: the arrow keys along the orientation, Home and End move between its triggers and links, without wrapping.

| Data attribute | Meaning |
| --- | --- |
| `data-orientation` | The menu's orientation: `horizontal` or `vertical`. |

## NavigationMenuItem

Renders `<li>`. An `<li>` in the list: a link, or a trigger with its content.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string` | `a generated id` | Identifies the item; the root's `value` names the open one. Without it the item gets a generated id. |

## NavigationMenuTrigger

Renders `<button>`. The button that opens its item's content: on hover after the root's delay, on a press, and with ArrowDown (ArrowRight in a vertical menu), which also moves focus into it. Its `popovertarget` keeps a press on it from counting as a press outside the content.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `disabled` | `boolean` | `false` | A disabled trigger doesn't open its content on hover, press or keys. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the trigger is disabled. |
| `data-focusable` | Always present: tells the list's arrow keys to stop on the trigger even while it is disabled. |
| `data-popup-open` | Present while its content is open. |

## NavigationMenuIcon

Renders `<span>`. A `<span>` inside the trigger for a chevron or similar, hidden from assistive technology. It shows whether its item is open with `data-popup-open`.

| Data attribute | Meaning |
| --- | --- |
| `data-popup-open` | Present while its item's content is open. |

## NavigationMenuContent

Renders `<div>`. The item's panel: an element with `popover="auto"`, declared after the item's trigger and placed against it with CSS anchor positioning. Focus leaving it, other than to its trigger, closes it. Style it with `:popover-open` and `@starting-style`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `side` | `"top" \| "bottom" \| "left" \| "right"` | `"bottom"` | Which side of the trigger the content sits on. The browser flips it when it doesn't fit. |
| `align` | `"start" \| "center" \| "end"` | `"center"` | Which edge of the trigger the content lines up with, along the side. |
| `sideOffset` | `number` | `0` | The gap between the trigger and the content, in pixels. |
| `alignOffset` | `number` | `0` | How far the content is moved along the trigger's edge from its `align` position, in pixels. |

| Data attribute | Meaning |
| --- | --- |
| `data-activation-direction` | While the content is open after another item's was: where that item was, `left` or `right` (`up` or `down` in a vertical menu). |
| `data-side` | Which side of the trigger the content is on: the `side` asked for, then the side the browser placed it on once open. |

## NavigationMenuLink

Renders `<a>`. A link, in the list or in some content. In the list it is one of the arrow-key stops; in content it is an ordinary link.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `active` | `boolean` | `false` | Whether the link is the current page: it gets `aria-current="page"` and `data-active`. |
| `closeOnClick` | `boolean` | `false` | Whether following the link closes the open content. |

| Data attribute | Meaning |
| --- | --- |
| `data-active` | Present when the link is the current page. |

## NavigationMenuArrow

Renders `<div>`. An element placed on the content's edge that faces the trigger, centred on the trigger. It follows the content when the browser flips it. Give it a shape in CSS and turn it per `data-side`.

| Data attribute | Meaning |
| --- | --- |
| `data-side` | Which side of the trigger the content is on. Absent until the content first opens; a close keeps the last side. |
