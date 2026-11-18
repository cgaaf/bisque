# Checkbox Group

A set of checkboxes that share one value: the list of the checked ones.

Source after `bisque-ui copy`: `<copy>/checkbox-group/checkbox-group.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { CheckboxGroup } from "./bisque/checkbox-group/checkbox-group.rx"
import { CheckboxRoot, CheckboxIndicator } from "./bisque/checkbox/checkbox.rx"

<CheckboxGroup>
  <label>
    <CheckboxRoot value="a">
      <CheckboxIndicator />
    </CheckboxRoot>
    Label
  </label>
</CheckboxGroup>
```

## CheckboxGroup

Renders `<div>`. A `<div role="group">` around checkboxes that share one value: the list of the checked boxes' values. Inside a FieldRoot it is the field's control.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string[]` |  | The values of the checked boxes. Pass it with `onValueChange` to control the group. It may be read from an answer that is loading or guessed over (`value={setting}`); one that fails is left to the app's `errored` region. |
| `defaultValue` | `string[]` |  | The values checked at first, when the group isn't controlled. Those boxes carry the `checked` attribute, so a form reset checks them again. |
| `onValueChange` | `(value: string[]) => void` |  | Called with the new list when the user checks or clears a box, or presses the parent box, and once when a form reset changes an uncontrolled group. It is called in a change of its own, so it may be an action that saves: the boxes are never held by it, and a box pressed while a save is out shows on top of the guess. |
| `allValues` | `string[]` |  | Every value a box in the group can have. Needed for a parent box, which checks all of them. |
| `disabled` | `boolean` | `false` | Disables every box in the group natively. |

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Inside a FieldRoot: present while the list differs from its initial one. |
| `data-disabled` | Present when the group is disabled, by its own prop or by its Field or Fieldset. |
| `data-filled` | Inside a FieldRoot: present while at least one box is checked. |
| `data-focused` | Inside a FieldRoot: present while focus is on one of the boxes. |
| `data-invalid` | Inside a FieldRoot: present when the field is invalid. |
| `data-touched` | Inside a FieldRoot: present once focus has been in the group and left it. |
| `data-valid` | Inside a FieldRoot: present when the field has been validated and is valid. |
