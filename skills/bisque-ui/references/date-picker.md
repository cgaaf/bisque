# Date Picker

A date field with a calendar in a popup, behind one value.

Source after `bisque copy`: `<copy>/date-picker/date-picker.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { DatePickerRoot, DatePickerGroup, DatePickerTrigger, DatePickerPopup, DatePickerCalendar } from "./bisque/date-picker/date-picker.rx"
import { DateFieldInput, DateFieldSegment, dateField } from "./bisque/date-field/date-field.rx"
import { CalendarPreviousMonth, CalendarMonthLabel, CalendarNextMonth, CalendarGrid, CalendarGridHeader, CalendarGridBody } from "./bisque/calendar/calendar.rx"

// The segments come from the field's context, so they are rendered by a component inside the group.
component Segments() {
  c = use dateField
  {for segment in c.segments {
    <DateFieldSegment segment={segment} />
  }}
}

<DatePickerRoot>
  <DatePickerGroup aria-label="Date">
    <DateFieldInput>
      <Segments />
    </DateFieldInput>
    <DatePickerTrigger />
  </DatePickerGroup>
  <DatePickerPopup>
    <DatePickerCalendar>
      <CalendarPreviousMonth />
      <CalendarMonthLabel />
      <CalendarNextMonth />
      <CalendarGrid>
        <CalendarGridHeader />
        <CalendarGridBody />
      </CalendarGrid>
    </DatePickerCalendar>
  </DatePickerPopup>
</DatePickerRoot>
```

## DatePickerRoot

Renders no element of its own. Holds the picker's value and open state, and provides them, with the options given here once, to the field, the trigger, the popup and the calendar. It renders no element of its own, only the Popover underneath and, with a name or inside a FieldRoot, the hidden date input that submits the value and that a Field validates.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `PlainDate \| null` |  | The date, a `Temporal.PlainDate`. Pass it with `onValueChange` to control the picker; `null` is a controlled picker with no date (`undefined` leaves it uncontrolled, so write `date ?? null`). A date set from outside replaces a partial edit. It may be read from an answer that is loading or guessed over; one that fails is left to the app's `errored` region. |
| `defaultValue` | `PlainDate` |  | The date at first, when the picker isn't controlled. A form reset puts it back. |
| `onValueChange` | `(value: PlainDate \| undefined) => void` |  | Called with each date the field makes (each digit typed into a year too: 0002, 0020, 0202, 2026) or the calendar picks, and with undefined when the field is emptied or only partly filled. It is called in a change of its own, so it may be an action that saves. |
| `open` | `boolean` |  | Whether the popup is open. Pass it with `onOpenChange` to control it: the browser's popover follows it, and an owner that keeps it true through Escape or a press outside has the popup shown again. |
| `defaultOpen` | `boolean` | `false` | Whether the popup is open at first, when it isn't controlled. |
| `onOpenChange` | `(open: boolean) => void` |  | Called when the popup opens or closes, by the trigger, Escape, a press outside, a pick or a controlled `open`. |
| `min` | `PlainDate` |  | The earliest valid date: earlier days can't be picked, and a typed one is kept and invalid. |
| `max` | `PlainDate` |  | The latest valid date: later days can't be picked, and a typed one is kept and invalid. |
| `isDateUnavailable` | `(date: PlainDate) => boolean` |  | Days that can't be picked (booked, closed). A typed one is kept and invalid. |
| `locale` | `string \| string[]` | `the browser's` | The locale of the field's segments and the calendar's names. |
| `firstDayOfWeek` | `number` | `the locale's` | 1 (Monday) to 7 (Sunday). |
| `placeholderValue` | `PlainDate` | `today` | What an empty segment starts from when stepped with the arrow keys. |
| `disabled` | `boolean` | `false` | Disables the field's segments and the trigger, so the popup can't open, and the hidden input. |
| `readOnly` | `boolean` | `false` | The segments take focus but not edits, and the trigger is disabled, so the popup can't open. |
| `required` | `boolean` | `false` | The hidden input is `required`: a date must be given for a form or a FieldRoot to be valid. |
| `name` | `string` |  | With a name (or inside a named FieldRoot), a hidden date input submits the ISO date (`2026-11-17`); nothing while it is empty or incomplete. |
| `form` | `string` |  | The id of the form the hidden input belongs to, when it isn't inside it. |
| `closeOnSelect` | `boolean` | `true` | Whether picking a day closes the popup. |
| `incompleteMessage` | `string` | `"Enter a complete date."` | The hidden input's validation message while the field is partly filled. |
| `unavailableMessage` | `string` | `"This date is unavailable."` | The hidden input's validation message for a date `isDateUnavailable` refuses. |

## DatePickerGroup

Renders `<div>`. The date field and the trigger in one `role="group"`: the Date Field's root, given the picker's value and options. Put a DateFieldInput with its DateFieldSegments and a DatePickerTrigger inside. Name it with a FieldLabel, `aria-label` or `aria-labelledby`; the segments, the trigger, the popup and the calendar are named by the same label. It is the anchor the popup is placed against (`anchor-name`).

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Present once the field's value has changed. |
| `data-disabled` | Present when the picker is disabled. |
| `data-filled` | Present when the field has a value. |
| `data-focused` | Present while a segment has focus. |
| `data-invalid` | Present while the date is outside min/max, unavailable or partly typed, or the Field is invalid. |
| `data-touched` | Present once the field has been focused and left. |
| `data-valid` | Present when the field is valid. |

## DatePickerTrigger

Renders `<button>`. The button that opens and closes the popup: the native `popovertarget`. It is named "Calendar" and the picker's label (pass `aria-label` to translate "Calendar"), has `aria-haspopup="dialog"`, and is disabled while the picker is disabled or read-only. Picking a day puts focus back on it.

| Data attribute | Meaning |
| --- | --- |
| `data-popup-open` | Present on the trigger while its popup is open. |

## DatePickerPopup

Renders `<div>`. The native `popover` holding the calendar, with `role="dialog"`, named by the picker's label. It is placed under the group with CSS anchor positioning, and the browser flips it when it doesn't fit. Style it with `:popover-open` and `@starting-style`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `side` | `"top" \| "bottom" \| "left" \| "right"` | `"bottom"` | Which side of the group it sits on; the browser flips it when it doesn't fit. |
| `align` | `"start" \| "center" \| "end"` | `"start"` | Which edge of the group it lines up with. |
| `sideOffset` | `number` | `0` | The gap between the group and the popup, in pixels. |
| `alignOffset` | `number` | `0` | Moves the popup along the group's edge, in pixels, when `align` isn't "center". |

| Data attribute | Meaning |
| --- | --- |
| `data-side` | Which side of its anchor the popup is on: the one asked for, then the one the browser placed it on. |

## DatePickerCalendar

Renders `<div>`. The Calendar's root, given the picker's value and options. Put the Calendar's own parts inside (CalendarGrid, CalendarGridBody, CalendarPreviousMonth…). Opening the popup focuses the chosen day, else today; picking a day closes the popup and focuses the trigger, unless the root's `closeOnSelect` is false. The calendar submits nothing and isn't a Field's control: the picker is. It takes the Calendar's display props.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `numberOfMonths` | `number` | `1` | How many months are shown side by side, each in a CalendarGrid with its `offset`. |
| `fixedWeeks` | `boolean` | `false` | Always six rows of days, so the grid's height doesn't change from month to month. |
| `today` | `PlainDate` |  | The day marked as today. Default: today in `timeZone`. |
| `timeZone` | `string` | `the system's` | The time zone in which "today" is read. |
| `showWeekNumbers` | `boolean` | `false` | CalendarGridHeader and CalendarGridBody add a first column of ISO week numbers. |
| `weekNumberLabel` | `string` | `"Week"` | The week number column's name, and the start of each week number's accessible name. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the picker is disabled. |
| `data-readonly` | Present when the picker is read-only. |
