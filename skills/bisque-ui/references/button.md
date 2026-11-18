# Button

A button that can stay focusable while disabled, or be another element.

Source after `bisque-ui copy`: `<copy>/button/button.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { Button } from "./bisque/button/button.rx"

<Button />
```

## Button

Renders `<button>`. A native `<button>` with `type="button"` by default. While disabled your own click, pointer-down, mouse-down and key handlers don't run. For another element, spread the `button` props function on it.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `disabled` | `boolean` | `false` | Whether the button is disabled. It gets the native `disabled` attribute, or `aria-disabled` with `focusableWhenDisabled`. `disabled={pending? value}` disables it while a request is out. A natively disabled button that had focus takes it back when it is enabled again, if focus hasn't moved elsewhere. |
| `focusableWhenDisabled` | `boolean` | `false` | Whether a disabled button stays focusable and keeps its place in the Tab order. It is then disabled with `aria-disabled="true"` and ignores presses, Enter and Space. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present while the button is disabled, whether through `disabled` or `aria-disabled`. |
