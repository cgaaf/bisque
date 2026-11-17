// Generated from overlay.d.rx by scripts/gen-dts.mjs. Do not edit.
export declare function createHoverGroup(timeout: number): any;
export declare function createHoverIntent(enabled: boolean, open: boolean, trigger: HTMLElement | undefined, popup: HTMLElement | undefined, options: { openDelay: number; closeDelay: number; hoverablePopup: boolean; focus: boolean; focusDelay: number; closeOnPress: boolean; group: any }, onOpenChange: (open: boolean, reason: "hover" | "focus" | "press" | "group") => void): void;
export declare function createArrow(active: boolean, anchor: HTMLElement | undefined, floating: HTMLElement | undefined, arrow: HTMLElement | undefined, side: "top" | "bottom" | "left" | "right"): boolean;
export declare function createPopupFocus(active: boolean, popup: HTMLElement | undefined, trigger: HTMLElement | undefined, trap: boolean, onFocusOut: () => void): void;
