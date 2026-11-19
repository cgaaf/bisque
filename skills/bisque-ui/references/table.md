# Table

A data table on a native table element: sorting, filtering, selection, paging, column sizing and grouping, with TanStack Table keeping the state.

Source after `bisque copy`: `<copy>/table/table.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { createTable } from "./bisque/internal/table.js"
import { TableColumnHeader, TableSortTrigger, TableRow, TableCell } from "./bisque/table/table.rx"

table = createTable({ data: people, columns: columns, getRowId: row => row.id })
ids = table.getRowModel().rows.map(row => row.id)

<table>
  <thead>
    {for group in table.getHeaderGroups() {
      <tr>
        {for header in group.headers {
          <TableColumnHeader header={header}>
            <TableSortTrigger column={header.column}>{header.column.columnDef.header}</TableSortTrigger>
          </TableColumnHeader>
        }}
      </tr>
    }}
  </thead>
  <tbody>
    {for id in ids {
      row = table.getRow(id)
      <TableRow row={row}>
        {for cell in row.getVisibleCells() {
          <TableCell cell={cell}>{cell.getValue()}</TableCell>
        }}
      </TableRow>
    }}
  </tbody>
</table>
```

## TableColumnHeader

Renders `<th>`. A column's header cell, a `<th>`. It carries `aria-sort` while its column is sorted, spans the columns a group header stands over, and holds the column's size and pinned offset as custom properties.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `header` (required) | `TableHeaderInstance` |  | The header this cell is for: one of `group.headers` from `table.getHeaderGroups()`, or of `table.getFlatHeaders()`. |

| Data attribute | Meaning |
| --- | --- |
| `data-column` | The column's id. |
| `data-pinned` | `start` or `end` while the column is pinned. |
| `data-placeholder` | Present on a header that only fills the space above a column in a deeper header group. |
| `data-resizing` | Present while the column is being resized. |
| `data-sorted` | `asc` or `desc` while the column is sorted. |

| CSS variable | Meaning |
| --- | --- |
| `--column-size` | The column's size in pixels. |
| `--column-start` | On a column pinned to the start: its distance from the table's start edge. |
| `--column-end` | On a column pinned to the end: its distance from the table's end edge. |

## TableSortTrigger

Renders `<button>`. A button that sorts by its column: ascending, descending, then unsorted, in the order the column's options give. With Shift held it adds the column to the sort. Disabled for a column that can't be sorted. Put it in the column's header cell.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `column` (required) | `TableColumnInstance` |  | The column to sort by: `header.column`. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the column can't be sorted. |
| `data-sort-index` | Where the column stands among the sorted columns, from 0. |
| `data-sorted` | `asc` or `desc` while the column is sorted. |

## TableColumnResizer

Renders `<span>`. A handle that resizes its column by dragging. It is a focusable `separator` whose value is the column's size: the arrow keys resize it, Home and End go to its smallest and largest size, and a double click puts the size back. Give it an `aria-label` that names the column.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `header` (required) | `TableHeaderInstance` |  | The header whose column the handle resizes. |
| `step` | `number` | `10` | Pixels an arrow key changes the size by. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the column can't be resized. |
| `data-resizing` | Present while the column is being resized. |

## TableRow

Renders `<tr>`. A body row, a `<tr>`, with its state as `data-*` attributes to style by.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `row` (required) | `TableRowInstance` |  | The row: `table.getRow(id)`. |

| Data attribute | Meaning |
| --- | --- |
| `data-depth` | How deep the row is in a tree or under group rows, from 0. |
| `data-expanded` | Present while the row is expanded. |
| `data-grouped` | Present on a group's own row. |
| `data-pinned` | `top` or `bottom` while the row is pinned. |
| `data-row` | The row's id. |
| `data-selected` | Present while the row is selected. |

## TableCell

Renders `<td>`. A body cell, a `<td>`, with its column's size and pinned offset as custom properties.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `cell` (required) | `TableCellInstance` |  | The cell: one of `row.getVisibleCells()`. |

| Data attribute | Meaning |
| --- | --- |
| `data-aggregated` | In a group's row: present on a cell that holds the group's aggregate. |
| `data-column` | The column's id. |
| `data-grouped` | In a group's row: present on the cell that names the group. |
| `data-pinned` | `start` or `end` while the column is pinned. |
| `data-placeholder` | Under a group: present on the grouped column's cell, which stays empty. |

| CSS variable | Meaning |
| --- | --- |
| `--column-size` | The column's size in pixels. |
| `--column-start` | On a column pinned to the start: its distance from the table's start edge. |
| `--column-end` | On a column pinned to the end: its distance from the table's end edge. |

## TableSelectRow

Renders `<input>`. A checkbox that selects its row: a CheckboxRoot wired to the table. Shift with a press selects every row from the last one pressed to this one. It is mixed while only some of the row's sub-rows are selected, and disabled for a row that can't be selected. Labelled "Select row": pass an `aria-label` that names the row.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `row` (required) | `TableRowInstance` |  | The row the box selects. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the row can't be selected. |

## TableSelectAll

Renders `<input>`. A checkbox that selects every row, or every row on the current page: checked when all are selected, mixed when some are. A CheckboxRoot wired to the table, labelled "Select all rows".

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `table` (required) | `TableInstance` |  | The table. |
| `scope` | `"all" \| "page"` | `"all"` | Which rows the box stands for: `all`, or the rows on the current `page`. |

## TableExpandTrigger

Renders `<button>`. A button that shows and hides what is under its row: sub-rows, a group's rows, or a detail row the app renders while `row.getIsExpanded()`. It carries `aria-expanded`, and is disabled for a row with nothing under it.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `row` (required) | `TableRowInstance` |  | The row to expand. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the row has nothing to show. |
| `data-expanded` | Present while the row is expanded. |

## TableColumnFilter

Renders `<input>`. A text input that filters by its column: rows are kept while the column's value matches what is typed, as the column's `filterFn` decides. Empty means no filter. Disabled for a column that can't be filtered.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `column` (required) | `TableColumnInstance` |  | The column to filter by. |

| Data attribute | Meaning |
| --- | --- |
| `data-filtered` | Present while the column has a filter. |

## TableGlobalFilter

Renders `<input>`. A search input over every column that allows it: rows are kept while any of those columns matches. Empty means no filter.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `table` (required) | `TableInstance` |  | The table. |

| Data attribute | Meaning |
| --- | --- |
| `data-filtered` | Present while there is a search. |

## TableColumnToggle

Renders `<input>`. A checkbox that shows and hides its column: a CheckboxRoot wired to the table. Disabled for a column that can't be hidden. Label it with the column's name.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `column` (required) | `TableColumnInstance` |  | The column to show and hide. |

| Data attribute | Meaning |
| --- | --- |
| `data-disabled` | Present when the column can't be hidden. |

## TablePagination

Renders `<nav>`. A PaginationRoot whose page is the table's. Put Pagination's own parts inside it, and read `use pagination` for the page numbers.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `table` (required) | `TableInstance` |  | The table. |
| `siblingCount` | `number` | `1` | Pages shown on each side of the current one. |
| `boundaryCount` | `number` | `1` | Pages always shown at the start and at the end. |
