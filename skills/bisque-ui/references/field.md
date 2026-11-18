# Field

Labels a control, describes it, validates it and shows its errors.

Source after `bisque-ui copy`: `<copy>/field/field.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { FieldRoot, FieldLabel, FieldControl, FieldDescription, FieldError, FieldValidity } from "./bisque/field/field.rx"

<FieldRoot>
  <FieldLabel />
  <FieldControl />
  <FieldDescription />
  <FieldError />
  <FieldValidity />
</FieldRoot>
```

## FieldRoot

Renders `<div>`. Groups a control with its label, description and error. It tracks the control’s state, validates it and writes that state as `data-*` attributes on every part.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | `string` |  | The field’s name: the key of its value in a Form’s values and of its entry in a Form’s `errors`. The control takes it as its `name` when it has none. |
| `disabled` | `boolean` | `false` | Disables the field and its control. A disabled field isn’t validated. |
| `validate` | `(value: unknown, formValues: FormValues) => ValidateResult` |  | Custom validation, run after the control’s native constraints pass. Receives the value and the values of the form’s named fields; returns a message or a list of messages when invalid, and `null`, `""` or nothing when valid. |
| `validationMode` | `FormValidationMode` | `the Form's, else "onBlur"` | When the field validates: `"onSubmit"` (when its Form is submitted, then on every change), `"onBlur"` or `"onChange"`. Whatever the mode, the browser checking the input (a native submit, its `invalid` event) validates it. |
| `invalid` | `boolean` |  | Marks the field invalid whatever its value, for a decision made elsewhere. |
| `dirty` | `boolean` |  | Controls the dirty state, instead of comparing the value with the first one. |
| `touched` | `boolean` |  | Controls the touched state, instead of tracking focus. |

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Present while the value differs from the one the control started with. |
| `data-disabled` | Present when the field is disabled, by its own prop or by a disabled Fieldset. |
| `data-filled` | Present while the field has a value: not empty, not unchecked, not an empty list. |
| `data-focused` | Present while the control has focus. |
| `data-invalid` | Present when the field is invalid: it failed validation, has `invalid` set, or has an error from its Form. |
| `data-touched` | Present once the control has been focused and left. |
| `data-valid` | Present when the field has been validated and passed. |

## FieldLabel

Renders `<label>`. A native `<label>` whose `for` names the field’s control, so a press on it focuses or toggles the control. A group control (radio or checkbox group) is labelled by it through `aria-labelledby`.

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Present while the value differs from the one the control started with. |
| `data-disabled` | Present when the field is disabled, by its own prop or by a disabled Fieldset. |
| `data-filled` | Present while the field has a value: not empty, not unchecked, not an empty list. |
| `data-focused` | Present while the control has focus. |
| `data-invalid` | Present when the field is invalid: it failed validation, has `invalid` set, or has an error from its Form. |
| `data-touched` | Present once the control has been focused and left. |
| `data-valid` | Present when the field has been validated and passed. |

## FieldDescription

Renders `<p>`. A paragraph that describes the control. The control’s `aria-describedby` lists it.

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Present while the value differs from the one the control started with. |
| `data-disabled` | Present when the field is disabled, by its own prop or by a disabled Fieldset. |
| `data-filled` | Present while the field has a value: not empty, not unchecked, not an empty list. |
| `data-focused` | Present while the control has focus. |
| `data-invalid` | Present when the field is invalid: it failed validation, has `invalid` set, or has an error from its Form. |
| `data-touched` | Present once the control has been focused and left. |
| `data-valid` | Present when the field has been validated and passed. |

## FieldError

Renders `<div>`. Shown while the field is invalid. Without children it shows the error: the browser’s message for a native constraint, or what `validate` returned, several as a list. With children it shows them instead. While it shows, the control’s `aria-describedby` lists it.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `match` | `boolean \| ValidityKey` |  | Shows the error only for one failure, named by a `ValidityState` key such as `"valueMissing"` or `"patternMismatch"` (`"customError"` for `validate`). `true` shows it always. |

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Present while the value differs from the one the control started with. |
| `data-disabled` | Present when the field is disabled, by its own prop or by a disabled Fieldset. |
| `data-filled` | Present while the field has a value: not empty, not unchecked, not an empty list. |
| `data-focused` | Present while the control has focus. |
| `data-invalid` | Present when the field is invalid: it failed validation, has `invalid` set, or has an error from its Form. |
| `data-touched` | Present once the control has been focused and left. |
| `data-valid` | Present when the field has been validated and passed. |

## FieldValidity

Renders no element of its own. Renders no element. Provides the field’s validity to its children as the `fieldValidity` context: the `ValidityState` flags with `valid` (null until validated), `errors`, `error`, `value` and `initialValue`.

## FieldControl

Renders `<input>`. A native `<input>` that is the field’s control. The same as Input; any `type` works.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string` |  | The input’s value. Pass it with `onValueChange` to control the input. |
| `defaultValue` | `string` |  | The value at first, when the input isn’t controlled. The first value is also the input’s `value` attribute: what a form reset puts back. |
| `onValueChange` | `(value: string) => void` |  | Called with the new value on every input, and once when a form reset changes an uncontrolled input. |

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Present while the value differs from the one the control started with. |
| `data-filled` | Present while the field has a value: not empty, not unchecked, not an empty list. |
| `data-invalid` | Present when the field is invalid: it failed validation, has `invalid` set, or has an error from its Form. |
| `data-touched` | Present once the control has been focused and left. |
| `data-valid` | Present when the field has been validated and passed. |
