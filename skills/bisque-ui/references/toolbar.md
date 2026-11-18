# Toolbar

A row of buttons and controls that is one stop for the Tab key.

Source after `bisque copy`: `<copy>/toolbar/toolbar.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { ToolbarRoot, ToolbarButton, ToolbarLink, ToolbarInput, ToolbarGroup, ToolbarSeparator } from "./bisque/toolbar/toolbar.rx"

<ToolbarRoot>
  <ToolbarButton />
  <ToolbarLink />
  <ToolbarSeparator />
  <ToolbarGroup>
    <ToolbarButton />
  </ToolbarGroup>
  <ToolbarInput />
</ToolbarRoot>
```

## ToolbarRoot

Renders `<div>`. The toolbar: a `<div>` with the `toolbar` role. It is one Tab stop; the arrow keys along its orientation move between its items, and Tab comes back to the item focused last.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `disabled` | `boolean` | `false` | Disables every item. Buttons and inputs stay focusable unless they set `focusableWhenDisabled={false}`. |
| `orientation` | `ToolbarOrientation` | `"horizontal"` | Whether the items run `horizontal`ly (ArrowLeft and ArrowRight move between them) or `vertical`ly (ArrowUp and ArrowDown). |
| `loopFocus` | `boolean` | `true` | Whether the arrow keys wrap around at the ends. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the toolbar is disabled. |
| `data-orientation` | The toolbar's orientation: `horizontal` or `vertical`. |

## ToolbarButton

Renders `<button>`. A `<button>` that is an item of the toolbar.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `disabled` | `boolean` | `false` | A disabled button does nothing when pressed, and its `onClick` isn't called. It is also disabled when its group or the toolbar is. |
| `focusableWhenDisabled` | `boolean` | `true` | Whether the button stays focusable while disabled, so the arrow keys still reach it. It then gets `aria-disabled` instead of the `disabled` attribute. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the button is disabled. |
| `data-focusable` | Present when the button stays focusable while disabled. |
| `data-orientation` | The toolbar's orientation: `horizontal` or `vertical`. |

## ToolbarLink

Renders `<a>`. An `<a>` that is an item of the toolbar. A link can't be disabled.

| Data attribute | Meaning |
| --- | --- |
| `data-orientation` | The toolbar's orientation: `horizontal` or `vertical`. |

## ToolbarInput

Renders `<input>`. An `<input>` that is an item of the toolbar. The arrow keys move its caret, and move to the next item only from the end of the text (or the previous one from its start); Home and End stay with the input.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `disabled` | `boolean` | `false` | A disabled input takes no typing. It is also disabled when its group or the toolbar is. |
| `focusableWhenDisabled` | `boolean` | `true` | Whether the input stays focusable while disabled. It then gets `aria-disabled` instead of the `disabled` attribute. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the input is disabled. |
| `data-focusable` | Present when the input stays focusable while disabled. |
| `data-orientation` | The toolbar's orientation: `horizontal` or `vertical`. |

## ToolbarGroup

Renders `<div>`. A `<div>` with the `group` role around related items. Name it with `aria-label`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `disabled` | `boolean` | `false` | Disables every item in the group. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the group is disabled. |
| `data-orientation` | The toolbar's orientation: `horizontal` or `vertical`. |

## ToolbarSeparator

Renders `<div>`. A `<div>` with the `separator` role that runs across the toolbar: vertical in a horizontal toolbar, horizontal in a vertical one.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `orientation` | `SeparatorOrientation` |  | The separator's own orientation, when it shouldn't run across the toolbar. |

| Data attribute | Meaning |
| --- | --- |
| `data-orientation` | The separator's orientation: `horizontal` or `vertical`. |
