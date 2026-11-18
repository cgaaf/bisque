# Combobox

An input that filters a list of options to choose from.

Source after `bisque-ui copy`: `<copy>/combobox/combobox.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { ComboboxRoot, ComboboxInput, ComboboxTrigger, ComboboxClear, ComboboxValue, ComboboxChips, ComboboxChip, ComboboxChipRemove, ComboboxPopup, ComboboxArrow, ComboboxStatus, ComboboxEmpty, ComboboxList, ComboboxItem, ComboboxItemIndicator, ComboboxSeparator, ComboboxGroup, ComboboxGroupLabel } from "./bisque/combobox/combobox.rx"

<ComboboxRoot>
  <ComboboxInput />
  <ComboboxTrigger />
  <ComboboxClear />
  <ComboboxValue />

  <ComboboxChips>
    <ComboboxChip>
      <ComboboxChipRemove />
    </ComboboxChip>
    <ComboboxInput />
  </ComboboxChips>

  <ComboboxPopup>
    <ComboboxArrow />
    <ComboboxStatus />
    <ComboboxEmpty />
    <ComboboxList>
      <ComboboxItem>
        <ComboboxItemIndicator />
      </ComboboxItem>
      <ComboboxSeparator />
      <ComboboxGroup>
        <ComboboxGroupLabel />
        <ComboboxItem />
      </ComboboxGroup>
    </ComboboxList>
  </ComboboxPopup>
</ComboboxRoot>
```

## ComboboxRoot

Renders no element of its own. Holds the selection, the input's text and the open state, and shares them with the parts inside it through the `combobox` context.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string \| null` |  | Single selection: the selected value, null for none. |
| `defaultValue` | `string \| null` |  | The value selected at first, when `value` isn't controlled. |
| `onValueChange` | `(value: string \| null) => void` |  | Called with the new value when an option is chosen, the input is emptied or Clear is pressed (`null` for no selection). |
| `multiple` | `boolean` | `false` | Any number of values may be selected; they are then `values`, `defaultValues` and `onValuesChange`. |
| `values` | `string[]` |  | With `multiple`: the selected values. Pass it with `onValuesChange` to control them. |
| `defaultValues` | `string[]` |  | With `multiple`: the values selected at first, when `values` isn't controlled. |
| `onValuesChange` | `(values: string[]) => void` |  | With `multiple`: called with the new values when an option is toggled, a chip removed or the selection cleared. |
| `inputValue` | `string` |  | The input's text. By default it shows the selected option's label (single) or what was typed (multiple). |
| `defaultInputValue` | `string` |  | The input's text at first, when `inputValue` isn't controlled. |
| `onInputValueChange` | `(value: string) => void` |  | Called with the input's new text: what was typed, or the label shown after a choice. It is called in a change of its own, after the combobox has taken the text in, so a handler that starts a request (`query := text` read by `await search(query)`) doesn't hold the input, the popup or the highlight while the answer is out. |
| `open` | `boolean` |  | Whether the popup is open. Pass it with `onOpenChange` to control it. |
| `defaultOpen` | `boolean` | `false` | Whether the popup is open at first, when `open` isn't controlled. |
| `onOpenChange` | `(open: boolean) => void` |  | Called after the popup opened or closed, whatever closed it. |
| `filter` | `(label: string, query: string) => boolean` | `case- and accent-insensitive "contains"` | Whether an option labelled `label` matches what was typed. |
| `autoHighlight` | `boolean` | `false` | Highlight the first matching option as the user types. |
| `loop` | `boolean` | `true` | Whether the arrow keys go from the last option back to the input, and on to the first. |
| `openOnInputClick` | `boolean` | `true` | Whether a click in the input opens the list. |
| `disabled` | `boolean` | `false` | Whether the combobox is disabled. Also disabled inside a disabled `FieldRoot`. |
| `readOnly` | `boolean` | `false` | Whether the selection can't be changed. The popup doesn't open. |
| `required` | `boolean` | `false` | Whether a value must be selected for the form to submit. Validated by an enclosing `FieldRoot`. |
| `name` | `string` |  | With a name (or inside a named FieldRoot) the selected value is submitted with a <form>; with `multiple`, one entry per value. |
| `items` | `ComboboxItemLabel[]` |  | The label of each value, when it must be known before the option has rendered. |
| `loading` | `boolean` | `false` | Whether the options are being fetched: pass `pending? results` (and `results == null` before the first answer) for `results = await search(query)`. `ComboboxEmpty` stays empty, the list is `aria-busy`, and the popup and list carry `data-loading`. |

## ComboboxInput

Renders `<input>`. The text input, with `role="combobox"`. Typing filters the options and opens the popup; the arrow keys move the highlight while focus stays here; Enter chooses the highlighted option.

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Present once the field's value has changed. |
| `data-disabled` | Present when the combobox is disabled. |
| `data-filled` | Present when the field has a value. |
| `data-focused` | Present while the field has focus. |
| `data-invalid` | Present when the field is invalid. |
| `data-popup-open` | Present while the popup is open. |
| `data-readonly` | Present when the combobox is read-only. |
| `data-required` | Present when a value is required. |
| `data-touched` | Present once the field has been focused and left. |
| `data-valid` | Present when the field is valid. |

## ComboboxTrigger

Renders `<button>`. A button beside the input that opens and closes the popup and leaves focus in the input. It isn't a Tab stop. Give it an `aria-label`.

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the combobox is disabled. |
| `data-popup-open` | Present while the popup is open. |
| `data-readonly` | Present when the combobox is read-only. |
| `data-required` | Present when a value is required. |

## ComboboxClear

Renders `<button>`. A button that clears the selection and the input's text, then focuses the input. It is rendered only while there is something to clear, and isn't a Tab stop. Give it an `aria-label`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `keepMounted` | `boolean` | `false` | Whether to render the button while there is nothing to clear. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the combobox is disabled. |
| `data-popup-open` | Present while the popup is open. |
| `data-readonly` | Present when the combobox is read-only. |
| `data-required` | Present when a value is required. |

## ComboboxValue

Renders `<span>`. The selected option's label, or the labels joined by ", " with `multiple`. Use it to show the selection somewhere other than the input.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `placeholder` | `string` |  | Shown while nothing is selected (the value then carries `data-placeholder`). |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the combobox is disabled. |
| `data-placeholder` | Present while nothing is selected and the placeholder is shown. |
| `data-popup-open` | Present while the popup is open. |
| `data-readonly` | Present when the combobox is read-only. |
| `data-required` | Present when a value is required. |

## ComboboxPopup

Renders `<div>`. The popup: an element with `popover="manual"`, placed against the input (or `ComboboxChips`) with CSS anchor positioning and at least as wide as it. Style it with `:popover-open` and `@starting-style`. A press inside it keeps focus in the input.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `side` | `"top" \| "bottom" \| "left" \| "right"` | `"bottom"` | Which side of the input it sits on; the browser flips it when it doesn't fit. |
| `align` | `"start" \| "center" \| "end"` | `"start"` | Which edge of the input it lines up with. |
| `sideOffset` | `number` | `0` | Gap between input and popup, in pixels. |
| `alignOffset` | `number` | `0` | How far the popup is moved along the input's edge from its `align` position, in pixels. |

| Data attribute | Meaning |
| --- | --- |
| `data-empty` | Present while no option is rendered (none matches what was typed, or the answer had none). |
| `data-loading` | Present while the root's `loading` is true. |
| `data-side` | Which side of the input the popup is on: the one asked for, then the one the browser placed it on. |

## ComboboxList

Renders `<div>`. The listbox that holds the options. The input's `aria-controls` points at it.

| Data attribute | Meaning |
| --- | --- |
| `data-empty` | Present while no option is rendered (none matches what was typed, or the answer had none). |
| `data-loading` | Present while the root's `loading` is true; the list is `aria-busy` then too. |

## ComboboxItem

Renders `<div>`. An option. It isn't rendered while it doesn't match what was typed. A press or Enter while it is highlighted chooses it.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` (required) | `string` |  | The value the option stands for. |
| `label` | `string` | `the option's text` | The text the filter matches and the input shows once chosen. |
| `disabled` | `boolean` | `false` | Whether the option can't be highlighted or chosen. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the part is disabled. |
| `data-highlighted` | Present while the option is highlighted: the input's `aria-activedescendant`. |
| `data-label` | The option's label: what the filter matches and the input shows once chosen. |
| `data-selected` | Present while the option's value is selected. |
| `data-value` | The option's `value`. |

## ComboboxItemIndicator

Renders `<span>`. A mark (a check) shown while its option is selected. Hidden from assistive technology.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `keepMounted` | `boolean` | `false` | Whether to render it while the option isn't selected too; style it with `data-selected`. |

| Data attribute | Meaning |
| --- | --- |
| `data-selected` | Present while its option is selected. |

## ComboboxGroup

Renders `<div>`. Groups related options under a `ComboboxGroupLabel`. It gets `hidden` while none of its options match.

## ComboboxGroupLabel

Renders `<div>`. The heading of a group. The group's `aria-labelledby` points at it.

## ComboboxEmpty

Renders `<div>`. A `role="status"` element whose children show while no option is rendered, except while the root is `loading`: "no results" isn't shown for an answer that hasn't come. The element stays in the document, empty, otherwise.

## ComboboxStatus

Renders `<div>`. A `role="status"` element with `aria-live="polite"`, for a message about the list, such as a result count.

## ComboboxSeparator

Renders `<div>`. A horizontal `role="separator"` between options or groups.

## ComboboxChips

Renders `<div>`. With `multiple`: the container of the chips and the input. When it is there, the popup is anchored to it rather than to the input.

## ComboboxChip

Renders `<div>`. One selected value. Render one per value in the `combobox` context's `selected`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` (required) | `string` |  | The selected value the chip stands for. `ComboboxChipRemove` inside it removes this value. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the combobox is disabled. |
| `data-readonly` | Present when the combobox is read-only. |

## ComboboxChipRemove

Renders `<button>`. A button inside a chip that removes its value from the selection. It isn't a Tab stop. Give it an `aria-label`.

## ComboboxArrow

Renders `<div>`. An element placed on the popup's edge that faces the input, centred on it. It follows the popup when the browser flips it. Give it a shape in CSS and turn it per `data-side`.

| Data attribute | Meaning |
| --- | --- |
| `data-side` | Which side of the input the popup is on. Absent until the popup first opens; a close keeps the last side. |
