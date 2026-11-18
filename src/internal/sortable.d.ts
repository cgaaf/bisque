// Generated from sortable.d.rx by scripts/gen-dts.mjs. Do not edit.
export declare function moveInOrder(order: string[], id: string, index: number): string[];
export declare function moveInLists(lists: Record<string, string[]>, id: string, list: string, index: number): Record<string, string[]>;
export declare function createOrderCache(): import("./impl/sortable.ts").OrderCache;
export declare function cachedOrder(cache: import("./impl/sortable.ts").OrderCache, order: string[]): string[];
export declare function sameOrder(a: string[] | undefined, b: string[] | undefined): boolean;
export declare function sameLists(a: Record<string, string[]> | undefined, b: Record<string, string[]> | undefined): boolean;
export declare function copyLists(lists: Record<string, string[]> | undefined): Record<string, string[]>;
export declare function sortableMessages(messages: Partial<import("./impl/sortable.ts").SortableMessages> | undefined): import("./impl/sortable.ts").SortableMessages;
export declare function createSortable(container: HTMLElement | undefined, options: { disabled: boolean; messages: import("./impl/sortable.ts").SortableMessages }, onStart: (details: import("./impl/sortable.ts").SortableDragDetails) => void, onOver: (details: import("./impl/sortable.ts").SortableDragDetails) => void, onDrop: (details: import("./impl/sortable.ts").SortableDragDetails) => void, onCancel: (details: import("./impl/sortable.ts").SortableDragDetails) => void, announce: (text: string) => void): import("./impl/sortable.ts").SortableDragState;
