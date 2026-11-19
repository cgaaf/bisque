// TanStack Table's core on Solid 2 signals, without `.rx`: what a computation that reads the table sees.
import { createEffect, createMemo, createRoot, createSignal, flush } from "solid-js";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createTable, type Table, type TableOptions } from "./table.ts";

type Person = { id: string; name: string; age: number };
const people: Person[] = [
  { id: "a", name: "Mira", age: 41 },
  { id: "b", name: "Otto", age: 23 },
  { id: "c", name: "Ines", age: 35 },
  { id: "d", name: "Aldo", age: 58 },
  { id: "e", name: "Bea", age: 29 },
];
const columns = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "age", header: "Age" },
];
const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
  flush();
};

let dispose = () => {};
let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn");
  error = vi.spyOn(console, "error");
});
afterEach(() => {
  dispose();
  vi.restoreAllMocks();
});

// A table and a memo over its rows, as markup would read them. `runs` counts the memo's computations.
function setup(options: () => TableOptions) {
  return createRoot((d) => {
    dispose = d;
    const table = createTable(options);
    let runs = 0;
    const names = createMemo(() => {
      runs++;
      return table.getRowModel().rows.map((row) => row.getValue("name") as string);
    });
    // Something has to watch a memo for it to recompute on its own.
    createEffect(names, () => {});
    return { table, names, runs: () => runs };
  });
}
// Solid reports a misuse of its graph on the console.
const quiet = () => {
  expect(warn.mock.calls).toEqual([]);
  expect(error.mock.calls).toEqual([]);
};
const base = (more: Partial<TableOptions> = {}): TableOptions => ({
  data: people,
  columns,
  getRowId: (row: Person) => row.id,
  ...more,
});

test("rows follow sorting", () => {
  const { table, names } = setup(() => base());
  flush();
  expect(names()).toEqual(["Mira", "Otto", "Ines", "Aldo", "Bea"]);
  table.setSorting([{ id: "name", desc: false }]);
  flush();
  expect(names()).toEqual(["Aldo", "Bea", "Ines", "Mira", "Otto"]);
  table.getColumn("age")!.toggleSorting(true);
  flush();
  expect(names()).toEqual(["Aldo", "Mira", "Ines", "Bea", "Otto"]);
  quiet();
});

test("rows follow column and global filters", async () => {
  const { table, names } = setup(() => base());
  table.getColumn("name")!.setFilterValue("o");
  flush();
  expect(names()).toEqual(["Otto", "Aldo"]);
  table.resetColumnFilters();
  table.setGlobalFilter("ine");
  await settle();
  expect(names()).toEqual(["Ines"]);
  quiet();
});

test("rows follow pagination, and two updates in one tick both apply", () => {
  const { table, names } = setup(() => base({ initialState: { pagination: { pageIndex: 0, pageSize: 2 } } }));
  flush();
  expect(names()).toEqual(["Mira", "Otto"]);
  expect(table.getPageCount()).toBe(3);
  table.nextPage();
  table.nextPage();
  flush();
  expect(table.store.state.pagination.pageIndex).toBe(2);
  expect(names()).toEqual(["Bea"]);
  quiet();
});

test("a filter resets the page through the core's scheduler", async () => {
  const { table, names } = setup(() => base({ initialState: { pagination: { pageIndex: 2, pageSize: 2 } } }));
  flush();
  expect(names()).toEqual(["Bea"]);
  table.setGlobalFilter("o");
  await settle();
  expect(table.store.state.pagination.pageIndex).toBe(0);
  expect(names()).toEqual(["Otto", "Aldo"]);
  quiet();
});

test("row selection and column visibility", () => {
  const { table } = setup(() => base());
  const selected = createRoot(() => createMemo(() => table.getSelectedRowModel().rows.map((row) => row.id)));
  table.getRow("b").toggleSelected();
  table.getRow("d").toggleSelected();
  flush();
  expect(selected()).toEqual(["b", "d"]);
  expect(table.getIsSomeRowsSelected()).toBe(true);
  table.toggleAllRowsSelected(true);
  flush();
  expect(table.getIsAllRowsSelected()).toBe(true);

  table.getColumn("age")!.toggleVisibility(false);
  flush();
  expect(table.getVisibleLeafColumns().map((column) => column.id)).toEqual(["name"]);
  expect(table.getHeaderGroups()[0].headers.map((header) => header.id)).toEqual(["name"]);
  quiet();
});

test("new data reaches the rows, and only then", () => {
  const [data, setData] = createSignal(people);
  const [other, setOther] = createSignal(0);
  const { names, runs } = setup(() => base({ data: data(), enableHiding: other() === 0 }));
  flush();
  const before = runs();
  setData(people.slice(0, 2));
  flush();
  expect(names()).toEqual(["Mira", "Otto"]);
  expect(runs()).toBe(before + 1);
  // An option the rows don't depend on: the memo is asked again, and the core answers from its cache.
  const cached = names();
  setOther(1);
  flush();
  expect(names()).toEqual(cached);
  quiet();
});

test("controlled state: the handler gets a value, and the table shows what it is given", async () => {
  const [sorting, setSorting] = createSignal([{ id: "age", desc: false }]);
  const seen: unknown[] = [];
  const { table, names } = setup(() =>
    base({
      state: { sorting: sorting() },
      onSortingChange: (next: { id: string; desc: boolean }[]) => {
        seen.push(next);
        setSorting(next);
      },
    }),
  );
  flush();
  expect(names()).toEqual(["Otto", "Bea", "Ines", "Mira", "Aldo"]);
  table.getColumn("age")!.toggleSorting(true);
  await settle();
  expect(seen).toEqual([[{ id: "age", desc: true }]]);
  expect(names()).toEqual(["Aldo", "Mira", "Ines", "Bea", "Otto"]);
  // The app decides: state it doesn't accept doesn't show.
  setSorting([]);
  flush();
  expect(names()).toEqual(["Mira", "Otto", "Ines", "Aldo", "Bea"]);
  quiet();
});

test("a handler without controlled state only listens", async () => {
  const seen: unknown[] = [];
  const { table, names } = setup(() => base({ onSortingChange: (next: unknown) => seen.push(next) }));
  table.setSorting([{ id: "name", desc: true }]);
  await settle();
  expect(seen).toEqual([[{ id: "name", desc: true }]]);
  expect(names()[0]).toBe("Otto");
  quiet();
});

test("grouping, expanding and aggregation", () => {
  const { table } = setup(() =>
    base({
      data: people.map((person) => Object.assign({ team: person.age > 30 ? "north" : "south" }, person)),
      columns: [...columns, { accessorKey: "team", header: "Team" }],
    }),
  );
  const shown = createRoot(() => createMemo(() => table.getRowModel().rows.map((row) => row.id)));
  table.setGrouping(["team"]);
  flush();
  expect(shown()).toEqual(["team:north", "team:south"]);
  (table as Table).getRow("team:north").toggleExpanded();
  flush();
  expect(shown()).toEqual(["team:north", "a", "c", "d", "team:south"]);
  quiet();
});

test("an atom can be subscribed to from outside a computation", () => {
  const { table } = setup(() => base());
  const seen: unknown[] = [];
  const subscription = table.atoms.sorting.subscribe((value: unknown) => seen.push(value));
  flush();
  table.setSorting([{ id: "name", desc: false }]);
  flush();
  subscription.unsubscribe();
  table.setSorting([]);
  flush();
  expect(seen.at(-1)).toEqual([{ id: "name", desc: false }]);
  quiet();
});

test("with a handler, two updates in one tick both apply, and the handler hears each", async () => {
  const seen: number[] = [];
  const { table, names } = setup(() =>
    base({
      initialState: { pagination: { pageIndex: 0, pageSize: 2 } },
      onPaginationChange: (next: { pageIndex: number }) => seen.push(next.pageIndex),
    }),
  );
  table.nextPage();
  table.nextPage();
  await settle();
  expect(seen).toEqual([1, 2]);
  expect(names()).toEqual(["Bea"]);
  quiet();
});

test("setOptions says what to do instead", () => {
  const { table } = setup(() => base());
  expect(() => table.setOptions((old) => old)).toThrow(/options are live/);
  quiet();
});
