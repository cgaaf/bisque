// Generated from menu.d.rx by scripts/gen-dts.mjs. Do not edit.
export declare function createMenuFocus(active: boolean, popup: HTMLElement | undefined, initialFocus: "none" | "container" | "first-item" | "last-item", returnTo: HTMLElement | undefined, restore: boolean): void;
export declare function afterRelease(open: () => void): void;
export declare function afterPointerRelease(event: MouseEvent, open: () => void): void;
export declare function createLongPress(enabled: boolean, element: HTMLElement | undefined, delay: number, onLongPress: (x: number, y: number) => void): void;
export declare function adjacentItem(bar: HTMLElement | undefined, from: HTMLElement | undefined, direction: number, loop: boolean): HTMLElement | undefined;
export declare function elementCorner(element: HTMLElement | undefined): { x: number; y: number };
