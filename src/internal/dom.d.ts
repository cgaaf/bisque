// Generated from dom.d.rx by scripts/gen-dts.mjs. Do not edit.
export declare function createPresence(present: boolean, element: HTMLElement | undefined): [boolean, "starting" | "ending" | undefined];
export declare function createFocusScope(active: boolean, container: HTMLElement | undefined, trap: boolean, initialFocus: "auto" | "container" | "first-item" | "last-item" | "current-item"): void;
export declare function createDismiss(active: boolean, inside: (HTMLElement | undefined)[], onDismiss: (reason: "escape-key" | "outside-press") => void): void;
export declare function createScrollLock(active: boolean): void;
export declare function createFloating(active: boolean, anchor: HTMLElement | undefined, floating: HTMLElement | undefined, options: { side: "top" | "bottom" | "left" | "right"; align: "start" | "center" | "end"; sideOffset: number; alignOffset: number; collisionPadding: number }): ["top" | "bottom" | "left" | "right", "start" | "center" | "end"];
export declare function createRovingFocus(container: HTMLElement | undefined, options: { orientation: "horizontal" | "vertical" | "both"; loop: boolean; typeahead: boolean; tabStop: boolean }): void;
export declare function focusElement(element: HTMLElement | undefined): void;
export declare function clickElement(element: HTMLElement | undefined): void;
export declare function focusListItem(container: HTMLElement | undefined, which: "first" | "last" | "current"): void;
