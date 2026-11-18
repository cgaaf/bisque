# Date Field

A date typed or stepped one segment at a time, in the locale's order.

Source after `bisque copy`: `<copy>/date-field/date-field.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { DateFieldRoot, DateFieldInput, DateFieldSegment, dateField } from "./bisque/date-field/date-field.rx"

// The segments come from the field's context, so they are rendered by a component inside the root.
component Segments() {
  c = use dateField
  {for segment in c.segments {
    <DateFieldSegment segment={segment} />
  }}
}

<DateFieldRoot aria-label="Date">
  <DateFieldInput>
    <Segments />
  </DateFieldInput>
</DateFieldRoot>
```

## DateFieldRoot

Renders `<div>`. Holds the field's date and shares it with the parts inside it: a `role="group"`, named by its `aria-label`, `aria-labelledby` or an enclosing FieldLabel. With a `name`, or inside a FieldRoot, it also renders a hidden `<input type="date">` that submits the value and whose native `min`, `max` and `required` checks Field reads.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `PlainDate \| null` |  | The date, a `Temporal.PlainDate`. Pass it with `onValueChange` to control the field; `null` is controlled and empty, and leaving it out (or `undefined`) lets the field hold its own value. A value set from outside replaces a partial edit. It may be read from an answer that is loading or guessed over; one that fails is left to the app's `errored` region. |
| `defaultValue` | `PlainDate` |  | The date at first, when the field isn't controlled. A form reset puts it back. |
| `onValueChange` | `(value: PlainDate \| undefined) => void` |  | Called with the date whenever every segment is filled and the day exists, and with `undefined` when a complete date becomes incomplete. Typing a year reports each year on the way (2, 20, 202, 2026). It is called in a change of its own, so it may save or write something a loading question reads without holding the field. |
| `min` | `PlainDate` |  | The earliest valid date. An earlier one is kept, not clamped: the field is invalid and the hidden input reports `rangeUnderflow`. |
| `max` | `PlainDate` |  | The latest valid date. A later one is kept, not clamped: the field is invalid and the hidden input reports `rangeOverflow`. |
| `locale` | `string \| string[]` | `the browser's` | The locale whose segment order, separators, digits and segment names the field uses. |
| `placeholderValue` | `PlainDate` | `today` | The date an empty segment starts from when it is stepped with the arrow keys. |
| `disabled` | `boolean` | `false` | Whether the field can't be focused or changed. Also true inside a disabled FieldRoot. A field disabled while a segment has focus gives focus back to that segment when it is enabled again. |
| `readOnly` | `boolean` | `false` | Whether the segments can be focused but not changed. `readOnly={pending? setting}` locks the field while a save is out without losing focus. |
| `required` | `boolean` | `false` | Whether a date is needed for the form to be valid. |
| `name` | `string` |  | The name the hidden input submits the value under (`2026-11-17`); nothing is submitted while the field is incomplete. Taken from an enclosing FieldRoot when not given. |
| `form` | `string` |  | The id of a `<form>` the hidden input belongs to, when the field isn't inside it. |
| `invalid` | `boolean` |  | Marks the field invalid from outside: each segment gets `aria-invalid` and `data-invalid`, as from an invalid FieldRoot. For a composition that keeps the Field to itself (a picker). Given, it wins over the Field's state; a date outside `min`/`max` is invalid either way. |
| `describedBy` | `string` |  | Space-separated ids of what describes the field (a description, an error), given to each segment as `aria-describedby`, as an enclosing FieldRoot's would be. Given, it wins over the Field's. |
| `emptyText` | `string` | `"Empty"` | What an empty segment's `aria-valuetext` says, in the app's language. |
| `incompleteMessage` | `string` | `"Enter a complete date."` | The validation message while some segments are filled and others not. |

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Inside a FieldRoot: present once the value has changed. |
| `data-disabled` | Present when the field is disabled. |
| `data-filled` | Inside a FieldRoot: present when the field has a value. |
| `data-focused` | Present while one of the field's segments has focus. |
| `data-invalid` | Present when the date is outside `min`/`max`, when `invalid` is given true, or (without `invalid`) when the FieldRoot around it is invalid: missing, partly filled, or failing `validate`. |
| `data-readonly` | Present when the field is read-only. |
| `data-required` | Present when the field is required. |
| `data-touched` | Inside a FieldRoot: present once a segment has been focused and the field left. |
| `data-valid` | Inside a FieldRoot: present when the field has been validated and is valid. |

## DateFieldInput

Renders `<div>`. The box holding the segments. A press on its empty space, or on a separator, focuses the first empty segment, or the last when all are filled.

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Inside a FieldRoot: present once the value has changed. |
| `data-disabled` | Present when the field is disabled. |
| `data-filled` | Inside a FieldRoot: present when the field has a value. |
| `data-focused` | Present while one of the field's segments has focus. |
| `data-invalid` | Present when the date is outside `min`/`max`, when `invalid` is given true, or (without `invalid`) when the FieldRoot around it is invalid: missing, partly filled, or failing `validate`. |
| `data-readonly` | Present when the field is read-only. |
| `data-required` | Present when the field is required. |
| `data-touched` | Inside a FieldRoot: present once a segment has been focused and the field left. |
| `data-valid` | Inside a FieldRoot: present when the field has been validated and is valid. |

## DateFieldSegment

Renders `<span>`. One entry of the context's `segments`, rendered with `for segment in c.segments` in a component inside the root. An editable segment is a contenteditable `role="spinbutton"` with its value, range and name; a separator is an `aria-hidden` span. It renders `segment.text` as its content.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `segment` (required) | `KeyedSegment` |  | The entry it renders. Keyed by kind (separators by position), so a segment's element stays the same as its value changes and keeps focus. |

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Inside a FieldRoot: present once the value has changed. |
| `data-disabled` | Present when the field is disabled. |
| `data-filled` | Inside a FieldRoot: present when the field has a value. |
| `data-focused` | Present while one of the field's segments has focus. |
| `data-invalid` | Present when the date is outside `min`/`max`, when `invalid` is given true, or (without `invalid`) when the FieldRoot around it is invalid: missing, partly filled, or failing `validate`. |
| `data-placeholder` | Present on an editable segment while it is empty (it then shows dashes). |
| `data-readonly` | Present when the field is read-only. |
| `data-required` | Present when the field is required. |
| `data-touched` | Inside a FieldRoot: present once a segment has been focused and the field left. |
| `data-type` | The segment's kind: `month`, `day` or `year`, or `literal` for a separator. |
| `data-valid` | Inside a FieldRoot: present when the field has been validated and is valid. |
