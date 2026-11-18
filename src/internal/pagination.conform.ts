// Generated from pagination.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
type Implementation = typeof import("./impl/pagination.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["paginate"], (options: import("./impl/pagination.ts").PaginationOptions) => import("./impl/pagination.ts").Pagination>,
];
