# Time Range Picker

A start and an end time, each with its own picker, in one group.

Source after `bisque-ui copy`: `<copy>/time-range-picker/time-range-picker.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { TimeRangePickerRoot, TimeRangePickerStart, TimeRangePickerEnd, TimeRangePickerSeparator } from "./bisque/time-range-picker/time-range-picker.rx"
import { TimePickerField, TimePickerTrigger, TimePickerPopup, TimePickerHours, TimePickerMinutes, TimePickerDayPeriod } from "./bisque/time-picker/time-picker.rx"
import { TimeFieldInput, TimeFieldSegment, timeField } from "./bisque/time-field/time-field.rx"

component Segments() {
  c = use timeField
  {for segment in c.segments {
    <TimeFieldSegment segment={segment} />
  }}
}

<TimeRangePickerRoot aria-label="Opening hours">
  <TimeRangePickerStart>
    <TimePickerField aria-label="Opens">
      <TimeFieldInput><Segments /></TimeFieldInput>
      <TimePickerTrigger />
    </TimePickerField>
    <TimePickerPopup>
      <TimePickerHours />
      <TimePickerMinutes />
      <TimePickerDayPeriod />
    </TimePickerPopup>
  </TimeRangePickerStart>
  <TimeRangePickerSeparator>–</TimeRangePickerSeparator>
  <TimeRangePickerEnd>
    // The same parts, for the end.
  </TimeRangePickerEnd>
</TimeRangePickerRoot>
```

## TimeRangePickerRoot

Renders `<div>`. Holds the range and shares it, with the bounds, locale and the rest, with the two sides. A `role="group"`, named by its `aria-label`, `aria-labelledby` or an enclosing FieldLabel. With a name, or inside a FieldRoot, it renders the two hidden `<input type="time">`s that submit the range and that Field validates.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `TimeRange \| null` |  | The range. `null` is controlled and empty; leaving it out lets the picker hold its own. |
| `defaultValue` | `TimeRange` |  | The range at first, when it isn't controlled. A form reset puts it back. |
| `onValueChange` | `(value: TimeRange) => void` |  | Called with the whole range whenever either end changes (undefined while that end is empty or incomplete). |
| `allowOvernight` | `boolean` | `false` | Whether the end may be earlier than the start, a range across midnight. |
| `min` | `PlainTime` |  | The earliest valid time, for both ends. |
| `max` | `PlainTime` |  | The latest valid time, for both ends. |
| `locale` | `string \| string[]` |  | The locale of both fields and their popups. |
| `granularity` | `TimeGranularity` | `"minute"` | The smallest unit of both times: `"hour"`, `"minute"` or `"second"`. |
| `hourCycle` | `12 \| 24` |  | `12` or `24` overrides the locale's hour cycle. |
| `minuteStep` | `number` | `1` | Minutes between the minute columns' options. |
| `secondStep` | `number` | `1` | Seconds between the second columns' options. |
| `placeholderValue` | `PlainTime` |  | What a choice starts from on a side with no time yet. |
| `disabled` | `boolean` | `false` | Whether neither side can be changed. Also true inside a disabled FieldRoot. |
| `readOnly` | `boolean` | `false` | Whether the fields can be focused but not changed; the triggers are disabled. |
| `required` | `boolean` | `false` | Whether both times are needed for the form to be valid. |
| `name` | `string` |  | Submits the range as `<name>-start` and `<name>-end`. Taken from an enclosing FieldRoot when not given. |
| `startName` | `string` | `<name>-start` | The start time's name with a form. |
| `endName` | `string` | `<name>-end` | The end time's name with a form. |
| `form` | `string` |  | The id of a `<form>` the hidden inputs belong to. |
| `incompleteMessage` | `string` | `"Enter a complete time."` | The validation message while a side is partly filled. |
| `rangeOrderMessage` | `string` | `"The end time is before the start time."` | The validation message for an end before the start (unless `allowOvernight`). |

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Present once the field's value has changed. |
| `data-disabled` | Present when the range is disabled. |
| `data-filled` | Present when the field has a value. |
| `data-focused` | Present while the field has focus. |
| `data-invalid` | Present when the end is before the start (and `allowOvernight` is off), a side is outside `min`/`max` or partly filled, or the FieldRoot around it is invalid. |
| `data-touched` | Present once the field has been focused and left. |
| `data-valid` | Present when the field is valid. |

## TimeRangePickerStart

Renders no element of its own. The start: a TimePickerRoot for the range's start, bounded above by the end unless `allowOvernight`. Inside it go the Time Picker's parts (TimePickerField, TimePickerTrigger, TimePickerPopup and its columns). Its field submits `<name>-start`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean` |  | Whether this side's popup is open. |
| `defaultOpen` | `boolean` |  | Whether this side's popup is open at first, when it isn't controlled. |
| `onOpenChange` | `(open: boolean) => void` |  | Called after this side's popup opens or closes. |

## TimeRangePickerEnd

Renders no element of its own. The end: a TimePickerRoot for the range's end, bounded below by the start unless `allowOvernight`, so its popup disables what would put it earlier. Its field submits `<name>-end`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean` |  | Whether this side's popup is open. |
| `defaultOpen` | `boolean` |  | Whether this side's popup is open at first, when it isn't controlled. |
| `onOpenChange` | `(open: boolean) => void` |  | Called after this side's popup opens or closes. |

## TimeRangePickerSeparator

Renders `<span>`. A span between the two sides, hidden from assistive technology (each field has its own name). Its text is yours: "–", "to".
