// Generated from dom.d.rx by scripts/gen-dts.mjs. Do not edit.
export declare function createPresence(present: boolean, element: HTMLElement | undefined): [boolean, "starting" | "ending" | undefined];
export declare function createFocusScope(active: boolean, container: HTMLElement | undefined, trap: boolean): void;
export declare function createDismiss(active: boolean, inside: (HTMLElement | undefined)[], onDismiss: (reason: "escape-key" | "outside-press") => void): void;
export declare function createScrollLock(active: boolean): void;
export declare function focusElement(element: HTMLElement | undefined): void;
