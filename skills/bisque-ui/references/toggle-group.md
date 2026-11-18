# Toggle Group

A set of toggles that share one state.

Source after `bisque copy`: `<copy>/toggle-group/toggle-group.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { ToggleGroup } from "./bisque/toggle-group/toggle-group.rx"
import { Toggle } from "./bisque/toggle/toggle.rx"

<ToggleGroup>
  <Toggle value="…" />
</ToggleGroup>
```

## ToggleGroup

Renders `<div>`. A `<div>` with the `group` role that holds which of its toggles are pressed. It is one Tab stop: the arrow keys, Home and End move between its toggles. Inside a toolbar the toolbar owns the keyboard instead.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string[]` |  | The values of the pressed toggles. Pass it with `onValueChange` to control the group. It may be read from an answer that is loading or guessed over; one that fails is left to the app's `errored` region. |
| `defaultValue` | `string[]` |  | The values pressed at first, when the group isn't controlled. None by default. |
| `onValueChange` | `(value: string[]) => void` |  | Called with the new array of pressed values when a toggle is pressed or released, in a change of its own: it may be an action that saves without holding the group. |
| `multiple` | `boolean` | `false` | Whether several toggles can be pressed at once. Without it, pressing one releases the other. |
| `disabled` | `boolean` | `false` | Disables every toggle in the group. The group is also disabled inside a disabled toolbar or toolbar group. |
| `orientation` | `ToggleGroupOrientation` | `"horizontal"` | Which arrow keys move between the toggles: ArrowLeft and ArrowRight when `horizontal`, ArrowUp and ArrowDown when `vertical`. |
| `loopFocus` | `boolean` | `true` | Whether the arrow keys wrap around at the ends. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the group is disabled. |
| `data-multiple` | Present when several toggles can be pressed at once. |
| `data-orientation` | The group's orientation: `horizontal` or `vertical`. |
