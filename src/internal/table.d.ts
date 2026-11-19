// Generated from table.d.rx by scripts/gen-dts.mjs. Do not edit.
export declare function createTable(options: import("./impl/table.ts").TableOptions): import("./impl/table.ts").Table;
export declare function filterText(value: unknown): string;
export declare function callHandler(handler: ((event: any) => void) | undefined, event: Event): void;
export declare function columnSizeLimits(column: import("./impl/table.ts").Column): { min: number; max: number };
export declare function nudgeColumnSize(column: import("./impl/table.ts").Column, delta: number): void;
export declare function columnState(column: import("./impl/table.ts").Column): { sorted: "asc" | "desc" | undefined; resizing: boolean };
export declare function columnPlace(column: import("./impl/table.ts").Column, header: import("./impl/table.ts").Header | undefined): import("./impl/table.ts").ColumnPlace;
export declare function rowState(row: import("./impl/table.ts").Row): { selected: boolean; expanded: boolean; grouped: boolean; pinned: "top" | "bottom" | undefined };
export declare function cellState(cell: import("./impl/table.ts").Cell): { grouped: boolean; aggregated: boolean; placeholder: boolean };
