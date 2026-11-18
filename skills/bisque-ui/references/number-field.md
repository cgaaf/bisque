# Number Field

A text input for numbers, with buttons and a scrub area to step the value.

Source after `bisque-ui copy`: `<copy>/number-field/number-field.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { NumberFieldRoot, NumberFieldScrubArea, NumberFieldScrubAreaCursor, NumberFieldGroup, NumberFieldDecrement, NumberFieldInput, NumberFieldIncrement } from "./bisque/number-field/number-field.rx"

<NumberFieldRoot>
  <NumberFieldScrubArea>
    <NumberFieldScrubAreaCursor />
  </NumberFieldScrubArea>
  <NumberFieldGroup>
    <NumberFieldDecrement />
    <NumberFieldInput />
    <NumberFieldIncrement />
  </NumberFieldGroup>
</NumberFieldRoot>
```

## NumberFieldRoot

Renders `<div>`. Holds the number field's value and shares it with the parts inside it. With a `name`, or inside a FieldRoot, it also renders a hidden `<input type="number">` that holds the plain value for the form.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `number \| null` |  | The value: a number, or `null` for an empty input. Pass it with `onValueChange` to control the number field. Or pass it with only `onValueCommitted`: the field then shows each step and what is typed by itself, and shows `value` again as soon as the owner's `onValueCommitted` has run: the owner's guess, or its old value until it writes the new one. It may be read from an answer that is loading or guessed over; one that fails is left to the app's `errored` region. |
| `defaultValue` | `number \| null` |  | The value at first, when it isn't controlled. |
| `onValueChange` | `(value: number \| null, details: NumberFieldChangeDetails) => void` |  | Called whenever the value changes: as typed text parses, on each step, while a stepper is held or the scrub area is dragged. Receives the value and details whose `reason` is `input-change`, `input-clear`, `input-blur`, `keyboard`, `increment-press`, `decrement-press`, `wheel` or `scrub`. It is called in a change of its own, after the one that updated the field, so it may write something a loading question reads without holding the field or overwriting what is typed. |
| `onValueCommitted` | `(value: number \| null, details: NumberFieldChangeDetails) => void` |  | Called when a change is final: on blur after typing; on each key, wheel turn and stepper click; and on release after holding a stepper or scrubbing. Receives the value and the `reason`. It is called in a change of its own, so it may be an action that saves: the field is never held by it, and steps on from what it shows while the save is out. |
| `min` | `number` |  | The smallest value. Steps stop at it, typed values are clamped to it, and Home goes to it. Without it there is no lower bound. |
| `max` | `number` |  | The largest value. Steps stop at it, typed values are clamped to it, and End goes to it. Without it there is no upper bound. |
| `step` | `number` | `1` | How far the arrow keys, the steppers and each scrub step move the value. |
| `smallStep` | `number` | `0.1` | The step taken with Alt held. |
| `largeStep` | `number` | `10` | The step taken with Shift held. |
| `snapOnStep` | `boolean` | `false` | Round a step to a multiple of `step` from `min` (or from 0). |
| `allowOutOfRange` | `boolean` | `false` | Let typed values outside `min` and `max` stand. Steps still clamp. |
| `allowWheelScrub` | `boolean` | `false` | Turning the wheel over the input steps the value while the input has focus. |
| `disabled` | `boolean` | `false` | Whether the number field can't be changed or focused. Also true inside a disabled FieldRoot. A field disabled while its input has focus (`disabled={pending? setting}`) gives focus back to the input when it is enabled again, if focus hasn't moved elsewhere. |
| `readOnly` | `boolean` | `false` | Whether the value can be focused and read but not changed. `readOnly={pending? setting}` locks the field while a save is out without losing focus. |
| `required` | `boolean` | `false` | Whether a value is needed for the form to be valid. |
| `name` | `string` |  | The name the hidden input submits the value under. Taken from an enclosing FieldRoot when not given. |
| `form` | `string` |  | The id of a `<form>` the hidden input belongs to, when the number field isn't inside it. |
| `format` | `Intl.NumberFormatOptions` |  | `Intl.NumberFormat` options: how the input shows the value and reads what is typed. |
| `locale` | `string \| string[]` |  | The locale used for formatting and parsing. Defaults to the browser's. |

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Inside a FieldRoot: present once the value has changed. |
| `data-disabled` | Present when the number field is disabled. |
| `data-filled` | Inside a FieldRoot: present when the field has a value. |
| `data-focused` | Inside a FieldRoot: present while the input has focus. |
| `data-invalid` | Inside a FieldRoot: present when the field is invalid. |
| `data-readonly` | Present when the number field is read-only. |
| `data-required` | Present when the number field is required. |
| `data-scrubbing` | Present while the scrub area is being dragged. |
| `data-touched` | Inside a FieldRoot: present once the input has been focused and left. |
| `data-valid` | Inside a FieldRoot: present when the field has been validated and is valid. |

## NumberFieldGroup

Renders `<div>`. Groups the input and the steppers (`role="group"`), for drawing them as one control.

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Inside a FieldRoot: present once the value has changed. |
| `data-disabled` | Present when the number field is disabled. |
| `data-filled` | Inside a FieldRoot: present when the field has a value. |
| `data-focused` | Inside a FieldRoot: present while the input has focus. |
| `data-invalid` | Inside a FieldRoot: present when the field is invalid. |
| `data-readonly` | Present when the number field is read-only. |
| `data-required` | Present when the number field is required. |
| `data-scrubbing` | Present while the scrub area is being dragged. |
| `data-touched` | Inside a FieldRoot: present once the input has been focused and left. |
| `data-valid` | Inside a FieldRoot: present when the field has been validated and is valid. |

## NumberFieldInput

Renders `<input>`. The text input (`inputmode="numeric"`) that shows the value formatted and reads typed text. Arrow Up and Down step (Shift: large step, Alt: small step), Home and End go to `min` and `max` when set, and blur clamps and formats what was typed. Give it an `id` for a `<label for>`; the steppers' `aria-controls` follow it.

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Inside a FieldRoot: present once the value has changed. |
| `data-disabled` | Present when the number field is disabled. |
| `data-filled` | Inside a FieldRoot: present when the field has a value. |
| `data-focused` | Inside a FieldRoot: present while the input has focus. |
| `data-invalid` | Inside a FieldRoot: present when the field is invalid. |
| `data-readonly` | Present when the number field is read-only. |
| `data-required` | Present when the number field is required. |
| `data-scrubbing` | Present while the scrub area is being dragged. |
| `data-touched` | Inside a FieldRoot: present once the input has been focused and left. |
| `data-valid` | Inside a FieldRoot: present when the field has been validated and is valid. |

## NumberFieldIncrement

Renders `<button>`. A button that increases the value by a step, and repeats while held. Named “Increase”, left out of the tab order, and disabled at `max`. A mouse press keeps focus in the input. Accepts `disabled` to disable it on its own.

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Inside a FieldRoot: present once the value has changed. |
| `data-disabled` | Present when the button is disabled: by its own prop, by the number field, or because the value is at `max`. |
| `data-filled` | Inside a FieldRoot: present when the field has a value. |
| `data-focused` | Inside a FieldRoot: present while the input has focus. |
| `data-invalid` | Inside a FieldRoot: present when the field is invalid. |
| `data-readonly` | Present when the number field is read-only. |
| `data-required` | Present when the number field is required. |
| `data-scrubbing` | Present while the scrub area is being dragged. |
| `data-touched` | Inside a FieldRoot: present once the input has been focused and left. |
| `data-valid` | Inside a FieldRoot: present when the field has been validated and is valid. |

## NumberFieldDecrement

Renders `<button>`. A button that decreases the value by a step, and repeats while held. Named “Decrease”, left out of the tab order, and disabled at `min`. A mouse press keeps focus in the input. Accepts `disabled` to disable it on its own.

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Inside a FieldRoot: present once the value has changed. |
| `data-disabled` | Present when the button is disabled: by its own prop, by the number field, or because the value is at `min`. |
| `data-filled` | Inside a FieldRoot: present when the field has a value. |
| `data-focused` | Inside a FieldRoot: present while the input has focus. |
| `data-invalid` | Inside a FieldRoot: present when the field is invalid. |
| `data-readonly` | Present when the number field is read-only. |
| `data-required` | Present when the number field is required. |
| `data-scrubbing` | Present while the scrub area is being dragged. |
| `data-touched` | Inside a FieldRoot: present once the input has been focused and left. |
| `data-valid` | Inside a FieldRoot: present when the field has been validated and is valid. |

## NumberFieldScrubArea

Renders `<span>`. An area to press and drag to change the value: right (or up, vertically) increases it. A mouse's pointer is locked while it scrubs, and NumberFieldScrubAreaCursor is drawn instead. Put the label inside it.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `direction` | `"horizontal" \| "vertical"` | `"horizontal"` | The axis the pointer moves along to scrub. |
| `pixelSensitivity` | `number` | `2` | How many pixels of movement make one step. |
| `teleportDistance` | `number` | `the viewport's edges` | How far, in pixels, the virtual cursor may go from the area before it wraps to the other side. |

| Data attribute | Meaning |
| --- | --- |
| `data-direction` | The scrub axis: `horizontal` or `vertical`. |
| `data-dirty` | Inside a FieldRoot: present once the value has changed. |
| `data-disabled` | Present when the number field is disabled. |
| `data-filled` | Inside a FieldRoot: present when the field has a value. |
| `data-focused` | Inside a FieldRoot: present while the input has focus. |
| `data-invalid` | Inside a FieldRoot: present when the field is invalid. |
| `data-readonly` | Present when the number field is read-only. |
| `data-required` | Present when the number field is required. |
| `data-scrubbing` | Present while the scrub area is being dragged. |
| `data-touched` | Inside a FieldRoot: present once the input has been focused and left. |
| `data-valid` | Inside a FieldRoot: present when the field has been validated and is valid. |

## NumberFieldScrubAreaCursor

Renders `<span>`. The cursor drawn while a mouse scrubs, in place of the locked real one. It is rendered into the document's body, `position: fixed` at the virtual pointer, only while scrubbing; give it a size and an icon. A stylesheet rule nested under a class around the number field won't reach it.

| Data attribute | Meaning |
| --- | --- |
| `data-direction` | The scrub axis: `horizontal` or `vertical`. |
| `data-dirty` | Inside a FieldRoot: present once the value has changed. |
| `data-disabled` | Present when the number field is disabled. |
| `data-filled` | Inside a FieldRoot: present when the field has a value. |
| `data-focused` | Inside a FieldRoot: present while the input has focus. |
| `data-invalid` | Inside a FieldRoot: present when the field is invalid. |
| `data-readonly` | Present when the number field is read-only. |
| `data-required` | Present when the number field is required. |
| `data-scrubbing` | Present while the scrub area is being dragged. |
| `data-touched` | Inside a FieldRoot: present once the input has been focused and left. |
| `data-valid` | Inside a FieldRoot: present when the field has been validated and is valid. |
