// Generated from image-loading.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/image-loading.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type ImageSlot = { add: (status: any) => void; remove: (status: any) => void; root: () => HTMLElement | undefined; setRoot: (element: HTMLElement) => void };
export type Checked = [
  Conforms<Implementation["createImageSlot"], () => [Accessor<"idle" | "loading" | "loaded" | "error">, ImageSlot]>,
  Conforms<Implementation["createImageLoadingStatus"], (src: Accessor<string | undefined>, srcset: Accessor<string | undefined>, crossOrigin: Accessor<string | undefined>, referrerPolicy: Accessor<string | undefined>, slot: ImageSlot | undefined, loading: Accessor<string | undefined>, priority: Accessor<string | undefined>, sizes: Accessor<string | undefined>) => Accessor<"idle" | "loading" | "loaded" | "error">>,
  Conforms<Implementation["createDelayPassed"], (delay: Accessor<number>) => Accessor<boolean>>,
];
