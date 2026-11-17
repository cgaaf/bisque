// Behaviour of the menu family (menu, submenus, context menu, menubar) that needs the DOM: focus that moves into a
// menu and comes back only when it should, a touch long press, and finding a neighbouring menubar trigger.
// `../menu.d.rx` declares how `.rx` may call these, through the `../menu.js` facade.
import { createEffect, onCleanup, untrack, type Accessor } from "solid-js";
import { focusListItem, listItems } from "./roving.ts";

type MaybeElement = HTMLElement | undefined;

/** Every popup of one menu tree (a menu and its submenus) carries this attribute, valued with the tree's id. */
const TREE = "data-rs-ui-menu-tree";

export type MenuInitialFocus = "none" | "container" | "first-item" | "last-item";

/**
 * Focus for a menu popup. While `active`: focus moves into `popup` (`initialFocus`; `"none"` leaves it where it is,
 * for a submenu opened by hover). When it deactivates, focus goes to `returnTo` (else to what had focus before),
 * but only if `restore` is true and focus is still in this menu tree (or nowhere): a menu that closes because a
 * neighbouring menubar menu opened, or a submenu closing with the rest of its tree, leaves focus alone.
 */
export function createMenuFocus(
  active: Accessor<boolean>,
  popup: Accessor<MaybeElement>,
  initialFocus: Accessor<MenuInitialFocus>,
  returnTo: Accessor<MaybeElement>,
  restore: Accessor<boolean>,
  tree: string,
): void {
  createEffect(
    () => (active() ? popup() : undefined),
    (el) => {
      if (!el) return;
      const previous = document.activeElement as HTMLElement | null;
      const initial = untrack(initialFocus);
      if (initial !== "none" && !el.contains(document.activeElement)) {
        if (initial === "container") el.focus();
        else focusListItem(el, initial === "last-item" ? "last" : "first");
      }
      return () => {
        if (!untrack(restore)) return;
        const focused = document.activeElement as HTMLElement | null;
        const inTree =
          focused === null ||
          focused === document.body ||
          !focused.isConnected ||
          el.contains(focused) ||
          focused.closest(`[${TREE}="${tree}"]`) !== null;
        if (!inTree) return;
        const target = untrack(returnTo) ?? previous;
        if (target?.isConnected) target.focus();
      };
    },
  );
}

/**
 * Calls `onLongPress` with the touch point when one finger rests on `element` for `delay` ms without moving more
 * than 10px. A second finger, a move or the finger lifting cancels it.
 */
export function createLongPress(
  enabled: Accessor<boolean>,
  element: Accessor<MaybeElement>,
  delay: number,
  onLongPress: (x: number, y: number) => void,
): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let start: [number, number] | undefined;
  const cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    start = undefined;
  };
  createEffect(
    () => (enabled() ? element() : undefined),
    (el) => {
      if (!el) return;
      const onStart = (event: TouchEvent) => {
        cancel();
        if (event.touches.length !== 1) return;
        const touch = event.touches[0];
        const point: [number, number] = [touch.clientX, touch.clientY];
        start = point;
        timer = setTimeout(() => {
          timer = undefined;
          start = undefined;
          onLongPress(point[0], point[1]);
        }, delay);
      };
      const onMove = (event: TouchEvent) => {
        if (!start) return;
        const touch = event.touches[0];
        if (
          event.touches.length !== 1 ||
          Math.abs(touch.clientX - start[0]) > 10 ||
          Math.abs(touch.clientY - start[1]) > 10
        )
          cancel();
      };
      el.addEventListener("touchstart", onStart, { passive: true });
      el.addEventListener("touchmove", onMove, { passive: true });
      el.addEventListener("touchend", cancel);
      el.addEventListener("touchcancel", cancel);
      return () => {
        cancel();
        el.removeEventListener("touchstart", onStart);
        el.removeEventListener("touchmove", onMove);
        el.removeEventListener("touchend", cancel);
        el.removeEventListener("touchcancel", cancel);
      };
    },
  );
  onCleanup(cancel);
}

/**
 * The item of `bar` (a menubar) `direction` steps from `from`, skipping disabled ones; with `loop`, wrapping at the
 * ends. Undefined when there is no other item.
 */
export function adjacentItem(
  bar: MaybeElement,
  from: MaybeElement,
  direction: number,
  loop: boolean,
): HTMLElement | undefined {
  if (!bar || !from) return undefined;
  const items = listItems(bar);
  const index = items.indexOf(from);
  if (index === -1 || items.length < 2) return undefined;
  let next = index + direction;
  if (next < 0 || next >= items.length) {
    if (!loop) return undefined;
    next = (next + items.length) % items.length;
  }
  return items[next];
}

/** The point a context menu opened from the keyboard appears at: the bottom-left corner of `element`. */
export function elementCorner(element: MaybeElement): { x: number; y: number } {
  if (!element) return { x: 0, y: 0 };
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.bottom };
}

/** Whether keyboard focus is in `element`. */
export function containsFocus(element: MaybeElement): boolean {
  return !!element && element.contains(document.activeElement);
}
