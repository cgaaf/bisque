# Menubar

A row of menus, as at the top of a desktop application.

Source after `bisque copy`: `<copy>/menubar/menubar.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { MenubarRoot } from "./bisque/menubar/menubar.rx"
import { MenuRoot, MenuTrigger, MenuPopup, MenuItem } from "./bisque/menu/menu.rx"

<MenubarRoot>
  <MenuRoot>
    <MenuTrigger />
    <MenuPopup>
      <MenuItem />
    </MenuPopup>
  </MenuRoot>
</MenubarRoot>
```

## MenubarRoot

Renders `<div>`. The bar, with the `menubar` role. The `MenuRoot`s inside it become one composite: their triggers are its items, one Tab stop moved through with the arrow keys, and at most one of their menus is open.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Whether the bar runs `horizontal`ly (ArrowLeft and ArrowRight move along it, ArrowDown opens a menu) or `vertical`ly (ArrowUp and ArrowDown move, ArrowRight opens, and menus open to the right). |
| `loopFocus` | `boolean` | `true` | Whether the arrow keys wrap around at the ends of the bar. |
| `disabled` | `boolean` | `false` | Disables every menu in the bar. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the bar is disabled. |
| `data-has-submenu-open` | Present while one of the bar's menus is open. |
| `data-orientation` | The bar's orientation: `horizontal` or `vertical`. |
