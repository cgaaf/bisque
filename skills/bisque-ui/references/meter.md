# Meter

A measurement within a known range, such as disk usage or a battery level.

Source after `bisque-ui copy`: `<copy>/meter/meter.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { MeterRoot, MeterLabel, MeterValue, MeterTrack, MeterIndicator } from "./bisque/meter/meter.rx"

<MeterRoot>
  <MeterLabel />
  <MeterValue />
  <MeterTrack>
    <MeterIndicator />
  </MeterTrack>
</MeterRoot>
```

## MeterRoot

Renders `<div>`. The meter: a `<div>` with `role="meter"` and the value, range and value text as ARIA attributes. It shares the clamped value, its percentage and the formatted text with the parts inside it, through the `meter` context.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` (required) | `number` |  | The measured value. A value outside the range is clamped to it; one that isn't a number reads as `min`. |
| `min` | `number` | `0` | The lowest value of the range. |
| `max` | `number` | `100` | The highest value of the range. |
| `format` | `Intl.NumberFormatOptions` | `a percentage of the range` | `Intl.NumberFormat` options for showing and announcing the value. With them the clamped value is formatted; without, its percentage of the range. |
| `locale` | `string \| string[]` |  | The locale the value is formatted in. The browser's locale when left out. |
| `getAriaValueText` | `(formattedValue: string, value: number) => string` |  | Returns the text announced for the meter, from the formatted value and the raw one. The formatted value is used when it is left out. |

## MeterTrack

Renders `<div>`. The bar the indicator fills. It has no behaviour: give it a height and a background.

## MeterIndicator

Renders `<div>`. The filled part of the track. Its inline style sets `width` to the value's share of the range, `height: inherit` and `inset-inline-start: 0`.

## MeterValue

Renders `<span>`. The formatted value as text. It is hidden from assistive technology, since the root announces the value. For other text, spread `meterValue()` on an element of your own and read the `meter` context.

## MeterLabel

Renders `<span>`. Names the meter: the root's `aria-labelledby` points at it. Pass an `id` to use your own; one is generated otherwise.
