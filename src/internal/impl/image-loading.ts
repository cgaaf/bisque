// What the avatar needs from the DOM: whether an image source loads, and a delay before a fallback shows.
import { createEffect, createSignal, untrack, type Accessor } from "solid-js";

export type ImageLoadingStatus = "idle" | "loading" | "loaded" | "error";

/**
 * Loads `src` (or `srcset`) off-screen and reports how it went, so the visible `<img>` can be mounted only once it
 * has loaded. No source at all is an error, which shows the fallback.
 */
export function createImageLoadingStatus(
  src: Accessor<string | undefined>,
  srcset: Accessor<string | undefined>,
  crossOrigin: Accessor<string | undefined>,
  referrerPolicy: Accessor<string | undefined>,
): Accessor<ImageLoadingStatus> {
  const [status, setStatus] = createSignal<ImageLoadingStatus>("idle");
  createEffect(
    () => ({ src: src(), srcset: srcset(), crossOrigin: crossOrigin(), referrerPolicy: referrerPolicy() }),
    (next) => {
      if (!next.src && !next.srcset) {
        setStatus("error");
        return;
      }
      let live = true;
      const image = new window.Image();
      const settle = (value: ImageLoadingStatus) => () => {
        if (live) setStatus(value);
      };
      setStatus("loading");
      image.addEventListener("load", settle("loaded"));
      image.addEventListener("error", settle("error"));
      if (next.referrerPolicy) image.referrerPolicy = next.referrerPolicy;
      image.crossOrigin = (next.crossOrigin ?? null) as HTMLImageElement["crossOrigin"];
      if (next.srcset) image.srcset = next.srcset;
      if (next.src) image.src = next.src;
      // A cached image is complete at once and fires no load event in some browsers.
      if (image.complete) setStatus(image.naturalWidth > 0 ? "loaded" : "error");
      return () => {
        live = false;
      };
    },
  );
  return status;
}

/**
 * True once `delay` milliseconds have passed since the first call (at once for 0). Once true it stays true, so a
 * shown fallback isn't hidden again by a later change of delay.
 */
export function createDelayPassed(delay: Accessor<number>): Accessor<boolean> {
  const [passed, setPassed] = createSignal(untrack(delay) <= 0);
  createEffect(
    () => delay(),
    (ms) => {
      if (ms <= 0) {
        setPassed(true);
        return;
      }
      const id = setTimeout(() => setPassed(true), ms);
      return () => clearTimeout(id);
    },
  );
  return passed;
}
