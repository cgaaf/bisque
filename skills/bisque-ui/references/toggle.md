# Toggle

A button that is either pressed or not.

Source after `bisque copy`: `<copy>/toggle/toggle.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { Toggle } from "./bisque/toggle/toggle.rx"

<Toggle />
```

## Toggle

Renders `<button>`. A `<button>` that is pressed or not, with `aria-pressed`. Inside a toggle group the group owns its state; inside a toolbar it is one of the toolbar's items.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `pressed` | `boolean` |  | Whether the toggle is pressed. Pass it with `onPressedChange` to control it. Ignored inside a toggle group. It may be read from an answer that is loading or guessed over (`pressed={setting}`); one that fails is left to the app's `errored` region. |
| `defaultPressed` | `boolean` | `false` | Whether the toggle is pressed at first, when it isn't controlled. |
| `onPressedChange` | `(pressed: boolean) => void` |  | Called with the new state when the toggle is pressed. Inside a group it runs before the group's `onValueChange`. It is called in a change of its own, so it may be an action that saves: the toggle is never held by it. |
| `disabled` | `boolean` | `false` | A disabled toggle doesn't change, and its `onClick` and `onPressedChange` aren't called. It is also disabled when its group is. A toggle disabled while it has focus takes focus back when it is enabled again, if focus hasn't moved elsewhere. |
| `value` | `string` |  | What the toggle stands for in a toggle group's `value`. Give one to every toggle in a group. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the toggle is disabled. |
| `data-pressed` | Present while the toggle is pressed. |
