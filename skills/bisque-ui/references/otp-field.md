# OTP Field

A one-time code entered one character per slot.

Source after `bisque copy`: `<copy>/otp-field/otp-field.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { OTPFieldRoot, OTPFieldInput, OTPFieldSeparator } from "./bisque/otp-field/otp-field.rx"

<OTPFieldRoot length={6}>
  <OTPFieldInput />
  <OTPFieldInput />
  <OTPFieldInput />
  <OTPFieldSeparator />
  <OTPFieldInput />
  <OTPFieldInput />
  <OTPFieldInput />
</OTPFieldRoot>
```

## OTPFieldRoot

Renders `<div>`. Holds the code and shares it with the slots inside it, as a group (`role="group"`). It also renders a visually hidden text input that holds the whole code for the form, with the code's `name`, `pattern` and `required`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `length` (required) | `number` |  | The number of slots. Render this many OTPFieldInput parts. |
| `value` | `string` |  | The code. Pass it with `onValueChange` to control the field. Focus moves on to the next slot once the new value shows, so an owner that doesn't take a change leaves focus where it was. It may be read from an answer that is loading or guessed over; one that fails is left to the app's `errored` region. |
| `defaultValue` | `string` | `""` | The code at first, when it isn't controlled; also what a form reset puts back. |
| `onValueChange` | `(value: string, details: OTPFieldChangeDetails) => void` |  | Called whenever the code changes. Receives the code and details whose `reason` is `input-change` (typing, or a fill), `input-clear` (typing that emptied a slot, or a form reset back to empty), `input-paste` or `keyboard` (Backspace and Delete). It is called in a change of its own, so it may save or write something a loading question reads without holding the field. |
| `onValueComplete` | `(value: string, details: OTPFieldEntryDetails) => void` |  | When the last empty slot is filled by typing, a fill or a paste, or a whole code is pasted over a complete one. Called after `onValueChange`, once the value has changed (for a controlled value, once its owner took it). |
| `onValueInvalid` | `(value: string, details: OTPFieldEntryDetails) => void` |  | Typed or pasted text had characters the field dropped (outside the validation type, or past the last slot). `value` is the text as entered. |
| `validationType` | `OTPFieldValidationType` | `"numeric"` | Which characters a slot takes. Default "numeric". |
| `normalizeValue` | `(value: string) => string` |  | Rewrites entered text after whitespace and the validation type are applied (`(v) => v.toUpperCase()`); its result is filtered again and cut to `length`. It runs more than once on one edit, so it must give the same result when run on its own output. |
| `autoComplete` | `string` | `"one-time-code"` | The first slot's and the hidden input's `autocomplete`. Default "one-time-code". |
| `inputMode` | `OTPFieldInputMode` | `"numeric" for digits, "text" for letters` | The slots' `inputmode`. |
| `mask` | `boolean` | `false` | Shows each character as a dot (`type="password"` on the slots). |
| `autoSubmit` | `boolean` | `false` | Submits the form (as its submit button would) when the code is complete. |
| `disabled` | `boolean` | `false` | Whether the slots can't be changed or focused. Also true inside a disabled FieldRoot. A field disabled while a slot has focus (`disabled={pending? check}`) gives focus back to a slot when it is enabled again, if focus hasn't moved elsewhere. |
| `readOnly` | `boolean` | `false` | Whether the slots can be focused and moved between but not changed. `readOnly={pending? check}` keeps the code as it is while it is checked, without losing focus. |
| `required` | `boolean` | `false` | Whether the code is needed for the form to be valid: every slot, and the hidden input, is then required. |
| `name` | `string` |  | With a name (or inside a named FieldRoot), the code is submitted with the form under it. |
| `form` | `string` |  | The id of the form the code belongs to, when it isn't inside it. |
| `id` | `string` |  | The first slot's id, which a `<label for>` names; the others are `${id}-2`, `${id}-3`… |

| Data attribute | Meaning |
| --- | --- |
| `data-complete` | Present when every slot is filled. |
| `data-dirty` | Inside a FieldRoot: present once the code has changed. |
| `data-disabled` | Present when the field is disabled. |
| `data-filled` | Present when at least one slot is filled. |
| `data-focused` | Present while a slot has focus. |
| `data-invalid` | Inside a FieldRoot: present when the field is invalid. |
| `data-readonly` | Present when the field is read-only. |
| `data-required` | Present when the field is required. |
| `data-touched` | Inside a FieldRoot: present once focus has left the slots at least once. |
| `data-valid` | Inside a FieldRoot: present when the field has been validated and is valid. |

## OTPFieldInput

Renders `<input>`. One character's slot: a native text input. Typing fills it and moves to the next; Backspace empties it (or the slot before, from an empty one) and moves back; Delete takes its character out; the arrow keys, Home and End move between slots, and Ctrl or Cmd with an arrow goes to the first slot or the first empty one. A paste or several characters at once are spread from it. Takes every attribute of an `<input>`; a `type` given here wins over `mask`, and an `aria-label` is kept on every slot but the first.

| Data attribute | Meaning |
| --- | --- |
| `data-complete` | Present when every slot is filled. |
| `data-dirty` | Inside a FieldRoot: present once the code has changed. |
| `data-filled` | Present when this slot holds a character. |
| `data-focused` | Present while any slot of the field has focus. |
| `data-invalid` | Inside a FieldRoot: present when the field is invalid. |
| `data-touched` | Inside a FieldRoot: present once focus has left the slots at least once. |
| `data-valid` | Inside a FieldRoot: present when the field has been validated and is valid. |

## OTPFieldSeparator

Renders `<div>`. A separator between groups of slots (`role="separator"`). It carries no behaviour.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `orientation` | `SeparatorOrientation` | `"horizontal"` | The separator's `aria-orientation` and `data-orientation`. |

| Data attribute | Meaning |
| --- | --- |
| `data-orientation` | The orientation: `horizontal` or `vertical`. |
