// Generated from scroll-area.d.rx by scripts/gen-dts.mjs. Do not edit.
export declare function createScrollMetrics(viewport: HTMLElement | undefined, scrollbarY: HTMLElement | undefined, scrollbarX: HTMLElement | undefined): { top: number; left: number; scrollHeight: number; scrollWidth: number; clientHeight: number; clientWidth: number; trackY: number; thicknessY: number; trackX: number; thicknessX: number; scrollingX: boolean; scrollingY: boolean };
export declare function setScrollPosition(element: HTMLElement | undefined, axis: "x" | "y", value: number): void;
export declare function capturePointer(element: HTMLElement | undefined, pointerId: number): void;
export declare function releasePointer(element: HTMLElement | undefined, pointerId: number): void;
