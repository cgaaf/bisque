# Pagination

Previous and next, numbered pages and ellipses, for moving through a long list.

Source after `bisque copy`: `<copy>/pagination/pagination.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { PaginationRoot, PaginationPrevious, PaginationItem, PaginationEllipsis, PaginationNext, pagination } from "./bisque/pagination/pagination.rx"

// The entries come from the root's context, so they are rendered by a component inside it.
component Pages() {
  c = use pagination
  <ul>
    {for item in c.items {
      <li>
        {if item.type == "page" {
          <PaginationItem value={item.value}>{item.value}</PaginationItem>
        } else {
          <PaginationEllipsis>…</PaginationEllipsis>
        }}
      </li>
    }}
  </ul>
}

<PaginationRoot count={…}>
  <PaginationPrevious />
  <Pages />
  <PaginationNext />
</PaginationRoot>
```

## PaginationRoot

Renders `<nav>`. A `<nav>` labelled "Pagination" that holds the current page and works out which pages and ellipses to show. Its context gives `page`, `pageCount`, `items` (the entries to render, each with a stable `key`) and `setPage`; render the items from a component inside it.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `page` | `number` |  | The current page, from 1. Pass it with `onPageChange` to control the page, or read it from the URL for link-based pagination. It is clamped to the pages there are. |
| `defaultPage` | `number` | `1` | The page shown first, when the page isn't controlled. |
| `onPageChange` | `(page: number) => void` |  | Called with the new page when an item, Previous or Next button is pressed, in a change of its own: it may be an action that fetches the page without holding the control. Links don't call it; following them changes the page. |
| `count` | `number` |  | The number of items being paged through. With `pageSize` it gives the number of pages. Ignored when `pageCount` is given. |
| `pageSize` | `number` | `10` | Items per page, with `count`. |
| `pageCount` | `number` |  | The number of pages, when it is known directly. |
| `siblingCount` | `number` | `1` | Pages shown on each side of the current one. |
| `boundaryCount` | `number` | `1` | Pages always shown at the start and at the end. |

## PaginationItem

Renders `<button>`. A button that goes to one page. It is labelled "Page N" for assistive technology; pass your own `aria-label` to translate it. For a link, spread `paginationItem(use pagination, { value, href })` on an `<a>`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` (required) | `number` |  | The page it goes to: an entry's `value` from the root's `items`. |

| Data attribute | Meaning |
| --- | --- |
| `data-current` | Present on the current page, beside `aria-current="page"`. |

## PaginationEllipsis

Renders `<span>`. A `<span>` that stands for the pages an ellipsis entry skips. It is `aria-hidden`: the page numbers on either side already say that pages are skipped.

## PaginationPrevious

Renders `<button>`. A button that goes to the previous page, disabled on the first. For a link, spread `paginationPrevious(use pagination, { href })` on an `<a>`: disabled, it has no `href`, `role="link"` and `aria-disabled="true"`.

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present on the first page, or when there are no pages. |

## PaginationNext

Renders `<button>`. A button that goes to the next page, disabled on the last. For a link, spread `paginationNext(use pagination, { href })` on an `<a>`: disabled, it has no `href`, `role="link"` and `aria-disabled="true"`.

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present on the last page, or when there are no pages. |
