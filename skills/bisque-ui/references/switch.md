# Switch

A native checkbox with the switch role, for a setting that is on or off.

Source after `bisque copy`: `<copy>/switch/switch.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { SwitchRoot, SwitchThumb } from "./bisque/switch/switch.rx"

<label>
  <SwitchRoot>
    <SwitchThumb />
  </SwitchRoot>
  Label
</label>
```

## SwitchRoot

Renders `<input>`. The switch: a native `<input type="checkbox" role="switch">`, which is also the track. Its children are rendered after it, as its siblings. Style it with `appearance: none`, `:checked`, `:disabled`, `:focus-visible` and `:user-invalid`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `checked` | `boolean` |  | Whether the switch is on. Pass it with `onCheckedChange` to control the switch. It may be read from an answer that is loading or guessed over (`checked={setting}`); one that fails is left to the app's `errored` region. |
| `defaultChecked` | `boolean` | `false` | Whether the switch is on at first, when it isn't controlled. Also its `checked` attribute: what a form reset puts back. |
| `onCheckedChange` | `(checked: boolean) => void` |  | Called with the new state when the user turns the switch on or off, and once when a form reset changes an uncontrolled switch. It is called in a change of its own, so it may be an action that saves: the switch is never held by it. A controlled switch shows `checked` until the owner writes the new state, or guesses it. |
| `disabled` | `boolean` | `false` | Disables the switch natively: it can't be focused or pressed, and `:disabled` matches it. A switch disabled while it has focus (`disabled={pending? setting}`) takes focus back when it is enabled again, if focus hasn't moved elsewhere. |
| `readOnly` | `boolean` | `false` | Keeps the switch focusable but cancels a press or Space, so it doesn't change. Sets `aria-readonly` and `data-readonly`. `readOnly={pending? setting}` locks it while a save is out without losing focus. |
| `required` | `boolean` | `false` | Sets the native `required` attribute: the switch must be on for its form, or its Field, to be valid. |
| `name` | `string` |  | The name the switch submits `value` under while it is on. Inside a FieldRoot, the field's `name` is used when this is absent. |
| `value` | `string` |  | What the switch submits with its form while on; the browser's default is `"on"`. |

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Inside a FieldRoot: present while the switch's state differs from its initial one. |
| `data-filled` | Inside a FieldRoot: present while the switch is on. |
| `data-invalid` | Inside a FieldRoot: present when the field is invalid. |
| `data-readonly` | Present when `readOnly` is set. |
| `data-touched` | Inside a FieldRoot: present once the switch has been focused and left. |
| `data-valid` | Inside a FieldRoot: present when the field has been validated and is valid. |

## SwitchThumb

Renders `<span>`. The moving part, always in the document. Place it in SwitchRoot, where it is the input's next sibling, and move it with `.Switch:checked + .Thumb`. It is `aria-hidden`.
