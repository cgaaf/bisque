// What a custom scroll area needs from the DOM: the viewport's real scroll position and sizes, its scrollbars'
// lengths, whether it is scrolling, and a way to scroll it. `../scroll-area.d.rx` declares how `.rx` may call it.
import { createEffect, createSignal, type Accessor } from "solid-js";

type MaybeElement = HTMLElement | undefined;

/** How long after the last scroll `scrollingX`/`scrollingY` stay true, in ms. */
const SCROLL_TIMEOUT = 500;

export type ScrollSnapshot = {
  /** `scrollTop` and `scrollLeft` of the viewport. */
  top: number;
  left: number;
  scrollHeight: number;
  scrollWidth: number;
  clientHeight: number;
  clientWidth: number;
  /** The length of the vertical scrollbar (`offsetHeight`) and its thickness (`offsetWidth`). */
  trackY: number;
  thicknessY: number;
  /** The length of the horizontal scrollbar (`offsetWidth`) and its thickness (`offsetHeight`). */
  trackX: number;
  thicknessX: number;
};

export type ScrollMetrics = ScrollSnapshot & {
  /** True while the viewport scrolls on that axis, and for 500ms after. */
  scrollingX: boolean;
  scrollingY: boolean;
};

const EMPTY: ScrollSnapshot = {
  top: 0,
  left: 0,
  scrollHeight: 0,
  scrollWidth: 0,
  clientHeight: 0,
  clientWidth: 0,
  trackY: 0,
  thicknessY: 0,
  trackX: 0,
  thicknessX: 0,
};

function same(a: ScrollSnapshot, b: ScrollSnapshot): boolean {
  return (Object.keys(a) as (keyof ScrollSnapshot)[]).every((key) => a[key] === b[key]);
}

/**
 * Follows `viewport`'s scroll position and sizes: re-read on every `scroll` event, when the viewport, its
 * content or a scrollbar resizes, and when one of the elements changes. Returns an object whose fields track.
 */
export function createScrollMetrics(
  viewport: Accessor<MaybeElement>,
  scrollbarY: Accessor<MaybeElement>,
  scrollbarX: Accessor<MaybeElement>,
): ScrollMetrics {
  const [snapshot, setSnapshot] = createSignal<ScrollSnapshot>(EMPTY, { equals: same });
  const [scrollingX, setScrollingX] = createSignal(false);
  const [scrollingY, setScrollingY] = createSignal(false);

  createEffect(
    () => [viewport(), scrollbarY(), scrollbarX()] as const,
    ([vp, barY, barX]) => {
      if (!vp) return;
      const read = () => {
        const y = barY?.isConnected ? barY : undefined;
        const x = barX?.isConnected ? barX : undefined;
        setSnapshot({
          top: vp.scrollTop,
          left: vp.scrollLeft,
          scrollHeight: vp.scrollHeight,
          scrollWidth: vp.scrollWidth,
          clientHeight: vp.clientHeight,
          clientWidth: vp.clientWidth,
          trackY: y?.offsetHeight ?? 0,
          thicknessY: y?.offsetWidth ?? 0,
          trackX: x?.offsetWidth ?? 0,
          thicknessX: x?.offsetHeight ?? 0,
        });
      };
      let lastTop = vp.scrollTop;
      let lastLeft = vp.scrollLeft;
      let timerY: ReturnType<typeof setTimeout> | undefined;
      let timerX: ReturnType<typeof setTimeout> | undefined;
      const onScroll = () => {
        if (vp.scrollTop !== lastTop) {
          setScrollingY(true);
          clearTimeout(timerY);
          timerY = setTimeout(() => setScrollingY(false), SCROLL_TIMEOUT);
        }
        if (vp.scrollLeft !== lastLeft) {
          setScrollingX(true);
          clearTimeout(timerX);
          timerX = setTimeout(() => setScrollingX(false), SCROLL_TIMEOUT);
        }
        lastTop = vp.scrollTop;
        lastLeft = vp.scrollLeft;
        read();
      };
      vp.addEventListener("scroll", onScroll, { passive: true });
      // The first reading comes from the observer, which reports every element it starts observing once layout
      // has run, before the next paint. Reading here instead would write the snapshot from inside this effect: a
      // scrollbar that mounts because the content grew (an answer landed) would re-run everything that reads the
      // snapshot twice, once against the old one (EFFECT_RELAY_TEAR).
      const observer = typeof ResizeObserver === "function" ? new ResizeObserver(read) : undefined;
      if (observer) {
        for (const el of [vp, ...vp.children, barY, barX]) if (el instanceof Element) observer.observe(el);
      } else read();
      return () => {
        vp.removeEventListener("scroll", onScroll);
        observer?.disconnect();
        clearTimeout(timerY);
        clearTimeout(timerX);
      };
    },
  );

  return {
    get top() {
      return snapshot().top;
    },
    get left() {
      return snapshot().left;
    },
    get scrollHeight() {
      return snapshot().scrollHeight;
    },
    get scrollWidth() {
      return snapshot().scrollWidth;
    },
    get clientHeight() {
      return snapshot().clientHeight;
    },
    get clientWidth() {
      return snapshot().clientWidth;
    },
    get trackY() {
      return snapshot().trackY;
    },
    get thicknessY() {
      return snapshot().thicknessY;
    },
    get trackX() {
      return snapshot().trackX;
    },
    get thicknessX() {
      return snapshot().thicknessX;
    },
    get scrollingX() {
      return scrollingX();
    },
    get scrollingY() {
      return scrollingY();
    },
  };
}

/** Scrolls `element` to `value` px on one axis. The browser clamps it to the scroll range. */
export function setScrollPosition(element: MaybeElement, axis: "x" | "y", value: number): void {
  if (!element) return;
  if (axis === "y") element.scrollTop = value;
  else element.scrollLeft = value;
}

/** Routes the pointer's further events to `element` (a dragged thumb). A no-op where unsupported. */
export function capturePointer(element: MaybeElement, pointerId: number): void {
  try {
    element?.setPointerCapture?.(pointerId);
  } catch {
    // Not an active pointer (a synthetic event): the drag still works while the pointer stays on the thumb.
  }
}

export function releasePointer(element: MaybeElement, pointerId: number): void {
  try {
    if (element?.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
  } catch {
    // Nothing captured.
  }
}
