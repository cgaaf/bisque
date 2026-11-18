# Autocomplete

A text input that suggests what to type.

Source after `bisque-ui copy`: `<copy>/autocomplete/autocomplete.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { AutocompleteRoot, AutocompleteInput, AutocompleteTrigger, AutocompleteClear, AutocompleteValue, AutocompletePopup, AutocompleteArrow, AutocompleteStatus, AutocompleteEmpty, AutocompleteList, AutocompleteItem, AutocompleteSeparator, AutocompleteGroup, AutocompleteGroupLabel } from "./bisque/autocomplete/autocomplete.rx"

<AutocompleteRoot>
  <AutocompleteInput />
  <AutocompleteTrigger />
  <AutocompleteClear />
  <AutocompleteValue />

  <AutocompletePopup>
    <AutocompleteArrow />
    <AutocompleteStatus />
    <AutocompleteEmpty />
    <AutocompleteList>
      <AutocompleteItem />
      <AutocompleteSeparator />
      <AutocompleteGroup>
        <AutocompleteGroupLabel />
        <AutocompleteItem />
      </AutocompleteGroup>
    </AutocompleteList>
  </AutocompletePopup>
</AutocompleteRoot>
```

## AutocompleteRoot

Renders no element of its own. Holds the input's text and the open state, and shares them with the parts inside it through Combobox's `combobox` context.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string` |  | The input's text. Pass it with `onValueChange` to control it. |
| `defaultValue` | `string` | `""` | The input's text at first, when `value` isn't controlled. |
| `onValueChange` | `(value: string) => void` |  | Called with the input's new text: what was typed, or a suggestion's label once chosen. An inline preview isn't reported until it is chosen. |
| `mode` | `AutocompleteMode` | `"list"` | How the input completes what is typed: `"list"` filters the suggestions; `"inline"` shows the highlighted suggestion in the input; `"both"` does both; `"none"` neither. It is also the input's `aria-autocomplete`. |
| `open` | `boolean` |  | Whether the popup is open. Pass it with `onOpenChange` to control it. |
| `defaultOpen` | `boolean` | `false` | Whether the popup is open at first, when `open` isn't controlled. |
| `onOpenChange` | `(open: boolean) => void` |  | Called after the popup opened or closed, whatever closed it. |
| `filter` | `(label: string, query: string) => boolean` | `case- and accent-insensitive "contains"` | Whether a suggestion labelled `label` matches what was typed. |
| `autoHighlight` | `boolean` | `false` | Highlight the first matching suggestion as the user types. |
| `loop` | `boolean` | `true` | Whether the arrow keys go from the last suggestion back to the input, and on to the first. |
| `openOnInputClick` | `boolean` | `false` | Whether a click in the input opens the list. |
| `disabled` | `boolean` | `false` | Whether the autocomplete is disabled. Also disabled inside a disabled `FieldRoot`. |
| `readOnly` | `boolean` | `false` | Whether the text can't be changed. The popup doesn't open. |
| `required` | `boolean` | `false` | Whether the input must have text for the form to submit. Validated by an enclosing `FieldRoot`. |
| `loading` | `boolean` | `false` | Whether the suggestions are being fetched: pass `pending? results` (and `results == null` before the first answer) for `results = await search(value)`. `AutocompleteEmpty` stays empty, the list is `aria-busy`, and the popup and list carry `data-loading`. |

## AutocompleteInput

Renders `<input>`. The text input, with `role="combobox"`. Its text is the value: give it a `name` to submit it with a form. Typing opens the popup; the arrow keys move the highlight while focus stays here; Enter chooses the highlighted suggestion.

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Present once the field's value has changed. |
| `data-disabled` | Present when the autocomplete is disabled. |
| `data-filled` | Present when the field has a value. |
| `data-focused` | Present while the field has focus. |
| `data-invalid` | Present when the field is invalid. |
| `data-popup-open` | Present while the popup is open. |
| `data-readonly` | Present when the autocomplete is read-only. |
| `data-required` | Present when text is required. |
| `data-touched` | Present once the field has been focused and left. |
| `data-valid` | Present when the field is valid. |

## AutocompleteTrigger

Renders `<button>`. A button beside the input that opens and closes the popup and leaves focus in the input. It isn't a Tab stop. Give it an `aria-label`.

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the autocomplete is disabled. |
| `data-popup-open` | Present while the popup is open. |
| `data-readonly` | Present when the autocomplete is read-only. |
| `data-required` | Present when text is required. |

## AutocompleteClear

Renders `<button>`. A button that empties the input and focuses it. It is rendered only while the input has text, and isn't a Tab stop. Give it an `aria-label`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `keepMounted` | `boolean` | `false` | Whether to render the button while the input is empty. Default: false. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the autocomplete is disabled. |
| `data-popup-open` | Present while the popup is open. |
| `data-readonly` | Present when the autocomplete is read-only. |
| `data-required` | Present when text is required. |

## AutocompleteValue

Renders `<span>`. The input's text, shown somewhere else, or the placeholder while it is empty.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `placeholder` | `string` |  | Shown while the input is empty (the part then carries `data-placeholder`). |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the autocomplete is disabled. |
| `data-placeholder` | Present while the input is empty and the placeholder is shown. |
| `data-popup-open` | Present while the popup is open. |
| `data-readonly` | Present when the autocomplete is read-only. |
| `data-required` | Present when text is required. |

## AutocompletePopup

Renders `<div>`. The popup: an element with `popover="manual"`, placed against the input with CSS anchor positioning and at least as wide as it. Style it with `:popover-open` and `@starting-style`. A press inside it keeps focus in the input.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `side` | `"top" \| "bottom" \| "left" \| "right"` | `"bottom"` | Which side of the input it sits on; the browser flips it when it doesn't fit. Default: `"bottom"`. |
| `align` | `"start" \| "center" \| "end"` | `"start"` | Which edge of the input it lines up with. Default: `"start"`. |
| `sideOffset` | `number` | `0` | Gap between input and popup, in pixels. Default: 0. |
| `alignOffset` | `number` | `0` | How far the popup is moved along the input's edge from its `align` position, in pixels. Default: 0. |

| Data attribute | Meaning |
| --- | --- |
| `data-empty` | Present while no suggestion matches what was typed. |
| `data-loading` | Present while the root's `loading` is true. |
| `data-side` | Which side of the input the popup is on: the one asked for, then the one the browser placed it on. |

## AutocompleteList

Renders `<div>`. The listbox that holds the suggestions. The input's `aria-controls` points at it.

| Data attribute | Meaning |
| --- | --- |
| `data-empty` | Present while no suggestion matches what was typed. |
| `data-loading` | Present while the root's `loading` is true; the list is `aria-busy` then too. |

## AutocompleteItem

Renders `<div>`. A suggestion. Choosing it fills the input with its label and closes the popup. It isn't rendered while it doesn't match what was typed (modes `"list"` and `"both"`).

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` (required) | `string` |  | Identifies the suggestion. The input is filled with its label, not this. |
| `label` | `string` | `the option's text` | The text the filter matches and the input is filled with. Default: the suggestion's text. |
| `disabled` | `boolean` | `false` | Whether the suggestion can't be highlighted or chosen. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the part is disabled. |
| `data-highlighted` | Present while the suggestion is highlighted: the input's `aria-activedescendant`. |
| `data-label` | The suggestion's label. |
| `data-selected` | Never present on a suggestion: an autocomplete has no selection. |
| `data-value` | The suggestion's `value`. |

## AutocompleteGroup

Renders `<div>`. Groups related suggestions under an `AutocompleteGroupLabel`. It gets `hidden` while none of its suggestions match.

## AutocompleteGroupLabel

Renders `<div>`. The heading of a group. The group's `aria-labelledby` points at it.

## AutocompleteEmpty

Renders `<div>`. A `role="status"` element whose children show while no suggestion is rendered, except while the root is `loading`. The element stays in the document, empty, otherwise.

## AutocompleteStatus

Renders `<div>`. A `role="status"` element with `aria-live="polite"`, for a message about the list, such as a result count.

## AutocompleteSeparator

Renders `<div>`. A horizontal `role="separator"` between suggestions or groups.

## AutocompleteArrow

Renders `<div>`. An element placed on the popup's edge that faces the input, centred on it. It follows the popup when the browser flips it. Give it a shape in CSS and turn it per `data-side`.

| Data attribute | Meaning |
| --- | --- |
| `data-side` | Which side of the input the popup is on. Absent until the popup first opens; a close keeps the last side. |
