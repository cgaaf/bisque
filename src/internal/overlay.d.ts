// Generated from overlay.d.rx by scripts/gen-dts.mjs. Do not edit.
export declare function createHoverGroup(timeout: number): any;
export declare function createHoverIntent(enabled: boolean, open: boolean, trigger: HTMLElement | undefined, popup: HTMLElement | undefined, options: { openDelay: number; closeDelay: number; hoverablePopup: boolean; focus: boolean; focusDelay: number; closeOnPress: boolean; group: any; stickOnPress?: boolean }, onOpenChange: (open: boolean, reason: "hover" | "focus" | "press" | "group") => void): void;
export declare function createManualDismiss(active: boolean, trigger: HTMLElement | undefined, popup: HTMLElement | undefined, onDismiss: (reason: "escape-key" | "outside-press") => void): void;
