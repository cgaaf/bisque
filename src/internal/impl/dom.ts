// DOM behaviour the parts share: everything that needs `document`, focus or layout, which `.rx` can't reach.
// Each `create*` is a Solid primitive: called once by a component, it owns its effects and cleans them up with
// the component. `../dom.d.rx` declares how `.rx` may call them, through the `../dom.js` facade.
import { createEffect, createMemo, createSignal, untrack, type Accessor } from "solid-js";

type MaybeElement = HTMLElement | undefined;

const TABBABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

export function tabbables(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (el) => !el.hasAttribute("inert") && el.closest("[inert]") === null && !el.hidden,
  );
}

export function focusElement(element: MaybeElement): void {
  element?.focus();
}

/** Activates an element as a click would: for Enter and Space on an item that is not a native button. */
export function clickElement(element: MaybeElement): void {
  element?.click();
}

/** After the browser has applied this frame's attributes: when a transition's start state must paint first. */
function nextFrame(callback: () => void): () => void {
  if (typeof requestAnimationFrame === "function") {
    const id = requestAnimationFrame(callback);
    return () => cancelAnimationFrame(id);
  }
  const id = setTimeout(callback, 0);
  return () => clearTimeout(id);
}

export type TransitionStatus = "starting" | "ending" | undefined;

/**
 * Keeps an element mounted while it animates out.
 *
 * `mounted` is true while `present` is, and stays true after `present` turns false until the element's CSS
 * transitions and animations have finished. `status` is `"starting"` for the first frame after it appears and
 * `"ending"` while it leaves: parts put them on the element as `data-starting-style` and `data-ending-style`, the
 * hooks a stylesheet animates from and to.
 */
export function createPresence(
  present: Accessor<boolean>,
  element: Accessor<MaybeElement>,
): [Accessor<boolean>, Accessor<TransitionStatus>] {
  const [left, setLeft] = createSignal(!untrack(present));
  const [status, setStatus] = createSignal<TransitionStatus>(undefined);
  const mounted = createMemo(() => present() || !left());

  createEffect(
    () => present(),
    (now, before) => {
      if (now) {
        setLeft(false);
        if (before === undefined) return;
        setStatus("starting");
        return nextFrame(() => setStatus(undefined));
      }
      if (before !== true) return;
      const el = untrack(element);
      setStatus("ending");
      let cancelled = false;
      const finish = () => {
        if (cancelled) return;
        setStatus(undefined);
        setLeft(true);
      };
      // The ending attribute has to reach the DOM before the animations it starts can be found.
      const cancelFrame = nextFrame(() => {
        const running = el?.getAnimations?.({ subtree: true }) ?? [];
        if (running.length === 0) finish();
        else Promise.allSettled(running.map((animation) => animation.finished)).then(finish);
      });
      return () => {
        cancelled = true;
        cancelFrame();
      };
    },
  );

  return [mounted, status];
}

let scrollLocks = 0;
let overflowBeforeLock = "";

/** While `active`, stops the page behind a modal from scrolling. Several locks may be held at once. */
export function createScrollLock(active: Accessor<boolean>): void {
  createEffect(
    () => active(),
    (isActive) => {
      if (!isActive) return;
      if (scrollLocks === 0) {
        overflowBeforeLock = document.documentElement.style.overflow;
        document.documentElement.style.overflow = "hidden";
      }
      scrollLocks += 1;
      return () => {
        scrollLocks -= 1;
        if (scrollLocks === 0) document.documentElement.style.overflow = overflowBeforeLock;
      };
    },
  );
}
