// TanStack Table's core, bound to Solid 2. This is the one module that imports `@tanstack/table-core`; `.rx`
// reaches it through ../table.js.
//
// The core is framework-agnostic: it keeps every piece of table state in an "atom" and asks its host for the
// atom implementation (`TableReactivityBindings`). Here an atom is a Solid signal or memo, so anything that
// reads the table inside a computation (an `.rx` equation, markup) depends on exactly the state it read.
// `@tanstack/solid-table` does the same for Solid 1 and can't be used: it needs `createComputed`, `observable`
// and `batch`, which Solid 2 doesn't have.
import {
  aggregationFns,
  constructTable,
  createExpandedRowModel,
  createFacetedMinMaxValues,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createGroupedRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFns,
  functionalUpdate,
  sortFns,
  stockFeatures,
  tableFeatures,
} from "@tanstack/table-core";
import {
  $PROXY,
  createEffect,
  createMemo,
  createRoot,
  createSignal,
  deep,
  getOwner,
  latest,
  runWithOwner,
  snapshot,
  untrack,
  type Accessor,
  type Owner,
} from "solid-js";

type Bindings = import("@tanstack/table-core/reactivity").TableReactivityBindings;
type Unsubscribe = { unsubscribe: () => void };
// The table as the parts see it: every stock feature's API, rows of any shape.
// oxlint-disable-next-line typescript/no-explicit-any
type Any = any;
type Stock = import("@tanstack/table-core").StockFeatures;
type CoreTable = import("@tanstack/table-core").Table<Stock, Any>;
type CoreRow = import("@tanstack/table-core").Row<Stock, Any>;
type CoreColumn = import("@tanstack/table-core").Column<Stock, Any, Any>;
type CoreHeader = import("@tanstack/table-core").Header<Stock, Any, Any>;
type CoreHeaderGroup = import("@tanstack/table-core").HeaderGroup<Stock, Any>;
type CoreCell = import("@tanstack/table-core").Cell<Stock, Any, Any>;
type CoreOptions = Omit<import("@tanstack/table-core").TableOptions<Stock, Any>, "features">;

// The core's objects as `.rx` uses them. The core's own types lean on what `.rx` lacks: a row's cells come
// back with a value of type `unknown` (the column's value type is a generic), a column definition's `header`
// may be a render function, and a lookup may be `undefined` with no `!` to say otherwise. Each type below puts
// looser members in front of the core's: of two signatures for one member, TypeScript takes the first.

/** A column. `columnDef` is the definition it was made from; its `header` is whatever you put there. */
export type Column = {
  columnDef: { header?: Any; footer?: Any; cell?: Any; meta?: Any };
  columns: Column[];
  parent?: Column;
  getLeafColumns(): Column[];
  getFlatColumns(): Column[];
} & Omit<CoreColumn, "columns" | "parent">;
export type Cell = { column: Column; row: Row } & CoreCell;
export type Header = { column: Column; subHeaders: Header[]; getLeafHeaders(): Header[] } & Omit<
  CoreHeader,
  "subHeaders"
>;
// An array member replaces the core's outright: `.rx` infers a `for`'s item from the array, and from two arrays
// intersected it takes the core's.
export type HeaderGroup = { headers: Header[] } & Omit<CoreHeaderGroup, "headers">;
export type Row = {
  subRows: Row[];
  getAllCells(): Cell[];
  getVisibleCells(): Cell[];
  getStartVisibleCells(): Cell[];
  getCenterVisibleCells(): Cell[];
  getEndVisibleCells(): Cell[];
  getLeafRows(): Row[];
  getParentRow(): Row | undefined;
  getParentRows(): Row[];
} & Omit<CoreRow, "subRows">;
/** What a row model getter returns: `table.getRowModel().rows`. */
export type RowModel = { rows: Row[]; flatRows: Row[]; rowsById: Record<string, Row> };
type RowModels = {
  [K in keyof CoreTable as K extends `get${string}RowModel` ? K : never]: () => RowModel;
};
type Lists = {
  [K in keyof CoreTable as K extends `get${string}Columns` ? K : never]: () => Column[];
} & {
  [K in keyof CoreTable as K extends `get${string}Headers` ? K : never]: () => Header[];
} & {
  [
    K in keyof CoreTable as K extends `get${string}HeaderGroups` | `get${string}FooterGroups` ? K : never
  ]: () => HeaderGroup[];
} & {
  [K in keyof CoreTable as K extends `get${string}Rows` ? K : never]: () => Row[];
};
/** The table. `getColumn` and `getRow` are typed as finding what they are asked for; the core throws for a row
 * id it doesn't have and returns `undefined` for a column id it doesn't have. */
export type Table = RowModels &
  Lists & {
    getRow(id: string, searchAll?: boolean): Row;
    getColumn(id: string): Column;
  } & CoreTable;

/** `createTable`'s options: the core's, with every `on…Change` taking the new value, and `features` optional. */
export type TableOptions = {
  [K in keyof CoreOptions]: K extends `on${string}Change`
    ? (value: Any) => void
    : K extends "data" | "columns"
      ? readonly Any[]
      : CoreOptions[K];
} & { features?: unknown };

// Lets the core (and an app) listen to an atom outside a computation. The effect lives in a root of its own,
// so it lasts until `unsubscribe`, whatever computation happened to subscribe.
function subscribe<T>(owner: Owner | null, read: Accessor<T>, observer: unknown): Unsubscribe {
  const next = typeof observer === "function" ? observer : (observer as { next?: (v: T) => void }).next;
  return runWithOwner(owner, () =>
    createRoot((dispose) => {
      createEffect(read, (value) => {
        (next as ((v: T) => void) | undefined)?.(value);
      });
      return { unsubscribe: dispose };
    }),
  );
}

/** The core's reactivity bindings on Solid 2 signals. `owner` is the computation that owns the table. */
export function solidBindings(owner: Owner | null): Bindings {
  const subscriptions = new Set<Unsubscribe>();
  return {
    // `table.options` is a plain property: `createTable` puts a live view of the app's options there, which
    // tracks by itself. An options atom would have to be written whenever an option changed, from a
    // computation, which Solid 2 refuses.
    createOptionsStore: false,
    wrapExternalAtoms: true,
    addSubscription: (subscription) => subscriptions.add(subscription),
    unmount: () => {
      for (const subscription of subscriptions) subscription.unsubscribe();
      subscriptions.clear();
    },
    // Solid 2 batches every write until the next flush.
    batch: (fn) => fn(),
    schedule: (fn) => queueMicrotask(fn),
    untrack,
    createWritableAtom: (initial, options) => {
      const equals = options?.compare;
      // A function is a value here (an updater is passed as `set(() => value)`), never a derivation.
      const [read, write] = createSignal<Any>(initial as Any, {
        equals,
        name: options?.debugName,
        // The core writes state from wherever its APIs are called. A row model may reset a page index while
        // it is being read; that goes through `schedule`, but an app calling `table.setSorting` in a
        // component body shouldn't throw either.
        ownedWrite: true,
      });
      const set = (updater: unknown) => {
        write(typeof updater === "function" ? (updater as (old: Any) => Any) : () => updater);
      };
      return Object.assign(read, {
        get: () => read(),
        set,
        subscribe: (observer: unknown) => subscribe(owner, read, observer),
      }) as Any;
    },
    createReadonlyAtom: (fn, options) => {
      // Atoms are created while the table is built, and lazily afterwards: under the table's owner either way,
      // not under whichever computation first asked.
      const read = runWithOwner(owner, () =>
        createMemo(() => fn(), { equals: options?.compare, name: options?.debugName }),
      );
      return Object.assign(read, {
        get: () => read(),
        subscribe: (observer: unknown) => subscribe(owner, read, observer),
      }) as Any;
    },
  };
}

// Every stock feature, row model and built-in function: a table made here can do anything the core can. The
// core is tree-shakeable by feature; an app that wants that passes its own `features` (built in a JS module).
function allFeatures(reactivity: Bindings) {
  return tableFeatures({
    coreReactivityFeature: reactivity,
    ...stockFeatures,
    filteredRowModel: createFilteredRowModel(),
    groupedRowModel: createGroupedRowModel(),
    sortedRowModel: createSortedRowModel(),
    expandedRowModel: createExpandedRowModel(),
    paginatedRowModel: createPaginatedRowModel(),
    facetedRowModel: createFacetedRowModel(),
    facetedMinMaxValues: createFacetedMinMaxValues(),
    facetedUniqueValues: createFacetedUniqueValues(),
    filterFns,
    sortFns,
    aggregationFns,
  } as Any);
}

// `onSortingChange` → `sorting`.
function stateKeyOf(option: string): string | undefined {
  const match = /^on([A-Z])(\w*)Change$/.exec(option);
  return match ? match[1].toLowerCase() + match[2] : undefined;
}

// An `.rx` source that holds an array or object is a Solid store: one proxy for its whole life, changed in
// place. The core decides what to recompute by comparing references, so it would never see such a change. This
// reads the store deeply (so the caller depends on all of it) and hands the core a fresh plain copy.
function plain(value: unknown): unknown {
  if (value == null || typeof value !== "object" || !(value as Any)[$PROXY]) return value;
  deep(value);
  const raw = snapshot(value);
  return Array.isArray(raw) ? [...raw] : { ...raw };
}

// Options the core reads once, when the table is made.
const STATIC = new Set(["features", "atoms", "initialState", "mergeOptions"]);

/**
 * Makes a table from options that stay live: `options` is read again whenever something asks the table for an
 * option, so new `data`, `columns` or controlled `state` reach every row model that used them.
 *
 * Two things differ from the core's own contract, for `.rx`:
 * - An `on…Change` option is called with the new value, never an updater function (`.rx` can't tell them
 *   apart), and in a microtask of its own. The table's own copy of that state is written too, so a table whose
 *   state is only listened to still changes.
 * - An option that is `undefined` means "not given": the core's default applies.
 */
export function createTable(input: Accessor<TableOptions>): Table {
  const options = input as Accessor<Record<string, unknown>>;
  const owner = getOwner();
  const reactivity = solidBindings(owner);
  // The first options, with anything held in a store copied out while nothing is tracking: the core reads
  // them (and clones the state) here, in the component's body.
  const initial = untrack(() => {
    const given = { ...options() };
    for (const key of ["data", "columns"]) given[key] = plain(given[key]);
    if (given.state) {
      const state = { ...(given.state as Record<string, unknown>) };
      for (const key of Object.keys(state)) state[key] = plain(state[key]);
      given.state = state;
    }
    return given;
  });
  const features = (initial.features as Any) ?? allFeatures(reactivity);
  if (!features.coreReactivityFeature) features.coreReactivityFeature = reactivity;
  const table = constructTable({ ...initial, features } as Any) as unknown as Table;

  // What `constructTable` resolved: the features' defaults under the app's first options.
  const defaults = table.options as unknown as Record<string, unknown>;

  // One memo per option, made the first time the core asks for it, so an option keeps its identity until it
  // changes: the core compares `data`, `columns` and each state slice by reference to decide what to redo.
  const memos = new Map<string, Accessor<unknown>>();
  const option = (name: string, read: () => unknown): unknown => {
    let memo = memos.get(name);
    if (!memo) {
      // `latest`: an option the app computed from a write it is still saving (an action in flight) is read as
      // it will be, not held. Read plainly, it would hold everything that reads it beside the table's own
      // state, and the table would stop answering presses until the app's server did.
      memo = runWithOwner(owner, () => createMemo(() => plain(latest(read))));
      memos.set(name, memo);
    }
    return memo();
  };

  const handlers = new Map<string, (updater: unknown) => void>();
  // The value each slice is moving to, until the app has had its say: Solid applies a write at the next flush,
  // so a second update in the same tick (`nextPage()` twice) would otherwise start from the old state.
  const moving = new Map<string, unknown>();
  const handlerFor = (name: string, key: string) => {
    let handler = handlers.get(name);
    if (!handler) {
      handler = (updater) => {
        const atoms = table.atoms as Record<string, { get: () => unknown }>;
        const base = table.baseAtoms as Record<string, { set: (value: unknown) => void } | undefined>;
        const from = moving.has(key) ? moving.get(key) : untrack(() => atoms[key]?.get());
        const next = functionalUpdate(updater as Any, from);
        moving.set(key, next);
        base[key]?.set(() => next);
        const report = untrack(options)[name];
        queueMicrotask(() => {
          // Only the last of a tick's updates is still the one in flight.
          if (moving.get(key) === next) moving.delete(key);
          if (typeof report === "function") report(next);
        });
      };
      handlers.set(name, handler);
    }
    return handler;
  };

  // Controlled state, as an object whose slices are read one by one: a change to `sorting` doesn't give
  // `pagination` a new identity.
  const controlled = createMemo(() => {
    const state = latest(() => options().state) as Record<string, unknown> | undefined;
    if (!state) return undefined;
    const slices = {};
    for (const key of Object.keys(state)) {
      Object.defineProperty(slices, key, {
        enumerable: true,
        get: () =>
          option(`state.${key}`, () => (options().state as Record<string, unknown> | undefined)?.[key]),
      });
    }
    return slices;
  });

  const live = new Proxy(defaults, {
    get(target, key) {
      if (typeof key !== "string" || STATIC.has(key)) return Reflect.get(target, key);
      if (key === "state") return controlled();
      const stateKey = stateKeyOf(key);
      if (stateKey && stateKey in table.baseAtoms) {
        // Whether a handler was given can't change what the core calls: the wrapper looks the handler up.
        return key in untrack(options) || Reflect.get(target, key) === undefined
          ? handlerFor(key, stateKey)
          : Reflect.get(target, key);
      }
      const given = option(key, () => options()[key]);
      return given === undefined ? Reflect.get(target, key) : given;
    },
    has: (target, key) => Reflect.has(target, key) || (typeof key === "string" && key in options()),
  });
  (table as { options: unknown }).options = live;
  // The core's `setOptions` would put a plain object where the live one is, and the table would stop following
  // the app. There is nothing to set: change what `createTable` was given.
  (table as { setOptions: unknown }).setOptions = () => {
    throw new Error("Bisque: a table's options are live. Change the options passed to createTable instead.");
  };
  return table;
}

/** A filter value as an input shows it. */
export function filterText(value: unknown): string {
  return value == null ? "" : `${value as string | number}`;
}

/** Runs one of the core's event handlers (`column.getToggleSortingHandler()`), which read the event themselves. */
export function callHandler(handler: ((event: unknown) => void) | undefined, event: Event): void {
  handler?.(event);
}

/** A column's smallest and largest size, as its definition (or the core's default) gives them. */
export function columnSizeLimits(column: Column): { min: number; max: number } {
  const def = column.columnDef as { minSize?: number; maxSize?: number };
  return { min: def.minSize ?? 20, max: def.maxSize ?? Number.MAX_SAFE_INTEGER };
}

/** Changes a column's size by `delta` pixels, within its limits: the keyboard's way to resize. */
export function nudgeColumnSize(column: Column, delta: number): void {
  const { min, max } = columnSizeLimits(column);
  const next = Math.min(max, Math.max(min, column.getSize() + delta));
  column.table.setColumnSizing((old: Record<string, number>) => ({ ...old, [column.id]: next }));
}

// What the row, cell and header parts show. They are read here, with `?.`, because `.rx` has no optional call
// and a table made with a `features` set of the app's own lacks the methods of the features it left out.

// Each returns the object it returned last time when nothing in it changed. They are read in equations, which
// compare by identity: a column's place is asked again whenever any column is resized, and a fresh but equal
// object would re-run everything below it for every column (Solid reports that as UNSTABLE_MEMO_OUTPUT).
function stable<T extends Record<string, unknown>>(cache: WeakMap<object, T>, of: object, next: T): T {
  const last = cache.get(of);
  if (last && Object.keys(next).every((key) => last[key] === next[key])) return last;
  cache.set(of, next);
  return next;
}
const columnStates = new WeakMap<object, ReturnType<typeof columnState>>();
// A header cell and a body cell of one column differ in size when the header spans several columns.
const headerPlaces = new WeakMap<object, ColumnPlace>();
const columnPlaces = new WeakMap<object, ColumnPlace>();
const rowStates = new WeakMap<object, ReturnType<typeof rowState>>();
const cellStates = new WeakMap<object, ReturnType<typeof cellState>>();

/** How a column is sorted, and whether it is being resized. */
export function columnState(column: Column): { sorted: "asc" | "desc" | undefined; resizing: boolean } {
  const c = column as Any;
  return stable(columnStates, column, {
    sorted: c.getIsSorted?.() || undefined,
    resizing: c.getIsResizing?.() ?? false,
  });
}

/** Where a column's cells go: its size and, when pinned, the side and the distance from that edge, in pixels. */
export type ColumnPlace = {
  size: number | undefined;
  pinned: "start" | "end" | undefined;
  start: number | undefined;
  end: number | undefined;
};

/** `header` is given for a header cell, whose size is the sum of the columns it spans. */
export function columnPlace(column: Column, header: Header | undefined): ColumnPlace {
  const c = column as Any;
  const pinned: "start" | "end" | undefined = c.getIsPinned?.() || undefined;
  return stable(header ? headerPlaces : columnPlaces, header ?? column, {
    size: header ? (header as Any).getSize?.() : c.getSize?.(),
    pinned,
    start: pinned === "start" ? c.getStart?.("start") : undefined,
    end: pinned === "end" ? c.getAfter?.("end") : undefined,
  });
}

export function rowState(row: Row): {
  selected: boolean;
  expanded: boolean;
  grouped: boolean;
  pinned: "top" | "bottom" | undefined;
} {
  const r = row as Any;
  return stable(rowStates, row, {
    selected: r.getIsSelected?.() ?? false,
    expanded: r.getIsExpanded?.() ?? false,
    grouped: r.getIsGrouped?.() ?? false,
    pinned: r.getIsPinned?.() || undefined,
  });
}

export function cellState(cell: Cell): { grouped: boolean; aggregated: boolean; placeholder: boolean } {
  const c = cell as Any;
  return stable(cellStates, cell, {
    grouped: c.getIsGrouped?.() ?? false,
    aggregated: c.getIsAggregated?.() ?? false,
    placeholder: c.getIsPlaceholder?.() ?? false,
  });
}
