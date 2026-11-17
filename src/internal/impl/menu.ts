// Behaviour of the menu family (menu, submenus, context menu, menubar) that needs the DOM: focus that moves into a
// menu and comes back only when it should, a touch long press, opening only once the pointer is released, and
// finding a neighbouring menubar trigger.
// `../menu.d.rx` declares how `.rx` may call these, through the `../menu.js` facade.
import { createEffect, onCleanup, untrack, type Accessor } from "solid-js";
import { focusListItem, listItems } from "./roving.ts";

type MaybeElement = HTMLElement | undefined;

export type MenuInitialFocus = "none" | "container" | "first-item" | "last-item";

/**
 * Runs `callback` once `popup` is shown (`:popover-open`): at once if it is, else on its next `toggle` to open.
 * Focus can't move into a popover the browser hasn't shown yet, and the effect that shows it may run after the
 * one that wants to focus it. Returns what cancels the wait.
 */
export function whenShown(popup: HTMLElement, callback: () => void): () => void {
  if (!popup.hasAttribute("popover") || popup.matches(":popover-open")) {
    callback();
    return () => {};
  }
  const onToggle = (event: Event) => {
    if ((event as ToggleEvent).newState !== "open") return;
    popup.removeEventListener("toggle", onToggle);
    callback();
  };
  popup.addEventListener("toggle", onToggle);
  return () => popup.removeEventListener("toggle", onToggle);
}

/**
 * Focus for a menu popup. While `active`: focus moves into `popup` once the browser has shown it (`initialFocus`;
 * `"none"` leaves it where it is, for a submenu opened by hover). When it deactivates, focus goes to `returnTo`
 * (else, or when `returnTo` can't take focus, to what had focus before), but only if `restore` is true and focus
 * is still inside `popup` (a submenu's popup is inside its parent's) or nowhere: a menu that closes because a
 * neighbouring menubar menu opened, a submenu closing because the highlight moved on in its parent, or a submenu
 * closing with the rest of its tree, leaves focus alone.
 *
 * The browser restores focus itself when a popover closes, but not consistently: in no engine does closing a
 * nested popover with Escape return focus to the item that opened it.
 */
export function createMenuFocus(
  active: Accessor<boolean>,
  popup: Accessor<MaybeElement>,
  initialFocus: Accessor<MenuInitialFocus>,
  returnTo: Accessor<MaybeElement>,
  restore: Accessor<boolean>,
): void {
  createEffect(
    () => (active() ? popup() : undefined),
    (el) => {
      if (!el) return;
      const previous = document.activeElement as HTMLElement | null;
      const initial = untrack(initialFocus);
      const which = initial === "last-item" ? "last" : "first";
      // Opened from the keyboard before its items exist (they load, or a `loading` region shows its fallback):
      // focus waits on the popup and goes to the first (or last) item once one arrives, unless the user has moved it.
      let awaitingItem = false;
      // Items replaced while the menu is open (a new answer, an error shown in their place, a retry) can take the
      // focused one with them, and the browser drops focus to the body: it goes back to the menu's first item.
      let hadFocus = false;
      const onFocusIn = () => {
        hadFocus = true;
      };
      const onFocusOut = (event: FocusEvent) => {
        const next = event.relatedTarget as Node | null;
        if (next && !el.contains(next)) hadFocus = false;
      };
      const observer = new MutationObserver(() => {
        const focused = document.activeElement;
        if (awaitingItem) {
          if (focused !== el) awaitingItem = false;
          else if (listItems(el).length > 0) {
            awaitingItem = false;
            focusListItem(el, which);
          }
          return;
        }
        // A submenu open inside this menu looks after its own items.
        if (!hadFocus || !el.matches(":popover-open") || el.querySelector("[popover]:popover-open")) return;
        if (focused !== null && focused !== document.body && focused.isConnected) return;
        focusListItem(el, "first");
        // No item to take it yet (a fallback replaced them): the first one that arrives does.
        awaitingItem = document.activeElement === el;
      });
      observer.observe(el, { childList: true, subtree: true });
      el.addEventListener("focusin", onFocusIn);
      el.addEventListener("focusout", onFocusOut);
      // After the listeners: the popup may be shown already, and the focus this moves in must be seen.
      const cancel = whenShown(el, () => {
        if (initial === "none" || el.contains(document.activeElement)) return;
        if (initial === "container") return el.focus();
        focusListItem(el, which);
        awaitingItem = document.activeElement === el;
      });
      return () => {
        cancel();
        observer.disconnect();
        el.removeEventListener("focusin", onFocusIn);
        el.removeEventListener("focusout", onFocusOut);
        if (!untrack(restore)) return;
        const focused = document.activeElement as HTMLElement | null;
        const inside =
          focused === null || focused === document.body || !focused.isConnected || el.contains(focused);
        if (!inside) return;
        const target = untrack(returnTo);
        if (target?.isConnected) target.focus();
        if ((!target || document.activeElement !== target) && previous?.isConnected) previous.focus();
      };
    },
  );
}

/**
 * Runs `open` in a later task, once the pointer that is down (a finger resting for a long press, a button held
 * for a `contextmenu`) has been released or cancelled.
 *
 * In every engine, the release of a press that began outside an open `popover="auto"` closes it, even one shown
 * while the press was held (Chromium leaves the right button out of this; Firefox and Safari don't). So a popup
 * opened on the press itself would be closed again by its own release. The later task also lets a close made in
 * the same run (the menu was already open) take effect before the reopen.
 */
export function afterRelease(open: () => void): void {
  const events = ["pointerup", "pointercancel", "touchend", "touchcancel"];
  const done = () => {
    for (const type of events) window.removeEventListener(type, done);
    setTimeout(open, 0);
  };
  for (const type of events) window.addEventListener(type, done);
}

/**
 * `afterRelease` for a `contextmenu` event: waits for the button that raised it, or only for the next task when
 * no button is down (the platform raised it on release, as Windows does).
 */
export function afterPointerRelease(event: MouseEvent, open: () => void): void {
  if (event.buttons === 0) setTimeout(open, 0);
  else afterRelease(open);
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
