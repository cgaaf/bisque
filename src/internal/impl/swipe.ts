// Swipe to dismiss, for toasts and drawers. `../swipe.d.rx` declares how `.rx` may call it, through the
// `../swipe.js` facade.
import { createEffect, createSignal, untrack, type Accessor } from "solid-js";

type MaybeElement = HTMLElement | undefined;
export type SwipeDirection = "up" | "down" | "left" | "right";

export type SwipeOptions = {
  enabled: boolean;
  /** The directions a swipe may dismiss in. Movement the other way is damped. */
  directions: SwipeDirection[];
  /** How far (px) a swipe must travel to dismiss. `0` or less: half the element's size along the direction. */
  threshold: number;
  /** A release this fast (px/ms) in a dismiss direction dismisses whatever the distance. `0`: off. */
  velocity: number;
  /** A mouse press inside an element matching this selector doesn't start a swipe, so its text can be selected. */
  textSelector: string;
};

export type SwipeState = {
  /** True while a pointer is dragging the element. */
  swiping: boolean;
  /** The direction being swiped, and after a dismissing swipe, the one it left in. */
  direction: SwipeDirection | undefined;
  /** How far the element has been dragged, in px (damped against the dismiss directions). */
  x: number;
  y: number;
  /** The drag along the swipe direction as a fraction of the element's size: 0 to 1. */
  progress: number;
};

// Presses on these never start a swipe, so a toast's buttons still click.
const IGNORE = 'button,a,input,select,textarea,label,[role="button"],[data-swipe-ignore]';
// How far back a swipe in one direction must come to be called off.
const REVERSE_CANCEL = 10;
const MIN_THRESHOLD = 10;
// Velocity is measured over at least this long, so a short tap-and-release isn't a flick.
const MIN_VELOCITY_MS = 50;

export function displacement(direction: SwipeDirection, dx: number, dy: number): number {
  if (direction === "up") return -dy;
  if (direction === "down") return dy;
  if (direction === "left") return -dx;
  return dx;
}

function sizeAlong(element: HTMLElement, direction: SwipeDirection): number {
  return direction === "left" || direction === "right" ? element.offsetWidth : element.offsetHeight;
}

function inside(element: HTMLElement, event: PointerEvent): boolean {
  const box = element.getBoundingClientRect();
  return (
    event.clientX >= box.left &&
    event.clientX <= box.right &&
    event.clientY >= box.top &&
    event.clientY <= box.bottom
  );
}

function damp(delta: number): number {
  return delta > 0 ? Math.sqrt(delta) : -Math.sqrt(-delta);
}

/**
 * Lets a pointer drag `element` and dismiss it by swiping in one of `options.directions`. Below the threshold
 * the drag snaps back (`x`, `y` and `progress` return to 0); past it, `onDismiss` is called with the direction
 * and the offset is kept, so the element can animate out from where it was let go. The offset resets when the
 * swipe is enabled again.
 */
export function createSwipe(
  element: Accessor<MaybeElement>,
  options: Accessor<SwipeOptions>,
  onDismiss: (direction: SwipeDirection) => void,
): SwipeState {
  const [swiping, setSwiping] = createSignal(false);
  const [direction, setDirection] = createSignal<SwipeDirection | undefined>(undefined);
  const [offset, setOffset] = createSignal({ x: 0, y: 0, progress: 0 });

  const reset = () => {
    setSwiping(false);
    setDirection(undefined);
    setOffset({ x: 0, y: 0, progress: 0 });
  };

  createEffect(
    () => options().enabled,
    (enabled, before) => {
      if (enabled && before === false) reset();
    },
  );

  createEffect(
    () => (options().enabled ? element() : undefined),
    (el) => {
      if (!el) return;
      let pointerId: number | undefined;
      let start = { x: 0, y: 0, time: 0 };
      let moved = false;
      let lock: "horizontal" | "vertical" | undefined;
      let intended: SwipeDirection | undefined;
      let maxDisplacement = 0;
      let cancelled = false;
      let current = { dx: 0, dy: 0 };

      const threshold = (dir: SwipeDirection) => {
        const given = untrack(options).threshold;
        return given > 0 ? given : Math.max(sizeAlong(el, dir) * 0.5, MIN_THRESHOLD);
      };

      const onPointerDown = (event: PointerEvent) => {
        if (event.button !== 0 || pointerId !== undefined) return;
        if (!untrack(options).enabled) return;
        // A press on a dialog's ::backdrop targets the dialog itself, outside its box: that is not a swipe.
        if (event.target === el && !inside(el, event)) return;
        if (event.target instanceof Element) {
          if (event.target.closest(IGNORE)) return;
          const text = untrack(options).textSelector;
          if (text !== "" && event.pointerType === "mouse" && event.target.closest(text)) return;
        }
        pointerId = event.pointerId;
        start = { x: event.clientX, y: event.clientY, time: Date.now() };
        moved = false;
        lock = undefined;
        intended = undefined;
        maxDisplacement = 0;
        cancelled = false;
        current = { dx: 0, dy: 0 };
        try {
          el.setPointerCapture?.(event.pointerId);
        } catch {
          // The pointer is no longer active (Firefox throws then); the document listeners still follow it.
        }
        document.addEventListener("pointermove", onPointerMove);
        document.addEventListener("pointerup", onPointerUp);
        document.addEventListener("pointercancel", onPointerUp);
      };

      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) return;
        const directions = untrack(options).directions;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        current = { dx, dy };
        const horizontal = directions.includes("left") || directions.includes("right");
        const vertical = directions.includes("up") || directions.includes("down");

        if (!moved) {
          if (Math.hypot(dx, dy) < 1) return;
          moved = true;
          setSwiping(true);
          if (horizontal && vertical) lock = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
        }
        event.preventDefault();

        if (intended === undefined) {
          let candidate: SwipeDirection;
          if (lock === "vertical" || (lock === undefined && Math.abs(dy) > Math.abs(dx))) {
            candidate = dy > 0 ? "down" : "up";
          } else candidate = dx > 0 ? "right" : "left";
          if (directions.includes(candidate)) {
            intended = candidate;
            maxDisplacement = displacement(candidate, dx, dy);
            setDirection(candidate);
          }
        } else {
          const now = displacement(intended, dx, dy);
          maxDisplacement = Math.max(maxDisplacement, now);
          const twoWay =
            (directions.includes("left") && directions.includes("right")) ||
            (directions.includes("up") && directions.includes("down"));
          // Coming back towards the start calls the swipe off; going on past the threshold again restores it.
          if (now > threshold(intended)) cancelled = false;
          else if (!twoWay && maxDisplacement - now >= REVERSE_CANCEL) {
            cancelled = true;
          }
        }

        const dampX = (dx > 0 && !directions.includes("right")) || (dx < 0 && !directions.includes("left"));
        const dampY = (dy > 0 && !directions.includes("down")) || (dy < 0 && !directions.includes("up"));
        const x = lock === "vertical" || !horizontal ? 0 : dampX ? damp(dx) : dx;
        const y = lock === "horizontal" || !vertical ? 0 : dampY ? damp(dy) : dy;
        const along = intended ?? directions[0];
        const size = along ? sizeAlong(el, along) : 0;
        const progress = along && size > 0 ? Math.min(Math.max(displacement(along, x, y) / size, 0), 1) : 0;
        setOffset({ x, y, progress });
      };

      const stopListening = () => {
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
        document.removeEventListener("pointercancel", onPointerUp);
      };

      const onPointerUp = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) return;
        pointerId = undefined;
        stopListening();
        if (!moved) return;
        if (event.type === "pointercancel" || cancelled) {
          reset();
          return;
        }
        const { directions, velocity } = untrack(options);
        const elapsed = Math.max(Date.now() - start.time, MIN_VELOCITY_MS);
        const dismissed = directions.find((dir) => {
          const distance = displacement(dir, current.dx, current.dy);
          if (distance <= 0) return false;
          return distance > threshold(dir) || (velocity > 0 && distance / elapsed >= velocity);
        });
        if (dismissed) {
          setSwiping(false);
          setDirection(dismissed);
          onDismiss(dismissed);
        } else reset();
      };

      // Parts ship no `touch-action`, so a touch drag would otherwise scroll the page and cancel the pointer.
      const onTouchMove = (event: TouchEvent) => {
        if (pointerId !== undefined && event.cancelable) event.preventDefault();
      };

      el.addEventListener("pointerdown", onPointerDown);
      el.addEventListener("touchmove", onTouchMove, { passive: false });
      return () => {
        el.removeEventListener("pointerdown", onPointerDown);
        el.removeEventListener("touchmove", onTouchMove);
        stopListening();
        pointerId = undefined;
      };
    },
  );

  return {
    get swiping() {
      return swiping();
    },
    get direction() {
      return direction();
    },
    get x() {
      return offset().x;
    },
    get y() {
      return offset().y;
    },
    get progress() {
      return offset().progress;
    },
  };
}
