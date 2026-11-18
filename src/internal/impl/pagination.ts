// Which page numbers and ellipses a pagination control shows. `.rx` has no `Math` and no loops, so the
// arithmetic lives here; `src/pagination/pagination.rx` calls it through ../pagination.js.

/** One thing to render: a page button, or an ellipsis standing for the pages it hides. */
export type PaginationEntry =
  | { type: "page"; value: number; key: string }
  | { type: "ellipsis"; key: "ellipsis-start" | "ellipsis-end" };

export type PaginationOptions = {
  /** The number of items being paged through. Ignored when `pageCount` is given. */
  count?: number;
  /** Items per page, with `count`. Default: 10. */
  pageSize?: number;
  /** The number of pages, when it is known directly. */
  pageCount?: number;
  /** The current page, from 1. Clamped to the pages there are. */
  page: number;
  /** Pages shown on each side of the current one. Default: 1. */
  siblingCount?: number;
  /** Pages always shown at each end. Default: 1. */
  boundaryCount?: number;
};

export type Pagination = {
  /** The current page clamped to [1, pageCount]; 1 when there are no pages. */
  page: number;
  /** The number of pages, 0 or more. */
  pageCount: number;
  items: PaginationEntry[];
};

function whole(value: number | undefined, fallback: number): number {
  return value != null && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let n = from; n <= to; n++) out.push(n);
  return out;
}

function pages(options: PaginationOptions): number {
  if (options.pageCount != null) return whole(options.pageCount, 0);
  const count = whole(options.count, 0);
  const size = whole(options.pageSize, 10) || 1;
  return Math.ceil(count / size);
}

/**
 * The entries to render for `options`. Once there are more pages than fit, the list always has
 * `2 * boundaryCount + 2 * siblingCount + 3` entries whatever the page, so the control keeps its width as the page
 * changes; with fewer pages it lists them all. An ellipsis never stands for a single page: that page is shown.
 * Every entry has a `key` that names it across pages (`page-3`, `ellipsis-start`), for a keyed loop.
 */
export function paginate(options: PaginationOptions): Pagination {
  const pageCount = pages(options);
  const siblings = whole(options.siblingCount, 1);
  const boundary = whole(options.boundaryCount, 1);
  const page = Math.min(Math.max(whole(options.page, 1), 1), Math.max(pageCount, 1));

  let numbers: (number | "ellipsis-start" | "ellipsis-end")[];
  if (pageCount <= 2 * boundary + 2 * siblings + 3) {
    numbers = range(1, pageCount);
  } else {
    // The window of siblings is slid inward at the ends so that its length, and so the list's, stays the same.
    const start = Math.max(Math.min(page - siblings, pageCount - boundary - 2 * siblings - 1), boundary + 2);
    const end = Math.min(Math.max(page + siblings, boundary + 2 * siblings + 2), pageCount - boundary - 1);
    numbers = [
      ...range(1, boundary),
      // The slot between the first pages and the window: an ellipsis, or the one page it would hide.
      start > boundary + 2 ? "ellipsis-start" : boundary + 1,
      ...range(start, end),
      end < pageCount - boundary - 1 ? "ellipsis-end" : pageCount - boundary,
      ...range(pageCount - boundary + 1, pageCount),
    ];
  }

  const items = numbers.map((n): PaginationEntry =>
    typeof n === "number" ? { type: "page", value: n, key: `page-${n}` } : { type: "ellipsis", key: n },
  );
  return { page, pageCount, items };
}
