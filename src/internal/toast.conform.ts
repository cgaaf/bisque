// Generated from toast.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/toast.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["createToastManager"], () => import("./impl/toast.ts").ToastManager>,
  Conforms<Implementation["subscribeToastManager"], (manager: Accessor<import("./impl/toast.ts").ToastManager>, onAdd: (options: import("./impl/toast.ts").ToastOptions) => void, onUpdate: (id: string, updates: any) => void, onClose: (id: string | undefined) => void) => void>,
  Conforms<Implementation["newToastRecord"], (options: import("./impl/toast.ts").ToastOptions) => import("./impl/toast.ts").ToastRecord>,
  Conforms<Implementation["updatedToastRecord"], (previous: import("./impl/toast.ts").ToastRecord, updates: any, restart: boolean) => import("./impl/toast.ts").ToastRecord>,
  Conforms<Implementation["placeToasts"], (records: import("./impl/toast.ts").ToastRecord[], limit: number) => import("./impl/toast.ts").PlacedToast[]>,
  Conforms<Implementation["toastCallbacks"], (records: import("./impl/toast.ts").ToastRecord[], id: string | undefined, which: "onClose" | "onRemove") => (() => void)[]>,
  Conforms<Implementation["callToasts"], (callbacks: (() => void)[]) => void>,
  Conforms<Implementation["createPausableTimeout"], (running: Accessor<boolean>, paused: Accessor<boolean>, duration: Accessor<number>, restartKey: Accessor<number>, onElapsed: () => void) => void>,
  Conforms<Implementation["createWindowFocus"], () => Accessor<boolean>>,
  Conforms<Implementation["createToastHotkey"], (active: Accessor<boolean>, viewport: Accessor<HTMLElement | undefined>) => void>,
  Conforms<Implementation["handOffToastFocus"], (toast: HTMLElement | undefined) => void>,
  Conforms<Implementation["isFocusVisible"], (target: EventTarget | null) => boolean>,
  Conforms<Implementation["containsTarget"], (container: EventTarget | null | undefined, target: EventTarget | null) => boolean>,
  Conforms<Implementation["createElementHeight"], (element: Accessor<HTMLElement | undefined>) => Accessor<number>>,
  Conforms<Implementation["swipeDirections"], (value: "up" | "down" | "left" | "right" | ("up" | "down" | "left" | "right")[] | undefined, fallback: ("up" | "down" | "left" | "right")[]) => ("up" | "down" | "left" | "right")[]>,
  Conforms<Implementation["createToastLayer"], (viewport: Accessor<HTMLElement | undefined>) => void>,
  Conforms<Implementation["createExitWait"], (active: Accessor<boolean>, element: Accessor<HTMLElement | undefined>, onDone: () => void) => void>,
];
