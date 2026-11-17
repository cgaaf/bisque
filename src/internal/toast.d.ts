// Generated from toast.d.rx by scripts/gen-dts.mjs. Do not edit.
export declare function createToastManager(): import("./impl/toast.ts").ToastManager;
export declare function subscribeToastManager(manager: import("./impl/toast.ts").ToastManager, onAdd: (options: import("./impl/toast.ts").ToastOptions) => void, onUpdate: (id: string, updates: any) => void, onClose: (id: string | undefined) => void): void;
export declare function newToastRecord(options: import("./impl/toast.ts").ToastOptions): import("./impl/toast.ts").ToastRecord;
export declare function updatedToastRecord(previous: import("./impl/toast.ts").ToastRecord, updates: any, restart: boolean): import("./impl/toast.ts").ToastRecord;
export declare function placeToasts(records: import("./impl/toast.ts").ToastRecord[], limit: number): import("./impl/toast.ts").PlacedToast[];
export declare function notifyToasts(records: import("./impl/toast.ts").ToastRecord[], id: string | undefined, which: "onClose" | "onRemove"): void;
export declare function createPausableTimeout(running: boolean, paused: boolean, duration: number, restartKey: number, onElapsed: () => void): void;
export declare function createWindowFocus(): boolean;
export declare function createToastHotkey(active: boolean, viewport: HTMLElement | undefined): void;
export declare function handOffToastFocus(toast: HTMLElement | undefined): void;
export declare function isFocusVisible(target: EventTarget | null): boolean;
export declare function containsTarget(container: EventTarget | null | undefined, target: EventTarget | null): boolean;
export declare function createElementHeight(element: HTMLElement | undefined): number;
export declare function swipeDirections(value: "up" | "down" | "left" | "right" | ("up" | "down" | "left" | "right")[] | undefined, fallback: ("up" | "down" | "left" | "right")[]): ("up" | "down" | "left" | "right")[];
export declare function createToastLayer(viewport: HTMLElement | undefined): void;
export declare function createExitWait(active: boolean, element: HTMLElement | undefined, onDone: () => void): void;
