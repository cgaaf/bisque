# Separator

A line that divides content, horizontally or vertically.

Source after `bisque copy`: `<copy>/separator/separator.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { Separator } from "./bisque/separator/separator.rx"

<Separator />
```

## Separator

Renders `<hr>`. A line between pieces of content: an `<hr>`, which has the separator role and is horizontal by default. Style a vertical one with `[aria-orientation="vertical"]`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `orientation` | `SeparatorOrientation` | `"horizontal"` | Which way the line runs. Only `vertical` writes an attribute, `aria-orientation="vertical"`. |
