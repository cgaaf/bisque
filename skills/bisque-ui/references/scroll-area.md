# Scroll Area

A native scroll container with scrollbars you draw yourself.

Source after `bisque-ui copy`: `<copy>/scroll-area/scroll-area.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { ScrollAreaRoot, ScrollAreaViewport, ScrollAreaContent, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaCorner } from "./bisque/scroll-area/scroll-area.rx"

<ScrollAreaRoot>
  <ScrollAreaViewport>
    <ScrollAreaContent />
  </ScrollAreaViewport>
  <ScrollAreaScrollbar>
    <ScrollAreaThumb />
  </ScrollAreaScrollbar>
  <ScrollAreaCorner />
</ScrollAreaRoot>
```

## ScrollAreaRoot

Renders `<div>`. Holds the scroll state and shares it with the parts. Position the scrollbars against it (give it `position: relative`).

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `overflowEdgeThreshold` | `number` | `0` | How far from an edge, in pixels, the content must be scrolled before that edge's `data-overflow-*` attribute appears. |

| Data attribute | Meaning |
| --- | --- |
| `data-has-overflow-x` | Present while the content is wider than the viewport. |
| `data-has-overflow-y` | Present while the content is taller than the viewport. |
| `data-overflow-x-end` | Present while there is more than `overflowEdgeThreshold` pixels of content beyond the right edge. |
| `data-overflow-x-start` | Present while the content is scrolled more than `overflowEdgeThreshold` pixels from its left edge. |
| `data-overflow-y-end` | Present while there is more than `overflowEdgeThreshold` pixels of content below the bottom edge. |
| `data-overflow-y-start` | Present while the content is scrolled more than `overflowEdgeThreshold` pixels from its top. |
| `data-scrolling` | Present while the viewport scrolls on either axis, and for 500ms after. |

| CSS variable | Meaning |
| --- | --- |
| `--scroll-area-corner-width` | The corner's width: the vertical scrollbar's thickness while both scrollbars are shown, else `0px`. |
| `--scroll-area-corner-height` | The corner's height: the horizontal scrollbar's thickness while both scrollbars are shown, else `0px`. |

## ScrollAreaViewport

Renders `<div>`. The element that scrolls: a native scroll container (`overflow: scroll`) whose own scrollbars are hidden with `scrollbar-width: none`. It takes focus (`tabindex="0"`) while its content overflows, so the keyboard can scroll it. Give it the root's size.

| Data attribute | Meaning |
| --- | --- |
| `data-has-overflow-x` | Present while the content is wider than the viewport. |
| `data-has-overflow-y` | Present while the content is taller than the viewport. |
| `data-overflow-x-end` | Present while there is more than `overflowEdgeThreshold` pixels of content beyond the right edge. |
| `data-overflow-x-start` | Present while the content is scrolled more than `overflowEdgeThreshold` pixels from its left edge. |
| `data-overflow-y-end` | Present while there is more than `overflowEdgeThreshold` pixels of content below the bottom edge. |
| `data-overflow-y-start` | Present while the content is scrolled more than `overflowEdgeThreshold` pixels from its top. |
| `data-scrolling` | Present while the viewport scrolls on either axis, and for 500ms after. |

| CSS variable | Meaning |
| --- | --- |
| `--scroll-area-overflow-x-start` | How far the content is scrolled from its left edge, in pixels. |
| `--scroll-area-overflow-x-end` | How much content is beyond the right edge, in pixels. |
| `--scroll-area-overflow-y-start` | How far the content is scrolled from its top, in pixels. |
| `--scroll-area-overflow-y-end` | How much content is below the bottom edge, in pixels. |

## ScrollAreaContent

Renders `<div>`. Wraps the content inside the viewport. It is at least as wide as what it holds (`min-width: fit-content`), which is how horizontal overflow is measured.

| Data attribute | Meaning |
| --- | --- |
| `data-has-overflow-x` | Present while the content is wider than the viewport. |
| `data-has-overflow-y` | Present while the content is taller than the viewport. |
| `data-overflow-x-end` | Present while there is more than `overflowEdgeThreshold` pixels of content beyond the right edge. |
| `data-overflow-x-start` | Present while the content is scrolled more than `overflowEdgeThreshold` pixels from its left edge. |
| `data-overflow-y-end` | Present while there is more than `overflowEdgeThreshold` pixels of content below the bottom edge. |
| `data-overflow-y-start` | Present while the content is scrolled more than `overflowEdgeThreshold` pixels from its top. |

## ScrollAreaScrollbar

Renders `<div>`. A scrollbar, rendered while its axis overflows. Pressing its track scrolls so the thumb centres on the pointer, and the wheel over it scrolls the viewport. Hidden from assistive technology: the viewport is what scrolls.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `orientation` | `ScrollAreaOrientation` | `"vertical"` | Which axis the scrollbar is for. |
| `keepMounted` | `boolean` | `false` | Keep the scrollbar rendered while there is nothing to scroll on its axis. |

| Data attribute | Meaning |
| --- | --- |
| `data-has-overflow-x` | Present while the content is wider than the viewport. |
| `data-has-overflow-y` | Present while the content is taller than the viewport. |
| `data-hovering` | Present while a mouse or pen is over the scroll area. |
| `data-orientation` | The scrollbar's axis: `vertical` or `horizontal`. |
| `data-overflow-x-end` | Present while there is more than `overflowEdgeThreshold` pixels of content beyond the right edge. |
| `data-overflow-x-start` | Present while the content is scrolled more than `overflowEdgeThreshold` pixels from its left edge. |
| `data-overflow-y-end` | Present while there is more than `overflowEdgeThreshold` pixels of content below the bottom edge. |
| `data-overflow-y-start` | Present while the content is scrolled more than `overflowEdgeThreshold` pixels from its top. |
| `data-scrolling` | Present while the viewport scrolls on this scrollbar's axis, and for 500ms after. |

| CSS variable | Meaning |
| --- | --- |
| `--scroll-area-thumb-height` | On a vertical scrollbar: the thumb's height in pixels, the visible share of the content's height (at least 16px). |
| `--scroll-area-thumb-width` | On a horizontal scrollbar: the thumb's width in pixels, the visible share of the content's width (at least 16px). |

## ScrollAreaThumb

Renders `<div>`. The thumb. Its length comes from the scrollbar's `--scroll-area-thumb-height` or `--scroll-area-thumb-width` and its offset is an inline `transform`; drag it to scroll. Give it its thickness.

| Data attribute | Meaning |
| --- | --- |
| `data-orientation` | The scrollbar's axis: `vertical` or `horizontal`. |
| `data-scrolling` | Present while the viewport scrolls on this thumb's axis, and for 500ms after. |

## ScrollAreaCorner

Renders `<div>`. Fills the square where the two scrollbars meet, rendered only while both are. Its width and height are the scrollbars' thickness, set inline; position it in the root's bottom corner.
