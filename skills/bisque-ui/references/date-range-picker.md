# Date Range Picker

Two date fields with a range calendar in a popup, behind one range.

Source after `bisque-ui copy`: `<copy>/date-range-picker/date-range-picker.rx`. Parts are named exports of that file.

## Anatomy

```rx
import {
  DateRangePickerRoot, DateRangePickerGroup, DateRangePickerStart, DateRangePickerSeparator, DateRangePickerEnd,
  DateRangePickerTrigger, DateRangePickerPopup, DateRangePickerCalendar,
} from "./bisque/date-range-picker/date-range-picker.rx"
import { DateFieldInput, DateFieldSegment, dateField } from "./bisque/date-field/date-field.rx"
import { CalendarMonthLabel, CalendarGrid, CalendarGridHeader, CalendarGridBody } from "./bisque/calendar/calendar.rx"

// The segments come from each field's context, so they are rendered by a component inside it.
component Segments() {
  c = use dateField
  {for segment in c.segments {
    <DateFieldSegment segment={segment} />
  }}
}

<DateRangePickerRoot>
  <DateRangePickerGroup aria-label="Dates">
    <DateRangePickerStart>
      <DateFieldInput><Segments /></DateFieldInput>
    </DateRangePickerStart>
    <DateRangePickerSeparator>–</DateRangePickerSeparator>
    <DateRangePickerEnd>
      <DateFieldInput><Segments /></DateFieldInput>
    </DateRangePickerEnd>
    <DateRangePickerTrigger />
  </DateRangePickerGroup>
  <DateRangePickerPopup>
    <DateRangePickerCalendar>
      <CalendarMonthLabel />
      <CalendarGrid>
        <CalendarGridHeader />
        <CalendarGridBody />
      </CalendarGrid>
    </DateRangePickerCalendar>
  </DateRangePickerPopup>
</DateRangePickerRoot>
```

## DateRangePickerRoot

Renders no element of its own. Holds the picker's range and open state, and provides them, with the options given here once, to the two fields, the trigger, the popup and the calendar. It renders no element of its own, only the Popover underneath and, with a name or inside a FieldRoot, the two hidden date inputs that submit the range.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `DateRange \| null` |  | The range, `{ start, end }` (`Temporal.PlainDate`s). Pass it with `onValueChange` to control the picker; `null` is a controlled picker with no range. A range that changes replaces both fields; while it stays the same, a side being typed is kept. |
| `defaultValue` | `DateRange` |  | The range at first, when the picker isn't controlled. A form reset puts it back. |
| `onValueChange` | `(value: DateRange \| undefined) => void` |  | Called with the range when both fields are complete and either changes (each digit typed into a year too), or the calendar completes one, and with undefined when a complete range becomes incomplete. A start after the end is reported as typed, and is invalid. It is called in a change of its own, so it may be an action that saves. |
| `open` | `boolean` |  | Whether the popup is open. Pass it with `onOpenChange` to control it: the browser's popover follows it, and an owner that keeps it true through Escape or a press outside has the popup shown again. |
| `defaultOpen` | `boolean` | `false` | Whether the popup is open at first, when it isn't controlled. |
| `onOpenChange` | `(open: boolean) => void` |  | Called when the popup opens or closes. |
| `min` | `PlainDate` |  | The earliest valid date: earlier days can't be picked, and a typed one is kept and invalid. |
| `max` | `PlainDate` |  | The latest valid date: later days can't be picked, and a typed one is kept and invalid. |
| `isDateUnavailable` | `(date: PlainDate) => boolean` |  | Days that can't be picked, nor be inside a picked range. A typed one is kept and invalid. |
| `locale` | `string \| string[]` | `the browser's` | The locale of the fields' segments and the calendar's names. |
| `firstDayOfWeek` | `number` | `the locale's` | 1 (Monday) to 7 (Sunday). |
| `placeholderValue` | `PlainDate` | `today` | What an empty segment starts from when stepped with the arrow keys. |
| `disabled` | `boolean` | `false` | Disables both fields' segments, the trigger, so the popup can't open, and the hidden inputs. |
| `readOnly` | `boolean` | `false` | The segments take focus but not edits, and the trigger is disabled. |
| `required` | `boolean` | `false` | Both dates are required. |
| `name` | `string` |  | Submits the range as `<name>-start` and `<name>-end` (ISO dates), as RangeCalendarRoot does. |
| `startName` | `string` | `<name>-start` | The start date's name with a form. |
| `endName` | `string` | `<name>-end` | The end date's name with a form. |
| `form` | `string` |  | The id of the form the hidden inputs belong to, when they aren't inside it. |
| `closeOnSelect` | `boolean` | `true` | Whether completing a range in the calendar closes the popup. |
| `incompleteMessage` | `string` | `"Enter a complete date."` | The validation message while a field is partly filled. |
| `unavailableMessage` | `string` | `"This date is unavailable."` | The validation message for a date `isDateUnavailable` refuses. |
| `rangeOrderMessage` | `string` | `"The end date is before the start date."` | The start input's validation message while the start is after the end. |

## DateRangePickerGroup

Renders `<div>`. The start field, the separator, the end field and the trigger in one `role="group"`. Name it with a FieldLabel, `aria-label` or `aria-labelledby`; the trigger, the popup and the calendar are named by the same label. It is the anchor the popup is placed against (`anchor-name`).

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Present once the field's value has changed. |
| `data-disabled` | Inside a FieldRoot: present when the field is disabled. |
| `data-filled` | Present when the field has a value. |
| `data-focused` | Inside a FieldRoot: present while focus is in the group. |
| `data-invalid` | Present while either date is outside min/max, unavailable or partly typed, the start is after the end, or the Field is invalid. |
| `data-touched` | Present once the field has been focused and left. |
| `data-valid` | Present when the field is valid. |

## DateRangePickerStart

Renders `<div>`. The start date: the Date Field's root, given the range's start and the picker's options. Put a DateFieldInput with its DateFieldSegments inside. A group of its own, named "Start date" (pass `aria-label` to translate). It has `data-invalid` while the start is partly typed, unavailable or after the end.

## DateRangePickerEnd

Renders `<div>`. The end date: the Date Field's root, given the range's end and the picker's options. A group of its own, named "End date" (pass `aria-label` to translate). It has `data-invalid` while the end is partly typed, unavailable or before the start.

## DateRangePickerSeparator

Renders `<span>`. What sits between the two fields, hidden from assistive technology (which hears "Start date" and "End date"). It shows its children.

## DateRangePickerTrigger

Renders `<button>`. The button that opens and closes the popup: the native `popovertarget`. It is named "Calendar" and the picker's label, has `aria-haspopup="dialog"`, and is disabled while the picker is disabled or read-only. Completing a range puts focus back on it.

| Data attribute | Meaning |
| --- | --- |
| `data-popup-open` | Present on the trigger while its popup is open. |

## DateRangePickerPopup

Renders `<div>`. The native `popover` holding the calendar, with `role="dialog"`, named by the picker's label, placed under the group with CSS anchor positioning.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `side` | `"top" \| "bottom" \| "left" \| "right"` | `"bottom"` | Which side of the group it sits on; the browser flips it when it doesn't fit. |
| `align` | `"start" \| "center" \| "end"` | `"start"` | Which edge of the group it lines up with. |
| `sideOffset` | `number` | `0` | The gap between the group and the popup, in pixels. |
| `alignOffset` | `number` | `0` | Moves the popup along the group's edge, in pixels, when `align` isn't "center". |

| Data attribute | Meaning |
| --- | --- |
| `data-side` | Which side of its anchor the popup is on: the one asked for, then the one the browser placed it on. |

## DateRangePickerCalendar

Renders `<div>`. The range Calendar's root, given the picker's range and options. Put the Calendar's own parts inside. Opening the popup focuses the range's start, else today, and drops a range left half-chosen; completing a range closes the popup and focuses the trigger, unless the root's `closeOnSelect` is false. While a range is under way, the first Escape cancels it and the second closes the popup. A start after the end shows no range.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `allowsNonContiguousRanges` | `boolean` | `false` | Lets a range include unavailable days. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the picker is disabled. |
| `data-pending` | Present while a range is under way: its first day has been pressed. |
| `data-range` | Always present: the calendar picks a range. |
| `data-readonly` | Present when the picker is read-only. |
