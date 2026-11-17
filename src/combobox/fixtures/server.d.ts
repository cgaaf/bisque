// Generated from server.d.rx by scripts/gen-dts.mjs. Do not edit.
export type Fruit = { value: string; label: string; query: string };
export declare function search(query: string): Promise<Fruit[]>;
export declare function loadAll(): Promise<Fruit[]>;
