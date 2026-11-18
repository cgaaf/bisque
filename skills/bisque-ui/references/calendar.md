# Calendar

A month grid for choosing a day, or a range of days.

Source after `bisque-ui copy`: `<copy>/calendar/calendar.rx`. Parts are named exports of that file.

## Anatomy

```rx
import {
  CalendarRoot, RangeCalendarRoot, CalendarPreviousMonth, CalendarMonthLabel, CalendarNextMonth,
  CalendarMonthSelect, CalendarYearSelect, CalendarGrid, CalendarGridHeader, CalendarGridBody,
  CalendarWeekNumber, CalendarDayCell, CalendarDay, calendarGridState,
} from "./bisque/calendar/calendar.rx"

<CalendarRoot>
  <CalendarPreviousMonth />
  <CalendarMonthLabel />
  <CalendarNextMonth />
  <CalendarMonthSelect />
  <CalendarYearSelect />
  <CalendarGrid>
    <CalendarGridHeader />
    <CalendarGridBody />
  </CalendarGrid>
</CalendarRoot>

// RangeCalendarRoot takes the same parts.

// Rendering the rows and cells yourself, inside a CalendarGrid:
//   g = use calendarGridState
//   weeks key key = g.weeks
<tbody>
  {for week in weeks {
    days key key = week.days
    <tr>
      <CalendarWeekNumber week={week} />
      {for day in days {
        <CalendarDayCell day={day}>
          <CalendarDay />
        </CalendarDayCell>
      }}
    </tr>
  }}
</tbody>
```

## CalendarRoot

Renders `<div>`. A calendar for choosing one day: a `<div role="group">` that holds the value and the visible month and provides them to the other parts. Label it with `aria-label` or `aria-labelledby`, or put it in a FieldRoot. Inside a FieldRoot it is the field's control.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `month` | `PlainYearMonth` |  | The first visible month, a `Temporal.PlainYearMonth`. Pass it with `onMonthChange` to control the page. |
| `defaultMonth` | `PlainYearMonth` | `the month of the value, else of today` | The first visible month at first. Default: the month of the value, else of today. |
| `onMonthChange` | `(month: PlainYearMonth) => void` |  | Called with the new first visible month when the previous or next button, a select or a key turns the page. |
| `min` | `PlainDate` |  | The earliest day that can be focused or chosen. Days before it are disabled buttons, and the previous button stops at its month. |
| `max` | `PlainDate` |  | The latest day that can be focused or chosen. Days after it are disabled buttons, and the next button stops at its month. |
| `isDateUnavailable` | `(date: PlainDate) => boolean` |  | Days for which this returns true can be focused, and are announced as unavailable (`aria-disabled`, `data-unavailable`), but can't be chosen. |
| `disabled` | `boolean` |  | Disables every day and the navigation buttons natively. A day disabled while it has focus (`disabled={pending? saving}`) takes focus back when it is enabled again, if focus hasn't moved elsewhere. |
| `readOnly` | `boolean` |  | Days stay focusable and the keyboard moves between them, but none can be chosen. Sets `aria-readonly` on the grids and `data-readonly`. |
| `required` | `boolean` |  | The hidden input is `required`: a day must be chosen for a form or a FieldRoot to be valid. |
| `locale` | `string \| string[]` | `the browser's` | The locale for month and day names, the days' accessible names, the first day of the week and the weekend. Default: the browser's. |
| `firstDayOfWeek` | `number` | `the locale's` | The day the weeks start on, from 1 (Monday) to 7 (Sunday). Default: the locale's. |
| `fixedWeeks` | `boolean` | `false` | Always six rows of days, so the grid's height doesn't change from month to month. |
| `numberOfMonths` | `number` | `1` | How many months are shown side by side, each in a CalendarGrid with its `offset`. The previous and next buttons, and the keyboard past the last month, turn this many at a time. |
| `timeZone` | `string` | `the system's` | The time zone in which "today" is read. Default: the system's. |
| `today` | `PlainDate` | `today in `timeZone` | The day marked as today (`aria-current="date"`, `data-today`). Default: today in `timeZone`, read once. |
| `autoFocus` | `boolean` | `false` | When it turns true (and on mount, if it starts true), moves focus to the chosen day, turning to its month, or with none to the grid's Tab stop. A date picker passes `autoFocus={open}`. |
| `showWeekNumbers` | `boolean` | `false` | CalendarGridHeader and CalendarGridBody add a first column of ISO week numbers. |
| `weekNumberLabel` | `string` | `"Week"` | The week number column's name, and the start of each week number's accessible name: "Week" makes "Week 47". |
| `value` | `PlainDate \| null` |  | The chosen day, a `Temporal.PlainDate`. Pass it with `onValueChange` to control the calendar; `null` is a controlled calendar with nothing chosen. It may be read from an answer that is loading or guessed over; one that fails is left to the app's `errored` region. |
| `defaultValue` | `PlainDate` |  | The day chosen at first, when the calendar isn't controlled. A form reset puts it back. |
| `onValueChange` | `(value: PlainDate) => void` |  | Called with the day when the user chooses another one, and once when a form reset returns an uncontrolled calendar to its default. It is called in a change of its own, so it may be an action that saves. |
| `onSelectionComplete` | `(value: PlainDate) => void` |  | Called on every press of a day that can be chosen, the day already chosen included. A date picker closes its popup here. |
| `name` | `string` |  | Submits the chosen day under this name with a form, as an ISO date (`2026-11-17`), or an empty string. Without one, a named FieldRoot's name is used. |

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Inside a FieldRoot: present while the value differs from its initial one. |
| `data-disabled` | Present when the calendar is disabled, by its own prop or by its Field. |
| `data-filled` | Inside a FieldRoot: present while a day is chosen. |
| `data-focused` | Inside a FieldRoot: present while focus is in the calendar. |
| `data-invalid` | Inside a FieldRoot: present when the field is invalid. |
| `data-readonly` | Present when the calendar is read-only. |
| `data-touched` | Inside a FieldRoot: present once focus has been in the calendar and left it. |
| `data-valid` | Inside a FieldRoot: present when the field has been validated and is valid. |

## RangeCalendarRoot

Renders `<div>`. A calendar for choosing a range of days. The first press sets the range's start; moving the pointer or focus previews it; a second press, before or after the first, completes it. Escape cancels a range under way. It takes the same parts as CalendarRoot.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `month` | `PlainYearMonth` |  | The first visible month, a `Temporal.PlainYearMonth`. Pass it with `onMonthChange` to control the page. |
| `defaultMonth` | `PlainYearMonth` | `the month of the value, else of today` | The first visible month at first. Default: the month of the range's start, else of today. |
| `onMonthChange` | `(month: PlainYearMonth) => void` |  | Called with the new first visible month when the previous or next button, a select or a key turns the page. |
| `min` | `PlainDate` |  | The earliest day that can be focused or chosen. |
| `max` | `PlainDate` |  | The latest day that can be focused or chosen. |
| `isDateUnavailable` | `(date: PlainDate) => boolean` |  | Days for which this returns true can be focused and are announced as unavailable, but can't start, end or (without `allowsNonContiguousRanges`) be inside a range. |
| `disabled` | `boolean` |  | Disables every day and the navigation buttons natively. |
| `readOnly` | `boolean` |  | Days stay focusable and the keyboard moves between them, but no range can be chosen. |
| `required` | `boolean` |  | The start's hidden input is `required`: a range must be chosen for a form or a FieldRoot to be valid. |
| `locale` | `string \| string[]` | `the browser's` | The locale for names, the first day of the week and the weekend. Default: the browser's. |
| `firstDayOfWeek` | `number` | `the locale's` | The day the weeks start on, from 1 (Monday) to 7 (Sunday). Default: the locale's. |
| `fixedWeeks` | `boolean` | `false` | Always six rows of days. |
| `numberOfMonths` | `number` | `1` | How many months are shown side by side; the previous and next buttons turn this many at a time. |
| `timeZone` | `string` | `the system's` | The time zone in which "today" is read. Default: the system's. |
| `today` | `PlainDate` | `today in `timeZone` | The day marked as today. Default: today in `timeZone`, read once. |
| `autoFocus` | `boolean` | `false` | When it turns true, drops a range left half-chosen and moves focus to the range's start, turning to its month, or with none to the grid's Tab stop. A date range picker passes `autoFocus={open}`. |
| `showWeekNumbers` | `boolean` | `false` | CalendarGridHeader and CalendarGridBody add a first column of ISO week numbers. |
| `weekNumberLabel` | `string` | `"Week"` | The week number column's name, and the start of each week number's accessible name. |
| `value` | `DateRange \| null` |  | The chosen range, `{ start, end }` with `start` never after `end`. Pass it with `onValueChange` to control the calendar; `null` is a controlled calendar with nothing chosen. |
| `defaultValue` | `DateRange` |  | The range chosen at first, when the calendar isn't controlled. A form reset puts it back. |
| `onValueChange` | `(value: DateRange) => void` |  | Called with the range when its second day is pressed, and once when a form reset returns an uncontrolled calendar to its default. It is called in a change of its own. |
| `onSelectionComplete` | `(value: DateRange) => void` |  | Called when a range is completed, even if it equals the range already chosen. A date range picker closes its popup here. |
| `allowsNonContiguousRanges` | `boolean` | `false (a second press that would include one is ignored)` | Lets a range include unavailable days. Without it, the preview stops at the range's first day and a second press that would include an unavailable day is ignored. |
| `name` | `string` |  | Submits the range with a form as two entries, `<name>-start` and `<name>-end` (ISO dates, or empty strings). Without one, a named FieldRoot's name is used. |
| `startName` | `string` | `<name>-start` | The start date's name with a form, in place of `<name>-start`. |
| `endName` | `string` | `<name>-end` | The end date's name with a form, in place of `<name>-end`. |

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Inside a FieldRoot: present while the value differs from its initial one. |
| `data-disabled` | Present when the calendar is disabled, by its own prop or by its Field. |
| `data-filled` | Inside a FieldRoot: present while a range is chosen. |
| `data-focused` | Inside a FieldRoot: present while focus is in the calendar. |
| `data-invalid` | Inside a FieldRoot: present when the field is invalid. |
| `data-pending` | Present while a range is under way. |
| `data-range` | Always present on a RangeCalendarRoot. |
| `data-readonly` | Present when the calendar is read-only. |
| `data-touched` | Inside a FieldRoot: present once focus has been in the calendar and left it. |
| `data-valid` | Inside a FieldRoot: present when the field has been validated and is valid. |

## CalendarMonthLabel

Renders `<span>`. The name of a visible month, "November 2026", as a polite live region, so turning the page announces the new month. Children replace the text.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `offset` | `number` |  | Which visible month, 0 for the first. Default: 0. |

| Data attribute | Meaning |
| --- | --- |
| `data-month` | The month as an ISO string, `2026-11`. |

## CalendarPreviousMonth

Renders `<button>`. A button that turns back a page (`numberOfMonths` months). Disabled when that page holds no day after `min`, or the calendar is disabled. Named "Previous month"; pass `aria-label` to translate it.

## CalendarNextMonth

Renders `<button>`. A button that turns forward a page (`numberOfMonths` months). Disabled when that page holds no day before `max`, or the calendar is disabled. Named "Next month"; pass `aria-label` to translate it.

## CalendarMonthSelect

Renders `<select>`. A native `<select>` of the months of the visible year, which sets the first visible month. A month with no day between `min` and `max` is a disabled option. Named "Month"; pass `aria-label` to translate it.

## CalendarYearSelect

Renders `<select>`. A native `<select>` of years, from `min`'s year to `max`'s (ten years either side where a limit is missing), which sets the first visible month's year. Named "Year"; pass `aria-label` to translate it.

## CalendarGrid

Renders `<table>`. A visible month: a `<table role="grid">` named by the month. It provides the month's weeks to the parts inside it (`use calendarGridState`). In a RangeCalendarRoot it is `aria-multiselectable`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `offset` | `number` | `0` | Which visible month, 0 for the first. Default: 0. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the calendar is disabled. |
| `data-month` | The month as an ISO string, `2026-11`. |

## CalendarGridHeader

Renders `<thead>`. A `<thead>` with a row of weekday names (a CalendarGridHeaderCell each), in the locale's order, after a week-number header when the root has `showWeekNumbers`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `format` | `"narrow" \| "short" \| "long"` | `"short"` | How the weekdays are written: "narrow" (M), "short" (Mon) or "long" (Monday). Each header is named with the long name either way. Default: "short". |

| Data attribute | Meaning |
| --- | --- |
| `data-week-number` | On the week number column's header cell. |

## CalendarGridHeaderCell

Renders `<th>`. A weekday's column header, `<th scope="col">`, named with the day's long name (`abbr` and `aria-label`). Children replace the name it shows.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `weekday` (required) | `WeekdayName` |  | The day, from the context's `weekdays`: `{ dayOfWeek, label, name }`. |

| Data attribute | Meaning |
| --- | --- |
| `data-weekday` | The day of the week, 1 (Monday) to 7 (Sunday). |

## CalendarGridBody

Renders `<tbody>`. A `<tbody>` with a row per week and, in each, a CalendarDayCell holding a CalendarDay per day, after a CalendarWeekNumber when the root has `showWeekNumbers`.

## CalendarWeekNumber

Renders `<th>`. A row header, `<th scope="row">`, showing the week's ISO number and named with the root's `weekNumberLabel` and the number ("Week 47"). Children replace the number.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `week` (required) | `CalendarWeek` |  | The week, from the grid's `weeks`. |

| Data attribute | Meaning |
| --- | --- |
| `data-week-number` | Always present. |

## CalendarDayCell

Renders `<td>`. A day's grid cell, a `<td>` with `aria-selected` (for a day of the grid's month). It provides the day's state to the CalendarDay inside it, and to a custom part (`use calendarCell`).

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `day` (required) | `CalendarDay` |  | The day, from a week's `days`. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the day can't be focused: before `min`, after `max`, outside the month, or the calendar is disabled. |
| `data-outside-month` | Present on a day of the previous or next month that fills the first or last row. It is shown, but disabled and hidden from assistive technology. |
| `data-range-end` | Present on the last day of the range, or of the preview. |
| `data-range-middle` | Present on the days between the range's first and last. |
| `data-range-preview` | Present on the days of a range under way, before its second day is pressed. |
| `data-range-start` | Present on the first day of the range, or of the preview. |
| `data-selected` | Present when the day is chosen, or inside the range (or the preview of one). |
| `data-today` | Present on today. |
| `data-unavailable` | Present when `isDateUnavailable` returns true for the day. |
| `data-weekend` | Present on the locale's weekend days. |

## CalendarDay

Renders `<button>`. A day's `<button>`: a press, Enter or Space chooses it, and the arrow keys, Home, End, PageUp and PageDown move focus. Only one day of the calendar is in the Tab order. Named with the full date ("Tuesday, November 17, 2026"); today has `aria-current="date"`; an unavailable day `aria-disabled="true"`. Shows the day of the month in the locale's digits, unless given children.

| Data attribute | Meaning |
| --- | --- |
| `data-date` | The day as an ISO string, `2026-11-17`. |
| `data-disabled` | Present when the button is disabled: before `min`, after `max`, outside the month, or the calendar is disabled. |
| `data-outside-month` | Present on a day of the previous or next month that fills a row: disabled and `aria-hidden`. |
| `data-range-end` | Present on the last day of the range, or of the preview. |
| `data-range-middle` | Present on the days between the range's first and last. |
| `data-range-preview` | Present on the days of a range under way. |
| `data-range-start` | Present on the first day of the range, or of the preview. |
| `data-selected` | Present when the day is chosen, or inside the range (or the preview of one). |
| `data-today` | Present on today. |
| `data-unavailable` | Present when `isDateUnavailable` returns true for the day. |
| `data-weekend` | Present on the locale's weekend days. |
