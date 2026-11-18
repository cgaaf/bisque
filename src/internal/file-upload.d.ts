// Generated from file-upload.d.rx by scripts/gen-dts.mjs. Do not edit.
export declare function checkFiles(current: File[], incoming: File[], rules: import("./impl/file-upload.ts").FileRules): import("./impl/file-upload.ts").FileCheck;
export declare function fileLimit(rules: { multiple: boolean; maxFiles: number | undefined }): number;
export declare function withoutFile(files: File[], file: File): File[];
export declare function filesOf(input: HTMLInputElement): File[];
export declare function handOffFocus(button: HTMLElement): void;
export declare function createFileInput(element: HTMLInputElement | undefined, files: File[], revision: number): void;
export declare function createDropZone(element: HTMLElement | undefined, options: import("./impl/file-upload.ts").DropZoneOptions, onDrop: (files: File[]) => void): import("./impl/file-upload.ts").DropZoneState;
export declare function createObjectUrl(file: File | undefined): string | undefined;
export declare function formatFileSize(bytes: number, locale: string | undefined): string;
