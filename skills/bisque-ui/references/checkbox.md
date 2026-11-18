# Checkbox

A native checkbox that can be styled whole, with an optional indicator.

Source after `bisque-ui copy`: `<copy>/checkbox/checkbox.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { CheckboxRoot, CheckboxIndicator } from "./bisque/checkbox/checkbox.rx"

<label>
  <CheckboxRoot>
    <CheckboxIndicator />
  </CheckboxRoot>
  Label
</label>
```

## CheckboxRoot

Renders `<input>`. The box: a native `<input type="checkbox">`. Its children are rendered after it, as its siblings. Style it with `appearance: none`, `:checked`, `:indeterminate`, `:disabled`, `:focus-visible` and `:user-invalid`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `checked` | `boolean` |  | Whether the box is checked. Pass it with `onCheckedChange` to control the box. It may be read from an answer that is loading or guessed over (`checked={setting}`); one that fails is left to the app's `errored` region. |
| `defaultChecked` | `boolean` | `false` | Whether the box is checked at first, when it isn't controlled. Also its `checked` attribute: what a form reset puts back. |
| `onCheckedChange` | `(checked: boolean) => void` |  | Called with the new state when the user checks or clears the box, and once when a form reset changes an uncontrolled box. It is called in a change of its own, so it may be an action that saves: the box is never held by it. A controlled box shows `checked` until the owner writes the new state, or guesses it. |
| `indeterminate` | `boolean` | `false` | Shows the box as neither checked nor unchecked; `:indeterminate` matches it. A press clears it and toggles the box, as the browser does, and the box is set back to indeterminate while this stays true. |
| `disabled` | `boolean` | `false` | Disables the box natively: it can't be focused or pressed, and `:disabled` matches it. A box disabled while it has focus (`disabled={pending? setting}`) takes focus back when it is enabled again, if focus hasn't moved elsewhere. |
| `readOnly` | `boolean` | `false` | Keeps the box focusable but cancels a press or Space, so its state doesn't change. Sets `aria-readonly` and `data-readonly`. `readOnly={pending? setting}` locks it while a save is out without losing focus. |
| `required` | `boolean` | `false` | Sets the native `required` attribute: the box must be checked for its form, or its Field, to be valid. |
| `name` | `string` |  | The name the box submits `value` under while it is checked. Inside a FieldRoot, the field's `name` is used when this is absent. |
| `value` | `string` | `""` | What the box submits with its form while checked; the browser's default is `"on"`. Inside a CheckboxGroup, the value the group's list holds while this box is checked. |
| `parent` | `boolean` | `false` | Inside a CheckboxGroup with `allValues`: makes this the box that checks or clears all the others. It is checked when all are, indeterminate when some are, and submits nothing. |

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Inside a FieldRoot: present while the box's state differs from its initial one. |
| `data-filled` | Inside a FieldRoot: present while the box is checked. |
| `data-invalid` | Inside a FieldRoot: present when the field is invalid. |
| `data-parent` | Present on the parent box of a CheckboxGroup. |
| `data-readonly` | Present when `readOnly` is set. |
| `data-touched` | Inside a FieldRoot: present once the box has been focused and left. |
| `data-valid` | Inside a FieldRoot: present when the field has been validated and is valid. |

## CheckboxIndicator

Renders `<span>`. A mark shown beside the box, always in the document. Place it in CheckboxRoot, where it is the box's next sibling, and show it with `.Checkbox:checked + .Indicator` and `.Checkbox:indeterminate + .Indicator`. It is `aria-hidden`: the box's own state is what assistive technology gets.
