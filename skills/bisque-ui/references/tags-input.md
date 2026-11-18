# Tags Input

A text input that turns what is typed into a list of removable tags.

Source after `bisque copy`: `<copy>/tags-input/tags-input.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { tagsInput, TagsInputRoot, TagsInputControl, TagsInputTag, TagsInputTagText, TagsInputTagRemove, TagsInputInput, TagsInputClear } from "./bisque/tags-input/tags-input.rx"

// A tag per value, read from the context.
component Tags() {
  c = use tagsInput
  {for tag in c.tags {
    <TagsInputTag index={tag.index}>
      <TagsInputTagText />
      <TagsInputTagRemove />
    </TagsInputTag>
  }}
}

<TagsInputRoot>
  <TagsInputControl>
    <Tags />
    <TagsInputInput />
    <TagsInputClear />
  </TagsInputControl>
</TagsInputRoot>
```

## TagsInputRoot

Renders `<div>`. Holds the tags and the input's text and shares them with the parts inside it. It also renders a visually hidden polite live region that announces a highlighted or removed tag, and, with a `name` (or inside a named FieldRoot), one hidden `<input>` per tag for the form.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string[]` |  | The tags. Pass it with `onValueChange` to control them. It may be read from an answer that is loading or guessed over; one that fails is left to the app's `errored` region. |
| `defaultValue` | `string[]` |  | The tags at first, when they aren't controlled. A form reset puts them back. |
| `onValueChange` | `(value: string[]) => void` |  | Called with the new tags whenever one is added or removed, or all are cleared. It is called in a change of its own, so it may be an action that saves: the tags and the input are never held by it. |
| `inputValue` | `string` |  | The input's text. Pass it with `onInputValueChange` to control it. |
| `onInputValueChange` | `(value: string) => void` |  | Called with the input's text as it is typed, and with what is left once an entry is added (usually an empty string). |
| `max` | `number` |  | The most tags there may be. An entry past it is refused with the reason `max`. |
| `allowDuplicates` | `boolean` | `false` | Whether the same text may be a tag twice. Otherwise a repeat is refused with the reason `duplicate`. |
| `delimiter` | `string \| null` | `","` | Text that finishes an entry when typed or pasted, as Enter does. `null` for none, so only Enter (and `addOnBlur`, `addOnPaste`) adds. |
| `addOnBlur` | `boolean` | `false` | Add what was typed when the input loses focus. |
| `addOnPaste` | `boolean` | `false` | Add everything pasted at once, split at the delimiter and at line breaks, the last part included. Without it a paste is like typing: the parts before a delimiter are added and the rest stays in the input. |
| `validate` | `(value: string) => boolean` |  | Whether an entry may be a tag. Entries are trimmed first; one it returns false for is refused with the reason `invalid`. It is called synchronously, so it must be a plain function, not an action. |
| `onValueInvalid` | `(details: TagsInputInvalidDetails) => void` |  | Called for each refused entry with `{ value, reason }`, where `reason` is `duplicate`, `max` or `invalid`. The refused text stays in the input to be corrected. |
| `disabled` | `boolean` | `false` | Whether the tags input can't be used or focused. Also true inside a disabled FieldRoot. Disabled while its input has focus (`disabled={pending? saved}`), the input takes focus back when it is enabled again. |
| `readOnly` | `boolean` | `false` | Whether the tags can be read and highlighted but not added or removed. |
| `required` | `boolean` | `false` | Whether at least one tag is needed for the form to be valid. The input is natively `required` while there is no tag, so text typed but not yet added counts as filled and the form submits without it. |
| `name` | `string` |  | The name each tag is submitted under, one entry per tag. Taken from an enclosing FieldRoot when not given. |
| `messages` | `TagsInputMessages` |  | What the live region says: `highlighted(value)`, `removed(value)` and `cleared`. Defaults: "<value>, press Backspace or Delete to remove" (only the value when read-only), "<value> removed" and "All tags removed". |

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Inside a FieldRoot: present once the tags have changed. |
| `data-disabled` | Present when the tags input is disabled. |
| `data-filled` | Inside a FieldRoot: present when there is at least one tag. |
| `data-focused` | Inside a FieldRoot: present while the input has focus. |
| `data-invalid` | Inside a FieldRoot: present when the field is invalid. |
| `data-readonly` | Present when the tags input is read-only. |
| `data-required` | Present when the tags input is required. |
| `data-touched` | Inside a FieldRoot: present once the input has been focused and left. |
| `data-valid` | Inside a FieldRoot: present when the field has been validated and is valid. |

## TagsInputControl

Renders `<div>`. The box that holds the tags and the input. A press on its empty space puts the caret in the input.

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the tags input is disabled. |
| `data-readonly` | Present when the tags input is read-only. |
| `data-required` | Present when the tags input is required. |

## TagsInputTag

Renders `<div>`. One tag. Render one per entry of the `tagsInput` context's `tags`. A press on it highlights it and keeps the caret in the input. It is never focused itself: focus stays in the input.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `index` (required) | `number` |  | The tag's position in the value: `tag.index` for each `tag` of the context's `tags`. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the tags input is disabled. |
| `data-highlighted` | Present while the tag is highlighted: Backspace or Delete removes it. |
| `data-readonly` | Present when the tags input is read-only. |

## TagsInputTagText

Renders `<span>`. The tag's text: its value, unless given children.

| Data attribute | Meaning |
| --- | --- |
| `data-highlighted` | Present while its tag is highlighted. |

## TagsInputTagRemove

Renders `<button>`. A button that removes its tag. Named "Remove <value>" unless given an `aria-label`. It is not in the tab order (Backspace and Delete remove a highlighted tag), and pressing it leaves focus in the input. Disabled while the tags input is disabled or read-only.

## TagsInputInput

Renders `<input>`. The text input. Enter or the delimiter adds what was typed; Backspace or ArrowLeft at the start of the text highlights the last tag. Inside a FieldRoot it is the field's control: labelled by FieldLabel and described by FieldDescription and FieldError.

| Data attribute | Meaning |
| --- | --- |
| `data-dirty` | Inside a FieldRoot: present once the tags have changed. |
| `data-disabled` | Present when the tags input is disabled. |
| `data-filled` | Inside a FieldRoot: present when there is at least one tag. |
| `data-focused` | Inside a FieldRoot: present while the input has focus. |
| `data-invalid` | Inside a FieldRoot: present when the field is invalid. |
| `data-readonly` | Present when the tags input is read-only. |
| `data-required` | Present when the tags input is required. |
| `data-touched` | Inside a FieldRoot: present once the input has been focused and left. |
| `data-valid` | Inside a FieldRoot: present when the field has been validated and is valid. |

## TagsInputClear

Renders `<button>`. A button that removes every tag and the typed text, then puts the caret in the input. Not in the tab order, like the remove buttons. Give it an `aria-label` when its content is an icon.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `keepMounted` | `boolean` | `false` | Render the button even when there is nothing to clear. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the tags input is disabled. |
| `data-readonly` | Present when the tags input is read-only. |
| `data-required` | Present when the tags input is required. |
