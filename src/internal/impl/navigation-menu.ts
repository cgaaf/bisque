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

/** Moves focus to the first focusable element in `container`, else to the container itself. */
export function focusFirstIn(container: MaybeElement): void {
  if (!container) return;
  const first = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].find(
    (element) => element.getClientRects().length > 0,
  );
  (first ?? container).focus();
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
      el.addEventListener("focusin", onFocusIn);
      el.addEventListener("focusout", onFocusOut);
      return () => {
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
      return whenShown(el, () => {
        if (!el.contains(document.activeElement)) focusFirstIn(el);
      });
    },
  );
}
