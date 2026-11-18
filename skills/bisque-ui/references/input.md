# Input

A native text input that works with Field.

Source after `bisque-ui copy`: `<copy>/input/input.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { Input } from "./bisque/input/input.rx"

<Input />
```

## Input

Renders `<input>`. A native `<input>`; any `type` works and every attribute is passed through. Inside a FieldRoot it is the field's control: labelled and described by the field's parts, named and disabled with it, and validated by it.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string` |  | The input's value. Pass it with `onValueChange` to control the input. |
| `defaultValue` | `string` |  | The value at first, when the input isn't controlled. The first value is also the input's `value` attribute: what a form reset puts back. |
| `onValueChange` | `(value: string) => void` |  | Called with the new value on every input, and once when a form reset changes an uncontrolled input. |

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Inside a FieldRoot: present while the value differs from the one it started with. |
| `data-filled` | Inside a FieldRoot: present while the input isn't empty. |
| `data-invalid` | Inside a FieldRoot: present when the field is invalid. |
| `data-touched` | Inside a FieldRoot: present once the input has been focused and left. |
| `data-valid` | Inside a FieldRoot: present when the field has been validated and passed. |
