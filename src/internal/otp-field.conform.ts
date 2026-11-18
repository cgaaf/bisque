// Generated from otp-field.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/otp-field.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["otpSlotPattern"], (type: "numeric" | "alpha" | "alphanumeric" | "none") => string | undefined>,
  Conforms<Implementation["otpRootPattern"], (type: "numeric" | "alpha" | "alphanumeric" | "none", length: number) => string | undefined>,
  Conforms<Implementation["otpInputMode"], (type: "numeric" | "alpha" | "alphanumeric" | "none") => "numeric" | "text" | undefined>,
  Conforms<Implementation["normalizeOtpValueWithDetails"], (value: string | null | undefined, length: number, type: "numeric" | "alpha" | "alphanumeric" | "none", normalize: ((value: string) => string) | undefined) => { value: string; rejected: boolean }>,
  Conforms<Implementation["normalizeOtpValue"], (value: string | null | undefined, length: number, type: "numeric" | "alpha" | "alphanumeric" | "none", normalize: ((value: string) => string) | undefined) => string>,
  Conforms<Implementation["replaceOtpValue"], (current: string, index: number, next: string, length: number, type: "numeric" | "alpha" | "alphanumeric" | "none", normalize: ((value: string) => string) | undefined) => string>,
  Conforms<Implementation["removeOtpCharacter"], (current: string, index: number) => string>,
  Conforms<Implementation["otpLength"], (value: string) => number>,
  Conforms<Implementation["otpCharAt"], (value: string, index: number) => string>,
  Conforms<Implementation["createSlotOrder"], (root: Accessor<HTMLElement | undefined>) => Accessor<HTMLInputElement[]>>,
  Conforms<Implementation["slotIndex"], (slots: HTMLInputElement[], element: HTMLInputElement | undefined) => number>,
  Conforms<Implementation["createSlotText"], (input: Accessor<HTMLInputElement | undefined>, text: Accessor<string>, revision: Accessor<number>) => void>,
  Conforms<Implementation["restoreSlot"], (input: HTMLInputElement, text: string, select: boolean) => void>,
  Conforms<Implementation["selectSlot"], (input: HTMLInputElement) => void>,
  Conforms<Implementation["focusSlot"], (slots: HTMLInputElement[], index: number) => void>,
  Conforms<Implementation["isFullySelected"], (input: HTMLInputElement) => boolean>,
  Conforms<Implementation["containsNode"], (root: HTMLElement | undefined, node: Node | null) => boolean>,
  Conforms<Implementation["clipboardText"], (event: ClipboardEvent) => string | null>,
  Conforms<Implementation["isAndroid"], () => boolean>,
  Conforms<Implementation["createComposition"], () => { start: () => void; end: () => boolean; active: () => boolean }>,
  Conforms<Implementation["isRtl"], (element: HTMLElement) => boolean>,
  Conforms<Implementation["createOTPWatch"], (value: Accessor<string>, slots: Accessor<HTMLInputElement[]>, completion: Accessor<{ onComplete: ((value: string, details: { reason: "input-change" | "input-paste" }) => void) | undefined; autoSubmit: boolean; hidden: HTMLInputElement | undefined; form: string | undefined }>) => { queueFocus: (index: number, value: string) => void; queueComplete: (value: string, reason: "input-change" | "input-paste") => void; clearComplete: () => void; completeNow: (value: string, reason: "input-change" | "input-paste") => void }>,
  Conforms<Implementation["createLabelFallback"], (slot: Accessor<HTMLInputElement | undefined>, enabled: Accessor<boolean>, id: string) => Accessor<string | undefined>>,
  Conforms<Implementation["joinIds"], (a: string | undefined, b: string | undefined) => string | undefined>,
];
