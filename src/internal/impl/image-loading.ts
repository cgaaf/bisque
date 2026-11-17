// What the avatar needs from the DOM: whether an image source loads, and a delay before a fallback shows.
import { createEffect, createMemo, createSignal, onCleanup, untrack, type Accessor } from "solid-js";

export type ImageLoadingStatus = "idle" | "loading" | "loaded" | "error";

/** Where an avatar's image reports how it is loading, so its root (and the fallback) can read it. */
export type ImageSlot = {
  add: (status: Accessor<ImageLoadingStatus>) => void;
  remove: (status: Accessor<ImageLoadingStatus>) => void;
};

/**
 * The loading status of the image inside an avatar root: "idle" while there is none. Returns it and the slot the
 * image reports to (`createImageLoadingStatus`).
 *
 * The images are kept here, in a signal TypeScript writes, not in a source of the root's: an image leaves when its
 * avatar does, and an avatar in a `for` row that a new answer from a server removes can't call an action from its
 * cleanup (`ACTION_CALLED_IN_OWNED_SCOPE`). Nor does the image pass its status on from an effect: the root reads the
 * image's own status, so a change reaches the image and the fallback in one flush.
 */
export function createImageSlot(): [Accessor<ImageLoadingStatus>, ImageSlot] {
  const [images, setImages] = createSignal<Accessor<ImageLoadingStatus>[]>([], { ownedWrite: true });
  const status = createMemo<ImageLoadingStatus>(() => {
    const list = images();
    return list.length === 0 ? "idle" : list[list.length - 1]();
  });
  const slot: ImageSlot = {
    add: (image) => setImages((list) => [...list, image]),
    remove: (image) => setImages((list) => list.filter((other) => other !== image)),
  };
  return [status, slot];
}

type Source = { src?: string; srcset?: string; crossOrigin?: string; referrerPolicy?: string };
const sameSource = (a: Source, b: Source) =>
  a.src === b.src &&
  a.srcset === b.srcset &&
  a.crossOrigin === b.crossOrigin &&
  a.referrerPolicy === b.referrerPolicy;

/**
 * Loads `src` (or `srcset`) off-screen and reports how it went, so the visible `<img>` can be mounted only once it
 * has loaded. No source at all is an error, which shows the fallback. The status is reported to `slot` while the
 * image exists.
 *
 * "loading" is derived, not written: the status is the outcome recorded for the current source, else "loading".
 * Written by the effect that starts the load, in the flush where the source changed, it would make everything that
 * reads the source and the status run twice for one change (`EFFECT_RELAY_TEAR`). Outcomes are recorded from the
 * image's events, after the flush.
 */
export function createImageLoadingStatus(
  src: Accessor<string | undefined>,
  srcset: Accessor<string | undefined>,
  crossOrigin: Accessor<string | undefined>,
  referrerPolicy: Accessor<string | undefined>,
  slot: ImageSlot | undefined,
): Accessor<ImageLoadingStatus> {
  const [outcome, setOutcome] = createSignal<{ source: Source; status: ImageLoadingStatus } | undefined>(
    undefined,
  );
  const source = createMemo<Source>(
    () => ({ src: src(), srcset: srcset(), crossOrigin: crossOrigin(), referrerPolicy: referrerPolicy() }),
    { equals: sameSource },
  );
  const status = createMemo<ImageLoadingStatus>(() => {
    const next = source();
    if (!next.src && !next.srcset) return "error";
    const known = outcome();
    return known && sameSource(known.source, next) ? known.status : "loading";
  });
  createEffect(
    () => source(),
    (next) => {
      if (!next.src && !next.srcset) return;
      let live = true;
      const image = new window.Image();
      const settle = (value: ImageLoadingStatus) => {
        if (live) setOutcome({ source: next, status: value });
      };
      image.addEventListener("load", () => settle("loaded"));
      image.addEventListener("error", () => settle("error"));
      if (next.referrerPolicy) image.referrerPolicy = next.referrerPolicy;
      image.crossOrigin = (next.crossOrigin ?? null) as HTMLImageElement["crossOrigin"];
      if (next.srcset) image.srcset = next.srcset;
      if (next.src) image.src = next.src;
      // A cached image is complete at once and fires no load event in some browsers. Recorded after this flush.
      if (image.complete) {
        const value = image.naturalWidth > 0 ? "loaded" : "error";
        queueMicrotask(() => settle(value));
      }
      return () => {
        live = false;
      };
    },
  );
  if (slot) {
    slot.add(status);
    onCleanup(() => slot.remove(status));
  }
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
