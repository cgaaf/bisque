# Fieldset

A native fieldset that groups fields under a legend and disables them together.

Source after `bisque copy`: `<copy>/fieldset/fieldset.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { FieldsetRoot, FieldsetLegend } from "./bisque/fieldset/fieldset.rx"

<FieldsetRoot>
  <FieldsetLegend />
</FieldsetRoot>
```

## FieldsetRoot

Renders `<fieldset>`. A native `<fieldset>`: a group named by its legend. Disabling it disables every control inside, and the Fields inside are disabled with it.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `disabled` | `boolean` | `false` | Disables the fieldset natively, which disables every form control inside it; `:disabled` matches the fieldset and those controls. The Fields inside become disabled too. |

## FieldsetLegend

Renders `<legend>`. A native `<legend>` that names the fieldset. Make it the fieldset's first child: only that legend names it. Style a disabled one with `fieldset:disabled > legend`.
