// Generated from sortable.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/sortable.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["moveInOrder"], (order: string[], id: string, index: number) => string[]>,
  Conforms<Implementation["moveInLists"], (lists: Record<string, string[]>, id: string, list: string, index: number) => Record<string, string[]>>,
  Conforms<Implementation["createOrderCache"], () => import("./impl/sortable.ts").OrderCache>,
  Conforms<Implementation["cachedOrder"], (cache: import("./impl/sortable.ts").OrderCache, order: string[]) => string[]>,
  Conforms<Implementation["sameOrder"], (a: string[] | undefined, b: string[] | undefined) => boolean>,
  Conforms<Implementation["sameLists"], (a: Record<string, string[]> | undefined, b: Record<string, string[]> | undefined) => boolean>,
  Conforms<Implementation["copyLists"], (lists: Record<string, string[]> | undefined) => Record<string, string[]>>,
  Conforms<Implementation["sortableMessages"], (messages: Partial<import("./impl/sortable.ts").SortableMessages> | undefined) => import("./impl/sortable.ts").SortableMessages>,
  Conforms<Implementation["createSortable"], (container: Accessor<HTMLElement | undefined>, options: Accessor<{ disabled: boolean; messages: import("./impl/sortable.ts").SortableMessages }>, onStart: (details: import("./impl/sortable.ts").SortableDragDetails) => void, onOver: (details: import("./impl/sortable.ts").SortableDragDetails) => void, onDrop: (details: import("./impl/sortable.ts").SortableDragDetails) => void, onCancel: (details: import("./impl/sortable.ts").SortableDragDetails) => void, announce: (text: string) => void) => import("./impl/sortable.ts").SortableDragState>,
];
