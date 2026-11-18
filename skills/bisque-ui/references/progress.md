# Progress

Shows how far a task that takes a while has got.

Source after `bisque copy`: `<copy>/progress/progress.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { ProgressRoot, ProgressLabel, ProgressValue, ProgressTrack, ProgressIndicator } from "./bisque/progress/progress.rx"

<ProgressRoot>
  <ProgressLabel />
  <ProgressValue />
  <ProgressTrack>
    <ProgressIndicator />
  </ProgressTrack>
</ProgressRoot>
```

## ProgressRoot

Renders `<div>`. The progress bar: a `<div>` with `role="progressbar"` and the value, range and value text as ARIA attributes. It shares the value, its percentage, the formatted text and the status with the parts inside it, through the `progress` context.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` (required) | `number \| null` |  | How much is done, or `null` while that isn't known (indeterminate). A value outside the range is clamped to it; one that isn't finite is indeterminate too. |
| `min` | `number` | `0` | The value at which nothing is done. |
| `max` | `number` | `100` | The value at which the task is complete. |
| `format` | `Intl.NumberFormatOptions` | `a percentage of the range` | `Intl.NumberFormat` options for showing and announcing the value. With them the clamped value is formatted; without, its percentage of the range. |
| `locale` | `string \| string[]` |  | The locale the value is formatted in. The browser's locale when left out. |
| `getAriaValueText` | `(formattedValue: string, value: number \| null) => string` |  | Returns the text announced for the progress bar, from the formatted value and the raw one (`null` while indeterminate). When it is left out, the formatted value is used, or "indeterminate progress". |

| Data attribute | Meaning |
| --- | --- |
| `data-complete` | Present when the value has reached `max`. |
| `data-indeterminate` | Present while the value is `null`: how much is done isn't known. |
| `data-progressing` | Present while the value is known and below `max`. |

## ProgressTrack

Renders `<div>`. The bar the indicator fills. Give it a height and a background.

| Data attribute | Meaning |
| --- | --- |
| `data-complete` | Present when the value has reached `max`. |
| `data-indeterminate` | Present while the value is `null`: how much is done isn't known. |
| `data-progressing` | Present while the value is known and below `max`. |

## ProgressIndicator

Renders `<div>`. The filled part of the track. Its inline style sets `width` to the share of the range done, `height: inherit` and `inset-inline-start: 0`. While indeterminate it has no inline style, so the stylesheet decides how it looks.

| Data attribute | Meaning |
| --- | --- |
| `data-complete` | Present when the value has reached `max`. |
| `data-indeterminate` | Present while the value is `null`: how much is done isn't known. |
| `data-progressing` | Present while the value is known and below `max`. |

## ProgressValue

Renders `<span>`. The formatted value as text, empty while indeterminate. It is hidden from assistive technology, since the root announces the value. For other text, spread `progressValue(c)` on an element of your own and read the `progress` context.

| Data attribute | Meaning |
| --- | --- |
| `data-complete` | Present when the value has reached `max`. |
| `data-indeterminate` | Present while the value is `null`: how much is done isn't known. |
| `data-progressing` | Present while the value is known and below `max`. |

## ProgressLabel

Renders `<span>`. Names the progress bar: the root's `aria-labelledby` points at it. Pass an `id` to use your own; one is generated otherwise.

| Data attribute | Meaning |
| --- | --- |
| `data-complete` | Present when the value has reached `max`. |
| `data-indeterminate` | Present while the value is `null`: how much is done isn't known. |
| `data-progressing` | Present while the value is known and below `max`. |
