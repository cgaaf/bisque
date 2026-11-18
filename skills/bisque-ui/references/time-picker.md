# Time Picker

A time field with a popup of hours, minutes and AM/PM to choose from.

Source after `bisque-ui copy`: `<copy>/time-picker/time-picker.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { TimePickerRoot, TimePickerField, TimePickerTrigger, TimePickerPopup, TimePickerHours, TimePickerMinutes, TimePickerSeconds, TimePickerDayPeriod, TimePickerOptions } from "./bisque/time-picker/time-picker.rx"
import { TimeFieldInput, TimeFieldSegment, timeField } from "./bisque/time-field/time-field.rx"

// The field's segments come from Time Field's context, as in a Time Field.
component Segments() {
  c = use timeField
  {for segment in c.segments {
    <TimeFieldSegment segment={segment} />
  }}
}

<TimePickerRoot>
  <TimePickerField aria-label="Time">
    <TimeFieldInput>
      <Segments />
    </TimeFieldInput>
    <TimePickerTrigger />
  </TimePickerField>
  <TimePickerPopup>
    // Columns: each renders nothing where the locale or granularity doesn't use it…
    <TimePickerHours />
    <TimePickerMinutes />
    <TimePickerSeconds />
    <TimePickerDayPeriod />
    // …or, instead, one list of whole times.
    <TimePickerOptions interval={30} />
  </TimePickerPopup>
</TimePickerRoot>
```

## TimePickerRoot

Renders no element of its own. Holds the picker's time and open state and shares them, with `min`, `max`, `locale`, `granularity`, the steps and the rest, with the parts inside it. Renders no element.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `PlainTime \| null` |  | The time, a `Temporal.PlainTime`. Pass it with `onValueChange` to control the picker; `null` is controlled and empty, and leaving it out (or `undefined`) lets the picker hold its own value. It may be read from an answer that is loading or guessed over; one that fails is left to the app's `errored` region. |
| `defaultValue` | `PlainTime` |  | The time at first, when the picker isn't controlled. A form reset puts it back. |
| `onValueChange` | `(value: PlainTime \| undefined) => void` |  | Called with the time for each choice in the popup and each complete time typed in the field, and with `undefined` when the field becomes incomplete. It is called in a change of its own, so it may save without holding the picker. |
| `open` | `boolean` |  | Whether the popup is open. Pass it with `onOpenChange` to control it. Escape and a press outside can't be refused: a popup kept open is shown again. |
| `defaultOpen` | `boolean` | `false` | Whether the popup is open at first, when it isn't controlled. |
| `onOpenChange` | `(open: boolean) => void` |  | Called after the popup opens or closes, in a change of its own. |
| `min` | `PlainTime` |  | The earliest valid time. Options before it are disabled, a choice is clamped to it, and an earlier time typed in the field marks it invalid (`rangeUnderflow`). |
| `max` | `PlainTime` |  | The latest valid time. Options after it are disabled, a choice is clamped to it, and a later time typed in the field marks it invalid (`rangeOverflow`). |
| `locale` | `string \| string[]` | `the browser's` | The locale of the field's segments and the options' text: digits, day period names and hour cycle. |
| `granularity` | `TimeGranularity` | `"minute"` | The smallest unit: `"hour"`, `"minute"` or `"second"`. TimePickerSeconds renders only at `"second"`, TimePickerMinutes not at `"hour"`. |
| `hourCycle` | `12 \| 24` |  | `12` or `24` overrides the locale's hour cycle; TimePickerDayPeriod renders only in 12-hour time. |
| `minuteStep` | `number` | `1` | Minutes between the minute column's options. It shapes the list, not the value: a time typed off the step is valid and selects no minute. |
| `secondStep` | `number` | `1` | Seconds between the second column's options. |
| `placeholderValue` | `PlainTime` | `the time the popup opened at (for the field: midnight)` | What a choice in a column starts from while there is no value (and what an empty segment steps from). Without it, a choice starts from the time the popup opened at. |
| `disabled` | `boolean` | `false` | Whether the picker can't be changed: the field is disabled and the trigger is a disabled button. Also true inside a disabled FieldRoot. |
| `readOnly` | `boolean` | `false` | Whether the field can be focused but not changed. The trigger is disabled, so the popup doesn't open. |
| `required` | `boolean` | `false` | Whether a time is needed for the form to be valid. |
| `name` | `string` |  | The name the field's hidden input submits the time under (`13:45`, or `13:45:00` with `granularity="second"`). Taken from an enclosing FieldRoot when not given. |
| `form` | `string` |  | The id of a `<form>` the hidden input belongs to, when the picker isn't inside it. |
| `invalid` | `boolean` |  | For a composition that keeps the Field to itself (Time Range Picker): marks the field and every segment invalid. Given, it wins over an enclosing FieldRoot's state; a time outside `min`/`max` is invalid either way. |
| `describedBy` | `string` |  | For a composition: the ids each segment's `aria-describedby` gets (a Field's description and error). Given, it wins over an enclosing FieldRoot's. |
| `onIncompleteChange` | `(incomplete: boolean) => void` |  | For a composition: called with whether the field is partly filled, whenever that changes. |

## TimePickerField

Renders `<div>`. The field: a TimeFieldRoot given the picker's value, bounds, locale, name and state, so it is a `role="group"` named by its `aria-label`, `aria-labelledby` or an enclosing FieldLabel. Inside it go Time Field's own parts (TimeFieldInput and a TimeFieldSegment per entry of `use timeField`'s `segments`) and usually the trigger. Its hidden `<input type="time">` is the only one the picker submits.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `emptyText` | `string` | `"Empty"` | What an empty segment's `aria-valuetext` says, in the app's language. |
| `incompleteMessage` | `string` | `"Enter a complete time."` | The validation message while some segments are filled and others not. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the picker is disabled. |
| `data-focused` | Present while one of the field's segments has focus. |
| `data-invalid` | Present when the time is outside `min`/`max`, or the FieldRoot around it is invalid. |
| `data-readonly` | Present when the picker is read-only. |
| `data-required` | Present when the picker is required. |

## TimePickerTrigger

Renders `<button>`. The button that opens and closes the popup, through the browser's `popovertarget`. `aria-haspopup="dialog"`; named "Choose time" unless given `aria-label`. Disabled while the picker is disabled or read-only.

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the picker is disabled. |
| `data-popup-open` | Present while the popup is open. |
| `data-readonly` | Present when the picker is read-only. |

## TimePickerPopup

Renders `<div>`. The popup: a `popover="auto"` element placed against the trigger with CSS anchor positioning, `role="dialog"`, named "Choose time" unless given `aria-label` or `aria-labelledby`. It closes on Escape, a press outside, Enter on an option, and focus leaving it. Style it with `:popover-open` and `@starting-style`, not a `display` rule.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `side` | `"top" \| "bottom" \| "left" \| "right"` | `"bottom"` | Which side of the trigger it sits on; the browser flips it when it doesn't fit. |
| `align` | `"start" \| "center" \| "end"` | `"end", under a trigger at the field's end` | Which edge of the trigger it lines up with. |
| `sideOffset` | `number` | `0` | Gap between trigger and popup, in pixels. |
| `alignOffset` | `number` |  | Shift along the trigger's edge, in pixels. |

| Data attribute | Meaning |
| --- | --- |
| `data-side` | The side of the trigger the popup is on, after any flip. |

## TimePickerHours

Renders no element of its own. The hours column, a listbox: 0–23, or in 12-hour time the 12 hours of the value's day period. Opening scrolls it to the selected hour and focuses it. Its options are `role="option"` elements with `data-selected` and `data-disabled`, styled through the column. Named "Hours" unless given `aria-label`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `gridColumns` | `number` |  | Number of options per row in a CSS grid. Arrow keys move within the grid and Tab moves between units. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the picker is disabled. |
| `data-unit` | `hour`. |

## TimePickerMinutes

Renders no element of its own. The minutes column, a listbox of the minutes every `minuteStep`. Renders nothing with `granularity="hour"`. Named "Minutes" unless given `aria-label`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `gridColumns` | `number` |  | Number of options per row in a CSS grid. Arrow keys move within the grid and Tab moves between units. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the picker is disabled. |
| `data-unit` | `minute`. |

## TimePickerSeconds

Renders no element of its own. The seconds column, a listbox of the seconds every `secondStep`. Renders nothing unless `granularity="second"`. Named "Seconds" unless given `aria-label`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `gridColumns` | `number` |  | Number of options per row in a CSS grid. Arrow keys move within the grid and Tab moves between units. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the picker is disabled. |
| `data-unit` | `second`. |

## TimePickerDayPeriod

Renders no element of its own. The AM/PM column, in the locale's words. Renders nothing in 24-hour time. Choosing one keeps the hour on the clock face (9:30 AM becomes 9:30 PM). Named "AM/PM" unless given `aria-label`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `gridColumns` | `number` |  | Number of options per row in a CSS grid. Arrow keys move within the grid and Tab moves between units. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the picker is disabled. |
| `data-unit` | `dayPeriod`. |

## TimePickerOptions

Renders `<div>`. The other popup design: one listbox of whole times every `interval` minutes from midnight (09:00, 09:30 …), those outside `min` and `max` disabled. Any choice (a click, Enter or Space) sets the whole time and closes the popup. Named "Times" unless given `aria-label`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `interval` | `number` | `30` | Minutes between the options. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the picker is disabled. |
| `data-orientation` | `vertical`. |
| `data-target` | The option it opens on when none is selected: the one nearest the time it starts from. |
