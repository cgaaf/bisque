// Behaviour of the navigation menu that needs the DOM: which way the active item moved, and focus moving into an
// item's content and back to its trigger. `../navigation-menu.d.rx` declares how `.rx` may call these.
import { createEffect, untrack, type Accessor } from "solid-js";
import { whenShown } from "./menu.ts";

type MaybeElement = HTMLElement | undefined;

/**
 * The direction from the item at `from` to the item at `to`, for `data-activation-direction`: by document order,
 * so "right" (or "down" when vertical) when `to` comes later. Undefined without both.
 */
export function activationDirection(
  from: MaybeElement,
  to: MaybeElement,
  orientation: "horizontal" | "vertical",
): "left" | "right" | "up" | "down" | undefined {
  if (!from || !to || from === to) return undefined;
  const later = (from.compareDocumentPosition(to) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  if (orientation === "vertical") return later ? "down" : "up";
  return later ? "right" : "left";
}

/** Whether `target` (an event's related target) is inside one of `elements`. */
export function containsTarget(elements: MaybeElement[], target: EventTarget | null): boolean {
  return target instanceof Node && elements.some((element) => element?.contains(target));
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function firstFocusable(container: HTMLElement): HTMLElement | undefined {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].find(
    (element) => element.getClientRects().length > 0,
  );
}

/** Moves focus to the first focusable element in `container`, else to the container itself. */
export function focusFirstIn(container: MaybeElement): void {
  if (!container) return;
  (firstFocusable(container) ?? container).focus();
}

/**
 * Focus for an item's content (a `popover`). While `active` and `enter`: once the browser has shown `content`,
 * focus moves to its first focusable element. When it deactivates with focus inside it (or lost because the
 * browser hid what had it), focus goes back to `trigger`; content that hovering opened and closed leaves focus
 * where it was.
 */
export function createContentFocus(
  active: Accessor<boolean>,
  enter: Accessor<boolean>,
  content: Accessor<MaybeElement>,
  trigger: Accessor<MaybeElement>,
): void {
  createEffect(
    () => (active() ? content() : undefined),
    (el) => {
      if (!el) return;
      let inside = el.contains(document.activeElement);
      const onFocusIn = () => {
        inside = true;
      };
      const onFocusOut = (event: FocusEvent) => {
        if (event.relatedTarget && !el.contains(event.relatedTarget as Node)) inside = false;
      };
      // Content replaced while it is open (links that load, an error in their place, a retry) can take the
      // focused element with it, and the browser drops focus to the body: it goes back into the content.
      const observer = new MutationObserver(() => {
        const focused = document.activeElement;
        if (!inside || (focused !== null && focused !== document.body && focused.isConnected)) return;
        focusFirstIn(el);
      });
      observer.observe(el, { childList: true, subtree: true });
      el.addEventListener("focusin", onFocusIn);
      el.addEventListener("focusout", onFocusOut);
      return () => {
        observer.disconnect();
        el.removeEventListener("focusin", onFocusIn);
        el.removeEventListener("focusout", onFocusOut);
        const focused = document.activeElement;
        const lost = focused === null || focused === document.body || el.contains(focused);
        if (inside && lost) untrack(trigger)?.focus();
      };
    },
  );

  createEffect(
    () => (active() && enter() ? content() : undefined),
    (el) => {
      if (!el) return;
      // Opened from the keyboard before its links exist (they load, or a `loading` region shows its fallback): focus
      // waits on the content and moves to the first link once one arrives, unless the user has moved it.
      let awaiting = false;
      const observer = new MutationObserver(() => {
        if (!awaiting) return;
        if (document.activeElement !== el) awaiting = false;
        else if (firstFocusable(el)) {
          awaiting = false;
          focusFirstIn(el);
        }
      });
      observer.observe(el, { childList: true, subtree: true });
      const cancel = whenShown(el, () => {
        if (el.contains(document.activeElement)) return;
        focusFirstIn(el);
        awaiting = document.activeElement === el;
      });
      return () => {
        cancel();
        observer.disconnect();
      };
    },
  );
}
