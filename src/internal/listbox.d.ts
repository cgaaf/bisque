// Generated from listbox.d.rx by scripts/gen-dts.mjs. Do not edit.
export declare function createTypeahead(): [(container: HTMLElement | undefined, key: string, current: string | undefined) => HTMLElement | undefined, () => void];
export declare function elementText(element: HTMLElement | undefined): string;
export declare function itemValue(element: EventTarget | null | undefined): string | undefined;
export declare function adjacentItemId(list: HTMLElement | undefined, currentId: string | undefined, direction: "next" | "previous" | "first" | "last", loop: boolean): string | undefined;
export declare function scrollItemIntoView(list: HTMLElement | undefined, id: string | undefined): void;
export declare function itemLabel(list: HTMLElement | undefined, id: string | undefined): string | undefined;
export declare function clickItem(list: HTMLElement | undefined, id: string | undefined): void;
export declare function itemIdByValue(list: HTMLElement | undefined, value: string | undefined): string | undefined;
export declare function matchesFilter(filter: ((label: string, query: string) => boolean) | undefined, label: string, query: string): boolean;
export declare function createOnShow(popup: HTMLElement | undefined, onShown: () => void): void;
export declare function createOutsidePress(active: boolean, inside: (HTMLElement | undefined)[], onOutside: () => void): void;
