# Dialog

A popup that opens on top of the entire page.

Source after `bisque-ui copy`: `<copy>/dialog/dialog.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { DialogRoot, DialogTrigger, DialogPopup, DialogTitle, DialogDescription, DialogClose } from "./bisque/dialog/dialog.rx"

<DialogRoot>
  <DialogTrigger />
  <DialogPopup>
    <DialogTitle />
    <DialogDescription />
    <DialogClose />
  </DialogPopup>
</DialogRoot>
```

## DialogRoot

Renders no element of its own. Holds the dialog's open state and shares it with the parts inside it.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean` |  | Whether the dialog is open. Pass it with `onOpenChange` to control the dialog. |
| `defaultOpen` | `boolean` | `false` | Whether the dialog is open at first, when it isn't controlled. |
| `onOpenChange` | `(open: boolean) => void` |  | Called when a part, Escape or a press outside asks to open or close the dialog. A controlled dialog changes only when `open` does, so it can refuse to close. It is called in a change of its own, after the dialog's: a request it starts, or a handler that is itself an action, doesn't hold the dialog. The owner may answer late (write `open` after an `await`) or guess (`guess open := next`); the dialog follows either way. |
| `modal` | `boolean` | `true` | Whether the dialog is opened with `showModal()`: in the top layer, with a backdrop, the page behind it inert and its scroll locked. With `false` it is opened with `show()` and the page stays usable. |
| `dismissible` | `boolean` | `true` | Whether Escape and a press outside close the dialog. With `false` only its own buttons do. |
| `disablePointerDismissal` | `boolean` | `false` | Whether a press outside is ignored. Escape still closes the dialog. |
| `role` | `"dialog" \| "alertdialog"` | `"dialog"` | The popup's role. `"alertdialog"` is written on the `<dialog>`; AlertDialogRoot sets it. |

## DialogTrigger

Renders `<button>`. The button that opens the dialog. It carries `aria-haspopup`, `aria-expanded` and `aria-controls`.

| Data attribute | Meaning |
| --- | --- |
| `data-popup-open` | Present while the dialog is open. |

## DialogPopup

Renders `<dialog>`. The `<dialog>` element. Style it with `[open]`, `::backdrop`, `@starting-style` and `[data-ending-style]`. Its `aria-labelledby` and `aria-describedby` point at the title and description.

| Data attribute | Meaning |
| --- | --- |
| `data-ending-style` | Present while the dialog animates out. The dialog stays open until the transitions and animations on it and its descendants finish. |

## DialogTitle

Renders `<h2>`. A heading that names the dialog. The popup's `aria-labelledby` points at it.

## DialogDescription

Renders `<p>`. A paragraph that describes the dialog. The popup's `aria-describedby` points at it.

## DialogClose

Renders `<button>`. A button that closes the dialog. In a controlled dialog it asks through `onOpenChange`.
