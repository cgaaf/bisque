// Generated from file-upload.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/file-upload.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["checkFiles"], (current: File[], incoming: File[], rules: import("./impl/file-upload.ts").FileRules) => import("./impl/file-upload.ts").FileCheck>,
  Conforms<Implementation["fileLimit"], (rules: { multiple: boolean; maxFiles: number | undefined }) => number>,
  Conforms<Implementation["withoutFile"], (files: File[], file: File) => File[]>,
  Conforms<Implementation["filesOf"], (input: HTMLInputElement) => File[]>,
  Conforms<Implementation["handOffFocus"], (button: HTMLElement) => void>,
  Conforms<Implementation["createFileInput"], (element: Accessor<HTMLInputElement | undefined>, files: Accessor<File[]>, revision: Accessor<number>) => void>,
  Conforms<Implementation["createDropZone"], (element: Accessor<HTMLElement | undefined>, options: Accessor<import("./impl/file-upload.ts").DropZoneOptions>, onDrop: (files: File[]) => void) => Accessor<import("./impl/file-upload.ts").DropZoneState>>,
  Conforms<Implementation["createObjectUrl"], (file: Accessor<File | undefined>) => Accessor<string | undefined>>,
  Conforms<Implementation["formatFileSize"], (bytes: number, locale: string | undefined) => string>,
];
