# Table of Contents

A list of links to a document's sections that marks the one being read.

Source after `bisque copy`: `<copy>/table-of-contents/table-of-contents.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { TableOfContentsRoot, TableOfContentsLink, TableOfContentsIndicator } from "./bisque/table-of-contents/table-of-contents.rx"

<TableOfContentsRoot aria-label="On this page">
  <ul>
    <li>
      <TableOfContentsLink href="#install" />
      <ul>
        <li><TableOfContentsLink href="#requirements" /></li>
      </ul>
    </li>
  </ul>
  <TableOfContentsIndicator />
</TableOfContentsRoot>
```

## TableOfContentsRoot

Renders `<nav>`. A `<nav>` that follows which section of the document is being read and marks the link to it. The sections are the targets of the fragment links inside it. Label it with `aria-label`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `activeId` | `string` |  | The id of the section to mark. Pass it with `onActiveChange` to decide which link is marked yourself. |
| `onActiveChange` | `(id: string \| undefined) => void` |  | Called with the id of the new active section when the scroll position names another one or a link is clicked; `undefined` before the first heading reaches the line. |
| `offset` | `number` | `0` | How far below the top of the scroll container a heading counts as reached, in px: the height of a sticky header. Keep the headings' `scroll-margin-top` no larger. |
| `container` | `HTMLElement` |  | The element that scrolls the sections. Without it, the page's own scroll is followed. |

## TableOfContentsLink

Renders `<a>`. A fragment link to one section. It carries `aria-current="location"` while its section is active; clicking it makes it active at once.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `href` | `string` |  | `#` and the id of the section's heading: `"#install"`. |

| Data attribute | Meaning |
| --- | --- |
| `data-active` | Present while the link's section is active. |

## TableOfContentsIndicator

Renders `<span>`. A decorative element that follows the active link, placed with CSS variables measured against the root. Place it inside the root and give the root `position: relative`. It is rendered only while a link is active.

| CSS variable | Meaning |
| --- | --- |
| `--active-link-top` | The active link's top edge, from the root's padding box. |
| `--active-link-left` | The active link's left edge, from the root's padding box. |
| `--active-link-width` | The active link's width. |
| `--active-link-height` | The active link's height. |
