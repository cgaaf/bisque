# Listbox

An always-visible list of options to select one or several from.

Source after `bisque copy`: `<copy>/listbox/listbox.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { ListboxRoot, ListboxItem, ListboxItemText, ListboxItemIndicator, ListboxGroup, ListboxGroupLabel } from "./bisque/listbox/listbox.rx"

<ListboxRoot>
  <ListboxItem>
    <ListboxItemIndicator />
    <ListboxItemText />
  </ListboxItem>
  <ListboxGroup>
    <ListboxGroupLabel />
    <ListboxItem />
  </ListboxGroup>
</ListboxRoot>
```

## ListboxRoot

Renders `<div>`. The list itself, with `role="listbox"`: it holds the selection, moves focus between the options and shares the state with the parts inside it. Label it with `aria-label` or `aria-labelledby`, or put it in a FieldRoot. With a `name`, or inside a FieldRoot, it renders hidden inputs beside the list so the value is submitted with its form.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string \| string[] \| null` |  | The selected value: a string, or `null` for none; with `multiple`, a list of strings. Pass it with `onValueChange` to control the selection. |
| `defaultValue` | `string \| string[] \| null` |  | The value selected at first, when the selection isn't controlled: a string, or a list of strings with `multiple`. A form reset puts it back. |
| `onValueChange` | `(value: any) => void` |  | Called with the new value: a string with single selection, a list of strings with `multiple`. It runs in a change of its own, so a handler that saves to a server doesn't hold the list. |
| `multiple` | `boolean` | `false` | Whether any number of options may be selected. A click, Space and Enter then toggle an option, Shift+click and Shift+Space select a range, and Ctrl/Cmd+A selects them all. |
| `disabled` | `boolean` | `false` | Whether the list is disabled: no option can be selected or reached with Tab. A disabled FieldRoot around it disables it too. |
| `required` | `boolean` | `false` | Whether a value must be selected for the form to be valid. |
| `name` | `string` |  | The name the value is submitted under. With `multiple`, each selected value is submitted as its own entry. Inside a named FieldRoot, the field's name is used. |
| `orientation` | `ListboxOrientation` | `"vertical"` | Which arrow keys move focus: Up and Down, or Left and Right. |
| `loop` | `boolean` | `false` | Whether the arrow keys wrap around at the ends. |
| `selectionFollowsFocus` | `boolean` | `false` | Single selection only: moving focus with the keyboard selects the option it reaches. |

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Present once the field's value has changed. |
| `data-disabled` | Present when the list is disabled. |
| `data-filled` | Present when the field has a value. |
| `data-focused` | Present while the field has focus. |
| `data-invalid` | Present when the field is invalid. |
| `data-multiple` | Present when `multiple`. |
| `data-orientation` | The orientation: `horizontal` or `vertical`. |
| `data-touched` | Present once the field has been focused and left. |
| `data-valid` | Present when the field is valid. |

## ListboxItem

Renders `<div>`. An option, with `role="option"` and `aria-selected`. It takes real focus: style the focused option with `:focus-visible`. Its `tabindex` is written by the list, which keeps one option the Tab stop.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` (required) | `string` |  | The value the option stands for: what is selected, reported and submitted. |
| `label` | `string` | `the option's text, leaving out what is `aria-hidden` (an indicator)` | The text typeahead matches. |
| `disabled` | `boolean` | `false` | Can't be selected, and the arrow keys and typeahead skip it. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the option, or the whole list, is disabled. |
| `data-label` | The `label` prop, when given: the text typeahead matches. |
| `data-selected` | Present while the option is selected. |
| `data-value` | The option's value. |

## ListboxItemText

Renders `<span>`. The option's text, beside an indicator or other content. A plain `span`, for styling.

## ListboxItemIndicator

Renders `<span>`. Rendered while its option is selected, or always with `keepMounted`. It is hidden from assistive technology, which hears `aria-selected` instead.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `keepMounted` | `boolean` | `false` | Render it on every option, selected or not, and style the selected ones from `data-selected`: for a box that is filled when selected. |

| Data attribute | Meaning |
| --- | --- |
| `data-selected` | Present while its option is selected. |

## ListboxGroup

Renders `<div>`. A set of related options, with `role="group"`, named by the ListboxGroupLabel inside it. The arrow keys run through groups as one list.

## ListboxGroupLabel

Renders `<div>`. The visible name of its group: the group's `aria-labelledby` points at it.
