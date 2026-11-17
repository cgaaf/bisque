// Generated from number-field.d.rx by scripts/gen-dts.mjs. Do not edit.
export declare function formatNumberValue(value: number | null | undefined, locale: string | string[] | undefined, format: Intl.NumberFormatOptions | undefined): string;
export declare function parseNumberText(text: string, locale: string | string[] | undefined, format: Intl.NumberFormatOptions | undefined): number | null;
export declare function isNumberText(text: string, locale: string | string[] | undefined, format: Intl.NumberFormatOptions | undefined, allowNegative: boolean): boolean;
export declare function validateNumber(value: number | null, step: number | undefined, min: number | undefined, max: number | undefined, format: Intl.NumberFormatOptions | undefined, snapOnStep: boolean, small: boolean, clamp: boolean): number | null;
export declare function isFocused(element: HTMLElement | undefined): boolean;
export declare function focusInputEnd(element: HTMLInputElement | undefined): void;
export declare function restoreInputText(element: HTMLInputElement, text: string): void;
export declare function createPressAndHold(disabled: boolean, tick: (event: MouseEvent) => void, onStop: (event: PointerEvent) => void): { press: (event: PointerEvent) => void; release: (event: PointerEvent) => void; move: (event: PointerEvent) => void; enter: (event: MouseEvent) => void; leave: () => void; skipClick: (event: MouseEvent) => boolean };
export declare function createScrub(area: HTMLElement | undefined, cursor: HTMLElement | undefined, options: { enabled: boolean; direction: "horizontal" | "vertical"; pixelSensitivity: number; teleportDistance: number | undefined }, onScrubbing: (scrubbing: boolean) => void, onStep: (delta: number, event: PointerEvent) => void, onEnd: (event: PointerEvent) => void): { scrubbing: boolean; x: number; y: number; cursor: boolean };
