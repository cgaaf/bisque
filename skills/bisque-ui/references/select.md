# Select

A button that opens a list of options to choose a value from.

Source after `bisque-ui copy`: `<copy>/select/select.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { SelectRoot, SelectTrigger, SelectValue, SelectIcon, SelectPopup, SelectArrow, SelectItem, SelectItemText, SelectItemIndicator, SelectGroup, SelectGroupLabel, SelectSeparator } from "./bisque/select/select.rx"

<SelectRoot>
  <SelectTrigger>
    <SelectValue />
    <SelectIcon />
  </SelectTrigger>
  <SelectPopup>
    <SelectArrow />
    <SelectItem>
      <SelectItemIndicator />
      <SelectItemText />
    </SelectItem>
    <SelectSeparator />
    <SelectGroup>
      <SelectGroupLabel />
      <SelectItem />
    </SelectGroup>
  </SelectPopup>
</SelectRoot>
```

## SelectRoot

Renders no element of its own. Holds the selected value and the open state, and shares them with the parts inside it. With a `name`, or inside a FieldRoot, it renders a hidden input so the value is submitted with its form.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string \| null` |  | The selected value, or `null` for none. Pass it with `onValueChange` to control the selection. |
| `defaultValue` | `string \| null` |  | The value selected at first, when the selection isn't controlled. |
| `onValueChange` | `(value: string \| null) => void` |  | Called with the new value when an item is chosen. |
| `multiple` | `boolean` | `false` | Whether any number of values may be selected. The selection is then read and written through `values`, `defaultValues` and `onValuesChange`, choosing an item toggles it, and the popup stays open. |
| `values` | `string[]` |  | With `multiple`: the selected values. Pass it with `onValuesChange` to control the selection. |
| `defaultValues` | `string[]` |  | With `multiple`: the values selected at first, when the selection isn't controlled. |
| `onValuesChange` | `(values: string[]) => void` |  | With `multiple`: called with the new list of values when an item is toggled. |
| `open` | `boolean` |  | Whether the popup is open. Pass it with `onOpenChange` to control it. |
| `defaultOpen` | `boolean` | `false` | Whether the popup is open at first, when it isn't controlled. |
| `onOpenChange` | `(open: boolean) => void` |  | Called after the browser or a part opened or closed the popup. A press outside and Escape can't be refused: a controlled select that keeps `open` true is shown again. |
| `disabled` | `boolean` | `false` | Whether the select is disabled: the trigger is a disabled button and can't open the popup. A disabled FieldRoot around it disables it too. |
| `readOnly` | `boolean` | `false` | Whether the popup can be opened and browsed while nothing in it can be selected. |
| `required` | `boolean` | `false` | Whether a value must be selected for the form to be valid. |
| `name` | `string` |  | The name the value is submitted under. With `multiple`, each selected value is submitted as its own entry. Inside a named FieldRoot, the field's name is used. |
| `items` | `SelectItemLabel[]` |  | The label of each value, as `{ value, label }` pairs: what SelectValue shows for a value whose item hasn't rendered yet, or whose text differs from what the trigger should say. |
| `loading` | `boolean` | `false` | Whether the options are being fetched: pass `pending? fruits` (and `fruits == null` before the first answer) for `fruits = await loadFruits()`. The popup is `aria-busy`, the parts carry `data-loading`, and `SelectValue` shows nothing for a value whose label isn't known yet, rather than the raw value. Opened before the options arrive, focus waits on the popup and moves to the selected (or first) item when they do. |

## SelectTrigger

Renders `<button>`. The button that opens the popup, with `role="combobox"`. Its `popovertarget` makes the browser open and close the popup on a click, Enter and Space; ArrowDown and ArrowUp open it too, and typing on it while closed selects the matching item without opening.

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Present once the field's value has changed. |
| `data-disabled` | Present when the select is disabled. |
| `data-filled` | Present when the field has a value. |
| `data-focused` | Present while the field has focus. |
| `data-invalid` | Present when the field is invalid. |
| `data-loading` | Present while the root's `loading` is true. |
| `data-placeholder` | Present while no value is selected. |
| `data-popup-open` | Present while the popup is open. |
| `data-readonly` | Present when the select is read-only. |
| `data-required` | Present when the select is required. |
| `data-touched` | Present once the field has been focused and left. |
| `data-valid` | Present when the field is valid. |

## SelectValue

Renders `<span>`. Shows the selected item's label, the labels joined by ", " with `multiple`, or the placeholder while nothing is selected.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `placeholder` | `string` |  | The text shown while nothing is selected. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the select is disabled. |
| `data-loading` | Present while the root's `loading` is true. |
| `data-placeholder` | Present while no value is selected, so the placeholder can be styled. |
| `data-popup-open` | Present while the popup is open. |
| `data-readonly` | Present when the select is read-only. |
| `data-required` | Present when the select is required. |

## SelectIcon

Renders `<span>`. A decoration beside the value, such as a chevron. It is hidden from assistive technology.

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the select is disabled. |
| `data-loading` | Present while the root's `loading` is true. |
| `data-placeholder` | Present while no value is selected. |
| `data-popup-open` | Present while the popup is open, for turning the icon. |
| `data-readonly` | Present when the select is read-only. |
| `data-required` | Present when the select is required. |

## SelectPopup

Renders `<div>`. The list of options, with `role="listbox"`: an element with `popover="auto"`, placed against the trigger with CSS anchor positioning and at least as wide as it (`min-width: anchor-size(width)`). The browser closes it on Escape and on a press outside; Tab closes it too. Style it with `:popover-open` and `@starting-style`. It stays in the document while closed.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `side` | `"top" \| "bottom" \| "left" \| "right"` | `"bottom"` | Which side of the trigger the popup sits on. The browser flips it to the other side when it doesn't fit. |
| `align` | `"start" \| "center" \| "end"` | `"start"` | Which edge of the trigger the popup lines up with. |
| `sideOffset` | `number` | `0` | The gap between the trigger and the popup, in pixels. |
| `alignOffset` | `number` | `0` | How far the popup is moved along the trigger's edge from its `align` position, in pixels. |

| Data attribute | Meaning |
| --- | --- |
| `data-loading` | Present while the root's `loading` is true; the popup is `aria-busy` then too. |
| `data-side` | Which side of the trigger the popup is on: the one asked for until it opens, then the one the browser placed it on. |

## SelectItem

Renders `<div>`. An option in the list. A click, Enter or Space chooses it; the pointer and the arrow keys move focus to it, which highlights it.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` (required) | `string` |  | The value the item stands for: what is selected, submitted and passed to `onValueChange`. |
| `label` | `string` | `SelectItemText's text, else the item's` | The text that names the value, in SelectValue and for typeahead. Without it, SelectItemText's text is used, else the item's own. |
| `disabled` | `boolean` | `false` | Whether the item can't be chosen. It is skipped by the arrow keys and typeahead. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the item is disabled. |
| `data-highlighted` | Present while the item has focus, from the pointer or the keyboard. |
| `data-label` | The item's `label` prop, when it is given. |
| `data-selected` | Present when the item's value is selected. |
| `data-value` | The item's value. |

## SelectItemText

Renders `<span>`. The item's text. Use it when the item holds more than its label, such as an indicator, so SelectValue and typeahead read only the text.

## SelectItemIndicator

Renders `<span>`. Shown while its item is selected, such as a check mark. It is hidden from assistive technology.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `keepMounted` | `boolean` | `false` | Whether the indicator stays rendered while its item isn't selected, for drawing an empty box that `data-selected` fills. |

| Data attribute | Meaning |
| --- | --- |
| `data-selected` | Present when the item is selected. |

## SelectGroup

Renders `<div>`. Groups related items, with `role="group"`. The group is named by its SelectGroupLabel.

## SelectGroupLabel

Renders `<div>`. The heading of a group. The group's `aria-labelledby` points at it.

## SelectSeparator

Renders `<div>`. A line between items or groups, with `role="separator"`.

## SelectArrow

Renders `<div>`. An element placed on the popup's edge that faces the trigger, centred on the trigger. It follows the popup when the browser flips it. Give it a shape in CSS and turn it per `data-side`.

| Data attribute | Meaning |
| --- | --- |
| `data-side` | Which side of the trigger the popup is on. Absent until the popup first opens; a close keeps the last side. |
