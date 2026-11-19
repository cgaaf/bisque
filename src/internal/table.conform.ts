// Generated from table.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/table.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["createTable"], (options: Accessor<import("./impl/table.ts").TableOptions>) => import("./impl/table.ts").Table>,
  Conforms<Implementation["filterText"], (value: unknown) => string>,
  Conforms<Implementation["callHandler"], (handler: ((event: any) => void) | undefined, event: Event) => void>,
  Conforms<Implementation["columnSizeLimits"], (column: import("./impl/table.ts").Column) => { min: number; max: number }>,
  Conforms<Implementation["nudgeColumnSize"], (column: import("./impl/table.ts").Column, delta: number) => void>,
  Conforms<Implementation["columnState"], (column: import("./impl/table.ts").Column) => { sorted: "asc" | "desc" | undefined; resizing: boolean }>,
  Conforms<Implementation["columnPlace"], (column: import("./impl/table.ts").Column, header: import("./impl/table.ts").Header | undefined) => import("./impl/table.ts").ColumnPlace>,
  Conforms<Implementation["rowState"], (row: import("./impl/table.ts").Row) => { selected: boolean; expanded: boolean; grouped: boolean; pinned: "top" | "bottom" | undefined }>,
  Conforms<Implementation["cellState"], (cell: import("./impl/table.ts").Cell) => { grouped: boolean; aggregated: boolean; placeholder: boolean }>,
];
