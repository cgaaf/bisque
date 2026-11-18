# Slider

A range input with any number of thumbs that you can style.

Source after `bisque-ui copy`: `<copy>/slider/slider.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { SliderRoot, SliderValue, SliderControl, SliderTrack, SliderIndicator, SliderThumb } from "./bisque/slider/slider.rx"

<SliderRoot>
  <SliderValue />
  <SliderControl>
    <SliderTrack>
      <SliderIndicator />
      <SliderThumb />
    </SliderTrack>
  </SliderControl>
</SliderRoot>
```

## SliderRoot

Renders `<div>`. Holds the slider's value and shares it with the parts inside it. Renders a `role="group"` element.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `number \| number[]` |  | The value: a number for one thumb, an array for a range with a thumb per entry. Pass it with `onValueChange` to control the slider. Or pass it with only `onValueCommitted`: the slider then follows the pointer and keys by itself, and shows `value` again as soon as the owner's `onValueCommitted` has run: the owner's guess, or its old value until it writes the new one. It may be read from an answer that is loading or guessed over; one that fails is left to the app's `errored` region. |
| `defaultValue` | `number \| number[]` |  | The value at first, when it isn't controlled: a number, or an array for a range. Defaults to `min`. |
| `onValueChange` | `(value: number \| number[], details: SliderChangeDetails) => void` |  | Called on every change, many times during a drag, with the new value (a number or an array, as `value` is) and details: the `reason` (`track-press`, `drag`, `keyboard` or `input-change`) and the `activeThumbIndex`. It is called in a change of its own, after the one that moved the thumb, so it may write something a loading question reads without holding the slider. |
| `onValueCommitted` | `(value: number \| number[], details: SliderCommitDetails) => void` |  | Called when a change is final: on pointer release and on each key press. Receives the value and the `reason`. It is called in a change of its own, so it may be an action that saves: the slider is never held by it, and goes on from what it shows if moved again while the save is out. |
| `min` | `number` | `0` | The smallest value. |
| `max` | `number` | `100` | The largest value. |
| `step` | `number` | `1` | The values are multiples of `step` from `min`. |
| `largeStep` | `number` | `10` | How far Page Up, Page Down and Shift with an arrow key move a thumb. |
| `minStepsBetweenValues` | `number` | `0` | How many steps apart a range's thumbs must stay. |
| `orientation` | `SliderOrientation` | `"horizontal"` | Whether the slider runs left to right or bottom to top. |
| `disabled` | `boolean` | `false` | Whether the slider ignores the pointer and the keyboard. Its range inputs are disabled too. Also true inside a disabled FieldRoot. A slider disabled while a thumb has focus (`disabled={pending? setting}`) gives focus back to that thumb when it is enabled again, if focus hasn't moved elsewhere. |
| `name` | `string` |  | The name each thumb's range input submits its value under. Taken from an enclosing FieldRoot when not given. |
| `form` | `string` |  | The id of a `<form>` the thumbs' inputs belong to, when the slider isn't inside it. |
| `format` | `Intl.NumberFormatOptions` |  | `Intl.NumberFormat` options for how `SliderValue` shows the values and the thumbs announce them. |
| `locale` | `string \| string[]` |  | The locale used with `format`. Defaults to the browser's. |

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Inside a FieldRoot: present once the value has changed. |
| `data-disabled` | Present when the slider is disabled. |
| `data-dragging` | Present while a pointer is pressing the control or dragging a thumb. |
| `data-filled` | Inside a FieldRoot: present when the field has a value. |
| `data-focused` | Inside a FieldRoot: present while a thumb has focus. |
| `data-invalid` | Inside a FieldRoot: present when the field is invalid. |
| `data-orientation` | The slider's orientation: `horizontal` or `vertical`. |
| `data-touched` | Inside a FieldRoot: present once the slider has been focused and left. |
| `data-valid` | Inside a FieldRoot: present when the field has been validated and is valid. |

## SliderControl

Renders `<div>`. The area that takes pointer presses: a press moves the nearest thumb there, and dragging moves it on. Put the track and thumbs inside it, and give it more height than the track for an easier target. It sets `touch-action: none`.

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Inside a FieldRoot: present once the value has changed. |
| `data-disabled` | Present when the slider is disabled. |
| `data-dragging` | Present while a pointer is pressing the control or dragging a thumb. |
| `data-filled` | Inside a FieldRoot: present when the field has a value. |
| `data-focused` | Inside a FieldRoot: present while a thumb has focus. |
| `data-invalid` | Inside a FieldRoot: present when the field is invalid. |
| `data-orientation` | The slider's orientation: `horizontal` or `vertical`. |
| `data-touched` | Inside a FieldRoot: present once the slider has been focused and left. |
| `data-valid` | Inside a FieldRoot: present when the field has been validated and is valid. |

## SliderTrack

Renders `<div>`. The rail the thumbs move along. It is `position: relative`, and the indicator and thumbs are placed within it, so give it its length and thickness.

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Inside a FieldRoot: present once the value has changed. |
| `data-disabled` | Present when the slider is disabled. |
| `data-dragging` | Present while a pointer is pressing the control or dragging a thumb. |
| `data-filled` | Inside a FieldRoot: present when the field has a value. |
| `data-focused` | Inside a FieldRoot: present while a thumb has focus. |
| `data-invalid` | Inside a FieldRoot: present when the field is invalid. |
| `data-orientation` | The slider's orientation: `horizontal` or `vertical`. |
| `data-touched` | Inside a FieldRoot: present once the slider has been focused and left. |
| `data-valid` | Inside a FieldRoot: present when the field has been validated and is valid. |

## SliderIndicator

Renders `<div>`. The filled part of the track: from the start to the value, or between a range's first and last thumbs. Its offset and length are inline styles; it inherits the track's height (horizontal) or width (vertical).

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Inside a FieldRoot: present once the value has changed. |
| `data-disabled` | Present when the slider is disabled. |
| `data-dragging` | Present while a pointer is pressing the control or dragging a thumb. |
| `data-filled` | Inside a FieldRoot: present when the field has a value. |
| `data-focused` | Inside a FieldRoot: present while a thumb has focus. |
| `data-invalid` | Inside a FieldRoot: present when the field is invalid. |
| `data-orientation` | The slider's orientation: `horizontal` or `vertical`. |
| `data-touched` | Inside a FieldRoot: present once the slider has been focused and left. |
| `data-valid` | Inside a FieldRoot: present when the field has been validated and is valid. |

## SliderValue

Renders `<output>`. The values as text, formatted with `format` and `locale`, a range's joined by " – ". An `<output>` whose `for` names the thumbs' inputs. It isn't announced as it changes (`aria-live="off"`): the focused thumb announces its own value.

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Inside a FieldRoot: present once the value has changed. |
| `data-disabled` | Present when the slider is disabled. |
| `data-dragging` | Present while a pointer is pressing the control or dragging a thumb. |
| `data-filled` | Inside a FieldRoot: present when the field has a value. |
| `data-focused` | Inside a FieldRoot: present while a thumb has focus. |
| `data-invalid` | Inside a FieldRoot: present when the field is invalid. |
| `data-orientation` | The slider's orientation: `horizontal` or `vertical`. |
| `data-touched` | Inside a FieldRoot: present once the slider has been focused and left. |
| `data-valid` | Inside a FieldRoot: present when the field has been validated and is valid. |

## SliderThumb

Renders `<div>`. A thumb: a `<div>` centred on its value with inline `position` and `translate`, around a visually hidden `<input type="range">` that takes focus, carries the slider's ARIA and submits the value. ARIA props given to the thumb (`aria-label`, `aria-labelledby`, `aria-describedby`, `aria-valuetext`) go to that input. Style focus with `:has(:focus-visible)`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `index` | `number` | `0` | Which value this thumb shows: its position in the array for a range. Leave it at 0 for a single-value slider. |
| `disabled` | `boolean` | `false` | Disables this thumb alone. |
| `getAriaLabel` | `(index: number) => string` |  | Names each thumb of a range from its index. Takes precedence over `aria-label`. |
| `getAriaValueText` | `(formattedValue: string, value: number, index: number) => string` | `the formatted value with a `format`; for a two-thumb range, "<value> start range" and "<value> end range"` | The text the input announces for its value, from the formatted value, the value and the thumb's index. |

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Inside a FieldRoot: present once the value has changed. |
| `data-disabled` | Present when the thumb or the whole slider is disabled. |
| `data-dragging` | Present while a pointer is pressing the control or dragging a thumb. |
| `data-filled` | Inside a FieldRoot: present when the field has a value. |
| `data-focused` | Inside a FieldRoot: present while a thumb has focus. |
| `data-index` | The thumb's index in the value array. |
| `data-invalid` | Inside a FieldRoot: present when the field is invalid. |
| `data-orientation` | The slider's orientation: `horizontal` or `vertical`. |
| `data-touched` | Inside a FieldRoot: present once the slider has been focused and left. |
| `data-valid` | Inside a FieldRoot: present when the field has been validated and is valid. |
