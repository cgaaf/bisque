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

type Phase = { kind: "shown" | "hidden" | "starting" | "ending" };

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
  // Where the element is in its life: shown, hidden, or in the first frame after it appears ("starting") or in its
  // exit animation ("ending"). It is derived from `present` and the last transition that finished (`done`, written
  // only from a frame or an animation's end), never written in the flush where `present` changes: a status written
  // by an effect there would make every reader of `present` run twice, the first time with the old status
  // (`EFFECT_RELAY_TEAR`). A phase is left only when the transition it started has finished, so an element that
  // goes away during its starting frame still animates out.
  const [done, setDone] = createSignal<Phase | undefined>(undefined);
  const phase = createMemo<Phase>((prev?: Phase) => {
    const now = present();
    const finished = done();
    if (!prev) return { kind: now ? "shown" : "hidden" };
    if (now) {
      if (prev.kind === "shown") return prev;
      if (prev.kind === "starting") return finished === prev ? { kind: "shown" } : prev;
      return { kind: "starting" };
    }
    if (prev.kind === "hidden") return prev;
    if (prev.kind === "ending") return finished === prev ? { kind: "hidden" } : prev;
    return { kind: "ending" };
  });
  const mounted = createMemo(() => phase().kind !== "hidden");
  const status = createMemo<TransitionStatus>(() => {
    const kind = phase().kind;
    return kind === "starting" || kind === "ending" ? kind : undefined;
  });

  createEffect(
    () => phase(),
    (current) => {
      if (current.kind === "starting") return nextFrame(() => setDone(current));
      if (current.kind !== "ending") return;
      const el = untrack(element);
      let cancelled = false;
      const finish = () => {
        if (!cancelled) setDone(current);
      };
      // The ending attribute has to reach the DOM before the animations it starts can be found.
      const cancelFrame = nextFrame(() => {
        const running = el?.getAnimations?.({ subtree: true }) ?? [];
        if (running.length === 0) finish();
        else void Promise.allSettled(running.map((animation) => animation.finished)).then(finish);
      });
      return () => {
        cancelled = true;
        cancelFrame();
      };
    },
  );

  return [mounted, status];
}

/**
 * While `active`, keeps focus inside `container` when the element that had it is removed.
 *
 * Content inside an open popup or panel can be replaced while the user is in it: a `loading` region shows its
 * fallback, an `errored` region swaps the content for the error (or the error for the content, after a retry), a
 * menu's items arrive. The browser then drops focus to the `<body>`, which takes a keyboard user out of the popup
 * (and out of a modal dialog's focus containment). This moves it to the container's first tabbable element, or to
 * the container itself when that is focusable. It acts only when focus has actually been lost: a removal that
 * leaves focus somewhere else is left alone. And when the container has focus itself only because it had nothing
 * focusable (a modal `<dialog>` opened while its content was loading), focus moves to the content when it arrives.
 */
export function createKeptFocus(container: Accessor<MaybeElement>, active: Accessor<boolean>): void {
  createEffect(
    () => [container(), active()] as const,
    ([el, isActive]) => {
      if (!el || !isActive) return;
      let had: Element | null = el.contains(document.activeElement) ? document.activeElement : null;
      const onFocusIn = (event: FocusEvent) => {
        had = event.target as Element;
      };
      const onFocusOut = (event: FocusEvent) => {
        const next = event.relatedTarget as Node | null;
        // Focus that moves out on purpose (Tab, a click elsewhere) is no longer ours to keep. A removal gives no
        // relatedTarget, and Chromium fires no focusout at all for it.
        if (next && !el.contains(next)) had = null;
      };
      const observer = new MutationObserver(() => {
        // Focus left on the container itself because nothing in it could take it (a <dialog> opened while its
        // content loads gets focus itself) moves to the content once something focusable arrives. A container made
        // focusable on purpose (`tabindex`, a tab panel) keeps it.
        if (document.activeElement === el && !el.hasAttribute("tabindex")) {
          tabbables(el)[0]?.focus();
          return;
        }
        if (!had || had.isConnected) return;
        had = null;
        const focused = document.activeElement;
        if (focused && focused !== document.body && focused.isConnected) return;
        const target = tabbables(el)[0] ?? (el.tabIndex >= 0 || el.hasAttribute("tabindex") ? el : undefined);
        target?.focus();
      });
      observer.observe(el, { childList: true, subtree: true });
      el.addEventListener("focusin", onFocusIn);
      el.addEventListener("focusout", onFocusOut);
      return () => {
        observer.disconnect();
        el.removeEventListener("focusin", onFocusIn);
        el.removeEventListener("focusout", onFocusOut);
      };
    },
  );
}

let scrollLocks = 0;
// The root's inline styles before the first lock, put back when the last one goes.
let restoreLock: (() => void) | undefined;

/** Locks the page's scroll without letting it widen where the scrollbar was; returns how to undo it. */
function lockRoot(): () => void {
  const root = document.documentElement;
  const { overflow, scrollbarGutter, paddingLeft, paddingRight } = root.style;
  const restore = () => {
    Object.assign(root.style, { overflow, scrollbarGutter, paddingLeft, paddingRight });
  };
  const computed = getComputedStyle(root);
  const width = root.clientWidth;
  const scrollbar = window.innerWidth - width;
  // A scrollbar on the left (right-to-left pages, in some engines) shows in the root's clientLeft.
  const onLeft = root.clientLeft > parseFloat(computed.borderLeftWidth);
  const gutter = scrollbar > 0 && computed.scrollbarGutter === "auto";
  if (gutter) root.style.scrollbarGutter = "stable";
  root.style.overflow = "hidden";
  if (!gutter) return restore;
  // WebKit drops the gutter of a root whose overflow is hidden (seen with styled scrollbars). Then pad the
  // root by what it widened instead, on the scrollbar's side.
  if (root.clientWidth === width) return restore;
  root.style.scrollbarGutter = scrollbarGutter;
  const grown = root.clientWidth - width;
  if (grown > 0) {
    const side = onLeft ? "paddingLeft" : "paddingRight";
    root.style[side] = `${parseFloat(computed[side]) + grown}px`;
  }
  return restore;
}

/**
 * While `active`, stops the page behind a modal from scrolling. Several locks may be held at once.
 *
 * `overflow: hidden` on the root takes its scrollbar away, and where scrollbars take space (Windows, Linux, macOS
 * with "always show scrollbars") the page would widen by that much and its content shift sideways. While locked
 * the root keeps that space with `scrollbar-gutter: stable`, or padding where the engine drops the gutter. Only
 * when it had a scrollbar taking space: a gutter on a page without one would shift it the other way. A gutter the
 * app set itself is left alone.
 */
export function createScrollLock(active: Accessor<boolean>): void {
  createEffect(
    () => active(),
    (isActive) => {
      if (!isActive) return;
      if (scrollLocks === 0) restoreLock = lockRoot();
      scrollLocks += 1;
      return () => {
        scrollLocks -= 1;
        if (scrollLocks === 0) {
          restoreLock?.();
          restoreLock = undefined;
        }
      };
    },
  );
}
