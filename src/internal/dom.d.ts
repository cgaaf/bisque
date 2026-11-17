// Generated from dom.d.rx by scripts/gen-dts.mjs. Do not edit.
export declare function createPresence(present: boolean, element: HTMLElement | undefined): [boolean, "starting" | "ending" | undefined];
export declare function createScrollLock(active: boolean): void;
export declare function createRovingFocus(container: HTMLElement | undefined, options: { orientation: "horizontal" | "vertical" | "both"; loop: boolean; typeahead: boolean; tabStop: boolean }): void;
export declare function focusElement(element: HTMLElement | undefined): void;
export declare function clickElement(element: HTMLElement | undefined): void;
export declare function focusListItem(container: HTMLElement | undefined, which: "first" | "last" | "current"): void;
