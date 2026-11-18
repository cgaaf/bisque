// Generated from image-loading.d.rx by scripts/gen-dts.mjs. Do not edit.
export type ImageSlot = { add: (status: any) => void; remove: (status: any) => void; root: () => HTMLElement | undefined; setRoot: (element: HTMLElement) => void };
export declare function createImageSlot(): ["idle" | "loading" | "loaded" | "error", ImageSlot];
export declare function createImageLoadingStatus(src: string | undefined, srcset: string | undefined, crossOrigin: string | undefined, referrerPolicy: string | undefined, slot: ImageSlot | undefined, loading: string | undefined, priority: string | undefined, sizes: string | undefined): "idle" | "loading" | "loaded" | "error";
export declare function createDelayPassed(delay: number): boolean;
