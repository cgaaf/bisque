# Tabs

A set of panels on the same page, one shown at a time.

Source after `bisque-ui copy`: `<copy>/tabs/tabs.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { TabsRoot, TabsList, TabsTab, TabsIndicator, TabsPanel } from "./bisque/tabs/tabs.rx"

<TabsRoot>
  <TabsList>
    <TabsTab />
    <TabsIndicator />
  </TabsList>
  <TabsPanel />
</TabsRoot>
```

## TabsRoot

Renders `<div>`. Holds the selected value and shares it with the parts inside it.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string` |  | The selected tab's value. Pass it with `onValueChange` to control the tabs. |
| `defaultValue` | `string` |  | The tab selected at first, when the tabs aren't controlled. Without it, or when it names no tab, the first enabled tab is selected. |
| `onValueChange` | `(value: string) => void` |  | Called with the new value when a tab is selected, after the selection has landed: a handler that starts a request (the panel's content), writes what a loading question reads, or is an action that awaits, never holds the tab, the roving focus or the indicator. A controlled `value` is shown as given, so an owner that writes it late switches late; one that guesses (`guess value := next`) switches at once. |
| `orientation` | `TabsOrientation` | `"horizontal"` | Which arrow keys move between tabs: Left and Right for `horizontal`, Up and Down for `vertical`. |

| Data attribute | Meaning |
| --- | --- |
| `data-activation-direction` | Which way the selection last moved: `left` or `right` when horizontal, `up` or `down` when vertical, and `none` until it first moves. |
| `data-orientation` | The tabs' orientation: `horizontal` or `vertical`. |

## TabsList

Renders `<div>`. The `tablist` that holds the tabs. It is one Tab stop, which lands on the selected tab; the arrow keys, Home and End move between tabs.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `activateOnFocus` | `boolean` | `false` | Whether a tab is selected as soon as the arrow keys focus it. With `false`, the focused tab is selected with Enter or Space. |
| `loopFocus` | `boolean` | `true` | Whether the arrow keys wrap around from the last tab to the first and back. |

| Data attribute | Meaning |
| --- | --- |
| `data-activation-direction` | Which way the selection last moved: `left`, `right`, `up`, `down`, or `none` until it first moves. |
| `data-orientation` | The tabs' orientation: `horizontal` or `vertical`. |

## TabsTab

Renders `<button>`. A button that selects its panel. It carries `role="tab"`, `aria-selected`, and `aria-controls` pointing at its panel while selected.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` (required) | `string` |  | The value that names this tab and the panel it selects. |
| `disabled` | `boolean` | `false` | Whether the tab can't be selected. It stays in the list with `aria-disabled`, is skipped by the arrow keys, and your own click and key handlers on it don't run. |

| Data attribute | Meaning |
| --- | --- |
| `data-activation-direction` | Which way the selection last moved: `left`, `right`, `up`, `down`, or `none` until it first moves. |
| `data-active` | Present on the selected tab. |
| `data-disabled` | Present when the tab is disabled. |
| `data-orientation` | The tabs' orientation: `horizontal` or `vertical`. |

## TabsPanel

Renders `<div>`. The content shown while its tab is selected, with `role="tabpanel"`, labelled by its tab. It is mounted while selected and stays mounted while it animates out.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` (required) | `string` |  | The value of the tab that shows this panel. |
| `keepMounted` | `boolean` | `false` | Whether the panel stays in the document, with `hidden`, while its tab isn't selected. |

| Data attribute | Meaning |
| --- | --- |
| `data-activation-direction` | Which way the selection last moved: `left`, `right`, `up`, `down`, or `none` until it first moves. |
| `data-ending-style` | Present while the panel animates out. It is removed when its transitions and animations finish. |
| `data-hidden` | Present while the panel is kept mounted but its tab isn't selected. |
| `data-orientation` | The tabs' orientation: `horizontal` or `vertical`. |
| `data-starting-style` | Present for the first frame after the panel appears: style the state it animates in from. |

## TabsIndicator

Renders `<span>`. An element that follows the selected tab. Place it inside TabsList and position it with its CSS variables. It is hidden until the selected tab has a size, and absent while no tab is selected.

| Data attribute | Meaning |
| --- | --- |
| `data-activation-direction` | Which way the selection last moved: `left`, `right`, `up`, `down`, or `none` until it first moves. |
| `data-orientation` | The tabs' orientation: `horizontal` or `vertical`. |

| CSS variable | Meaning |
| --- | --- |
| `--active-tab-left` | The selected tab's distance from the list's left padding edge, in px, including the list's scroll. |
| `--active-tab-right` | The distance from the selected tab's right edge to the end of the list's scrollable width, in px. |
| `--active-tab-top` | The selected tab's distance from the list's top padding edge, in px, including the list's scroll. |
| `--active-tab-bottom` | The distance from the selected tab's bottom edge to the end of the list's scrollable height, in px. |
| `--active-tab-width` | The selected tab's width, in px. |
| `--active-tab-height` | The selected tab's height, in px. |
