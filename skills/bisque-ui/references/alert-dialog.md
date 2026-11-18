# Alert Dialog

A dialog that interrupts to ask for a decision.

Source after `bisque copy`: `<copy>/alert-dialog/alert-dialog.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { AlertDialogRoot, AlertDialogTrigger, AlertDialogPopup, AlertDialogTitle, AlertDialogDescription, AlertDialogClose } from "./bisque/alert-dialog/alert-dialog.rx"

<AlertDialogRoot>
  <AlertDialogTrigger />
  <AlertDialogPopup>
    <AlertDialogTitle />
    <AlertDialogDescription />
    <AlertDialogClose />
  </AlertDialogPopup>
</AlertDialogRoot>
```

## AlertDialogRoot

Renders no element of its own. Holds the alert dialog's open state. It is a DialogRoot that is always modal, has `role="alertdialog"` and ignores a press outside.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean` |  | Whether the alert dialog is open. Pass it with `onOpenChange` to control it. |
| `defaultOpen` | `boolean` | `false` | Whether the alert dialog is open at first, when it isn't controlled. |
| `onOpenChange` | `(open: boolean) => void` |  | Called when a part or Escape asks to open or close the alert dialog. A controlled alert dialog changes only when `open` does. It is called in a change of its own, after the alert dialog's: a request it starts, or a handler that is itself an action, doesn't hold it. |

## AlertDialogTrigger

Renders `<button>`. The button that opens the alert dialog. Optional when the dialog is controlled.

| Data attribute | Meaning |
| --- | --- |
| `data-popup-open` | Present while the alert dialog is open. |

## AlertDialogPopup

Renders `<dialog>`. The `<dialog>` element, with `role="alertdialog"`. Style it with `[open]`, `::backdrop`, `@starting-style` and `[data-ending-style]`.

| Data attribute | Meaning |
| --- | --- |
| `data-ending-style` | Present while the alert dialog animates out. It stays open until the transitions and animations on it and its descendants finish. |

## AlertDialogTitle

Renders `<h2>`. A heading that names the alert dialog. The popup's `aria-labelledby` points at it.

## AlertDialogDescription

Renders `<p>`. A paragraph that describes the alert dialog. The popup's `aria-describedby` points at it.

## AlertDialogClose

Renders `<button>`. A button that closes the alert dialog, after running its own `onClick`. Use one for each answer.
