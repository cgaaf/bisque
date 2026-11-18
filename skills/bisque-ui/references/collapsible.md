# Collapsible

A panel that its trigger shows and hides.

Source after `bisque copy`: `<copy>/collapsible/collapsible.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { CollapsibleRoot, CollapsibleTrigger, CollapsiblePanel } from "./bisque/collapsible/collapsible.rx"

<CollapsibleRoot>
  <CollapsibleTrigger />
  <CollapsiblePanel />
</CollapsibleRoot>
```

## CollapsibleRoot

Renders `<details>`. The `<details>` element. It holds the open state and shares it with the parts inside it. Style it with `[open]`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean` |  | Whether the panel is open. Pass it with `onOpenChange` to control the collapsible. |
| `defaultOpen` | `boolean` | `false` | Whether the panel is open at first, when it isn't controlled. |
| `onOpenChange` | `(open: boolean) => void` |  | Called when the trigger asks to open or close the panel, and after the browser opened it by itself for find-in-page. A controlled collapsible follows `open`, and is closed again if `open` stays false. It is called in a change of its own, after the component's: a handler that starts a request, writes what a loading question reads, or is an action that awaits, never holds the component. |
| `disabled` | `boolean` | `false` | Whether the trigger is disabled: it ignores presses and keys and leaves the tab order. Find-in-page still opens the panel. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the collapsible is disabled. |

## CollapsibleTrigger

Renders `<summary>`. The `<summary>` that opens and closes the panel. It must be the first child of the root. A press asks the root rather than toggling the element, so a controlled `open` decides.

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the collapsible is disabled. |

## CollapsiblePanel

Renders `<div>`. The content after the summary, hidden by the browser while the collapsible is closed. Its measured size is written to CSS variables for animating its height.

| Data attribute | Meaning |
| --- | --- |
| `data-ending-style` | Present while the panel animates out. The `<details>` stays open until the panel's transitions and animations finish. |

| CSS variable | Meaning |
| --- | --- |
| `--collapsible-panel-height` | The panel's content height: in px while it opens and closes, `auto` once it is open. |
| `--collapsible-panel-width` | The panel's content width: in px while it opens and closes, `auto` once it is open. |
