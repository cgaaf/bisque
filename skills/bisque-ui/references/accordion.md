# Accordion

A set of collapsible panels with headings.

Source after `bisque-ui copy`: `<copy>/accordion/accordion.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { AccordionRoot, AccordionItem, AccordionTrigger, AccordionPanel } from "./bisque/accordion/accordion.rx"

<AccordionRoot>
  <AccordionItem>
    <AccordionTrigger />
    <AccordionPanel />
  </AccordionItem>
</AccordionRoot>
```

## AccordionRoot

Renders `<div>`. Holds which items are open and shares it with the items inside it.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string[]` |  | The values of the open items. Pass it with `onValueChange` to control the accordion. |
| `defaultValue` | `string[]` |  | The values of the items open at first, when it isn't controlled. |
| `onValueChange` | `(value: string[]) => void` |  | Called with the new list of open values when a trigger asks to open or close an item, and after the browser opened one by itself for find-in-page. A controlled accordion follows `value`. It is called in a change of its own, after the component's: a handler that starts a request, writes what a loading question reads, or is an action that awaits, never holds the component. |
| `multiple` | `boolean` | `false` | Whether several items can be open at once. Without it, opening an item closes the open one, which animates out. |
| `disabled` | `boolean` | `false` | Whether every item is disabled. |
| `orientation` | `AccordionOrientation` | `"vertical"` | Which arrow keys move focus between triggers: Up and Down when `vertical`, Left and Right when `horizontal`. |
| `loopFocus` | `boolean` | `true` | Whether the arrow keys wrap from the last trigger to the first and back. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the accordion is disabled. |
| `data-orientation` | The accordion's orientation: `vertical` or `horizontal`. |

## AccordionItem

Renders `<details>`. One item: a `<details>` element holding a trigger and a panel. Style it with `[open]`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string` | `a generated id` | Identifies the item in the root's `value`. Without it the item gets a generated value. |
| `disabled` | `boolean` | `false` | Whether the item is disabled: its trigger ignores presses and keys, leaves the tab order and is skipped by the arrow keys. Find-in-page still opens it. |
| `onOpenChange` | `(open: boolean) => void` |  | Called when the item is asked to open or close, before the root's `onValueChange`. It is called in a change of its own, after the component's: a handler that starts a request, writes what a loading question reads, or is an action that awaits, never holds the component. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the item, or the whole accordion, is disabled. |
| `data-orientation` | The accordion's orientation: `vertical` or `horizontal`. |

## AccordionTrigger

Renders `<summary>`. The `<summary>` that opens and closes its item. It must be the item's first child; put a heading inside it rather than around it. A press asks the root rather than toggling the element, so a controlled `value` decides.

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the item, or the whole accordion, is disabled. |
| `data-orientation` | The accordion's orientation: `vertical` or `horizontal`. |

## AccordionPanel

Renders `<div>`. The item's content, hidden by the browser while the item is closed. It has the `region` role and is labelled by its trigger. Its measured size is written to CSS variables for animating its height.

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the item, or the whole accordion, is disabled. |
| `data-ending-style` | Present while the panel animates out. The item stays open until the panel's transitions and animations finish. |
| `data-orientation` | The accordion's orientation: `vertical` or `horizontal`. |

| CSS variable | Meaning |
| --- | --- |
| `--accordion-panel-height` | The panel's content height: in px while it opens and closes, `auto` once it is open. |
| `--accordion-panel-width` | The panel's content width: in px while it opens and closes, `auto` once it is open. |
