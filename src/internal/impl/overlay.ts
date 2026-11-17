// Behaviour the platform doesn't provide for popups that open on hover (tooltip, preview card, popover with
// `openOnHover`, menu, navigation menu): hover intent with delays and a safe area, a delay group for tooltips, and
// Escape / outside press for a `popover="manual"` popup. `createArrow` and `createPopupFocus` remain only for the
// families not yet moved to `popover` and CSS anchor positioning (navigation menu); delete them with the last.
// `../overlay.d.rx` declares how `.rx` may call these, through the `../overlay.js` facade.
import { createEffect, onCleanup, untrack, type Accessor } from "solid-js";

type MaybeElement = HTMLElement | undefined;
type Side = "top" | "bottom" | "left" | "right";

export type HoverReason = "hover" | "focus" | "press" | "group";

/** A tooltip (or any hover popup) taking part in a delay group. */
type GroupMember = { close: () => void };

/**
 * Tooltips under one provider: while one is open, or for `timeout` ms after it closed, the next opens without
 * waiting, and opening one closes the other at once.
 */
export type HoverGroup = {
  enter: (member: GroupMember) => void;
  leave: (member: GroupMember) => void;
  isInstant: () => boolean;
};

export function createHoverGroup(timeout: Accessor<number>): HoverGroup {
  let active: GroupMember | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  onCleanup(clear);
  return {
    enter(member) {
      clear();
      const previous = active;
      active = member;
      if (previous && previous !== member) previous.close();
    },
    leave(member) {
      if (active !== member) return;
      active = undefined;
      clear();
      timer = setTimeout(() => {
        timer = undefined;
      }, untrack(timeout));
    },
    isInstant: () => active !== undefined || timer !== undefined,
  };
}

export type HoverOptions = {
  /** Wait before opening when the pointer enters the trigger, in ms. */
  openDelay: number;
  /** Wait before closing when the pointer leaves, in ms. */
  closeDelay: number;
  /** Whether the pointer may move onto the popup (through the safe area) without closing it. */
  hoverablePopup: boolean;
  /** Whether keyboard focus on the trigger opens it, and blur closes it. */
  focus: boolean;
  /** Wait before opening on focus, in ms. */
  focusDelay: number;
  /** Whether pressing the trigger closes the popup. */
  closeOnPress: boolean;
  group: HoverGroup | undefined;
  /**
   * For a trigger that also opens the popup on a press (a `popovertarget` button). The pointer leaving closes only
   * a popup that hover opened, and pressing the trigger while hover has it open keeps it open (the press's own
   * toggle is cancelled) instead of closing it. `closeOnPress` is ignored.
   */
  stickOnPress?: boolean;
};

type Point = [number, number];

// oxlint-disable-next-line typescript/no-explicit-any
type Handlers = Record<string, (event: any) => void>;

/** Adds each handler as a listener of its event; returns what removes them. */
function listen(element: HTMLElement, handlers: Handlers): () => void {
  for (const [type, handler] of Object.entries(handlers)) element.addEventListener(type, handler);
  return () => {
    for (const [type, handler] of Object.entries(handlers)) element.removeEventListener(type, handler);
  };
}

function isMouseLike(event: PointerEvent): boolean {
  return event.pointerType !== "touch";
}

/** Whether focus on `target` is keyboard-style focus. Where `:focus-visible` isn't supported, assume it is. */
function matchesFocusVisible(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  try {
    return target.matches(":focus-visible");
  } catch {
    return true;
  }
}

function within(element: MaybeElement, target: EventTarget | null): boolean {
  return !!element && target instanceof Node && element.contains(target);
}

function inPolygon([x, y]: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inRect([x, y]: Point, left: number, top: number, right: number, bottom: number): boolean {
  return x > left && x < right && y > top && y < bottom;
}

/**
 * Whether `point` is on the way from the trigger to the popup: in the triangle from where the pointer left the
 * trigger to the popup's near edge, or in the gap between the two. With no layout (every rect empty) nothing is.
 */
export function inSafeArea(point: Point, exit: Point, trigger: DOMRect, popup: DOMRect): boolean {
  if (popup.width === 0 || popup.height === 0) return false;
  let side: Side;
  if (popup.top >= trigger.bottom) side = "bottom";
  else if (popup.bottom <= trigger.top) side = "top";
  else if (popup.left >= trigger.right) side = "right";
  else if (popup.right <= trigger.left) side = "left";
  // Overlapping: the popup touches the trigger, so there is no gap to cross.
  else return false;
  const overlapLeft = Math.max(trigger.left, popup.left);
  const overlapRight = Math.min(trigger.right, popup.right);
  const overlapTop = Math.max(trigger.top, popup.top);
  const overlapBottom = Math.min(trigger.bottom, popup.bottom);
  const [crossLeft, crossRight] =
    overlapRight > overlapLeft ? [overlapLeft, overlapRight] : [trigger.left, trigger.right];
  const [crossTop, crossBottom] =
    overlapBottom > overlapTop ? [overlapTop, overlapBottom] : [trigger.top, trigger.bottom];
  // A pixel of slack on the trigger side, so leaving exactly at its edge still counts as in the gap.
  const gap =
    side === "bottom"
      ? inRect(point, crossLeft, trigger.bottom - 1, crossRight, popup.top + 1)
      : side === "top"
        ? inRect(point, crossLeft, popup.bottom - 1, crossRight, trigger.top + 1)
        : side === "right"
          ? inRect(point, trigger.right - 1, crossTop, popup.left + 1, crossBottom)
          : inRect(point, popup.right - 1, crossTop, trigger.left + 1, crossBottom);
  if (gap) return true;
  const edge: [Point, Point] =
    side === "bottom"
      ? [
          [popup.left, popup.top],
          [popup.right, popup.top],
        ]
      : side === "top"
        ? [
            [popup.left, popup.bottom],
            [popup.right, popup.bottom],
          ]
        : side === "right"
          ? [
              [popup.left, popup.top],
              [popup.left, popup.bottom],
            ]
          : [
              [popup.right, popup.top],
              [popup.right, popup.bottom],
            ];
  return inPolygon(point, [exit, ...edge]);
}

/**
 * Opens and closes a popup from the pointer and, optionally, keyboard focus on its trigger.
 *
 * While `enabled`: the pointer entering the trigger opens it after `openDelay` (at once in an instant group
 * phase); leaving closes it after `closeDelay`, unless the pointer goes onto the popup, directly or through the
 * safe area, when `hoverablePopup` is set. Touch pointers are ignored. A press on the trigger cancels a pending
 * open, and with `closeOnPress` closes it; only the pointer entering again reopens it.
 * With `focus`, keyboard focus on the trigger opens it after `focusDelay` and focus leaving both trigger and
 * popup closes it. Focus that follows a pointer press, or that doesn't match `:focus-visible`, doesn't open it.
 */
export function createHoverIntent(
  enabled: Accessor<boolean>,
  open: Accessor<boolean>,
  trigger: Accessor<MaybeElement>,
  popup: Accessor<MaybeElement>,
  options: Accessor<HoverOptions>,
  onOpenChange: (open: boolean, reason: HoverReason) => void,
): void {
  // Options are read when used, never tracked: changing a delay must not tear the listeners down.
  const current = () => untrack(options);
  const isOpen = () => untrack(open);
  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  let stopTracking: (() => void) | undefined;
  // Set by a pointer press: the focus that follows it is not keyboard focus.
  let pointerFocus = false;
  // Whether this opened the popup (rather than a press, the consumer, or the popup starting open).
  let openedHere = false;
  // With `stickOnPress`, the pointer leaving closes the popup only if hover opened it.
  const closesOnLeave = () => !current().stickOnPress || openedHere;

  const member: GroupMember = { close: () => change(false, "group") };

  function clearOpen() {
    if (openTimer !== undefined) clearTimeout(openTimer);
    openTimer = undefined;
  }
  function clearClose() {
    if (closeTimer !== undefined) clearTimeout(closeTimer);
    closeTimer = undefined;
  }
  function untrackPointer() {
    stopTracking?.();
    stopTracking = undefined;
  }
  function reset() {
    clearOpen();
    clearClose();
    untrackPointer();
  }

  function change(next: boolean, reason: HoverReason) {
    reset();
    if (next === isOpen()) return;
    if (next) current().group?.enter(member);
    openedHere = next;
    onOpenChange(next, reason);
  }

  function scheduleOpen(delay: number, reason: HoverReason) {
    clearOpen();
    if (delay <= 0) change(true, reason);
    else openTimer = setTimeout(() => change(true, reason), delay);
  }

  function scheduleClose() {
    clearOpen();
    untrackPointer();
    const delay = current().closeDelay;
    if (delay <= 0) change(false, "hover");
    else if (closeTimer === undefined) closeTimer = setTimeout(() => change(false, "hover"), delay);
  }

  // After the pointer left the trigger for somewhere that isn't the popup: keep the popup open while the pointer
  // travels through the safe area towards it, close once it strays.
  function trackToPopup(exit: Point) {
    untrackPointer();
    const onMove = (event: PointerEvent) => {
      const triggerEl = untrack(trigger);
      const popupEl = untrack(popup);
      if (within(popupEl, event.target) || within(triggerEl, event.target)) {
        untrackPointer();
        return;
      }
      if (!triggerEl || !popupEl) return scheduleClose();
      const point: Point = [event.clientX, event.clientY];
      if (inSafeArea(point, exit, triggerEl.getBoundingClientRect(), popupEl.getBoundingClientRect())) return;
      scheduleClose();
    };
    document.addEventListener("pointermove", onMove);
    stopTracking = () => document.removeEventListener("pointermove", onMove);
  }

  const triggerHandlers = {
    pointerenter(event: PointerEvent) {
      if (!isMouseLike(event)) return;
      clearClose();
      untrackPointer();
      if (isOpen()) return;
      const { openDelay, group } = current();
      scheduleOpen(group?.isInstant() ? 0 : openDelay, "hover");
    },
    pointerleave(event: PointerEvent) {
      if (!isMouseLike(event)) return;
      pointerFocus = false;
      clearOpen();
      if (!isOpen() || !closesOnLeave()) return;
      const popupEl = untrack(popup);
      if (current().hoverablePopup && popupEl) {
        if (within(popupEl, event.relatedTarget)) return;
        trackToPopup([event.clientX, event.clientY]);
        return;
      }
      scheduleClose();
    },
    pointerdown() {
      clearOpen();
      pointerFocus = true;
    },
    click(event: MouseEvent) {
      clearOpen();
      if (current().stickOnPress) {
        // Hover opened it: the press keeps it open, and from now on only a press or dismissal closes it.
        if (isOpen() && openedHere) {
          event.preventDefault();
          openedHere = false;
          clearClose();
          untrackPointer();
        }
        return;
      }
      if (current().closeOnPress && isOpen()) change(false, "press");
    },
    focus(event: FocusEvent) {
      if (!current().focus) return;
      if (pointerFocus) {
        pointerFocus = false;
        return;
      }
      // Programmatic focus after a pointer interaction (focus returned when a menu closes) isn't focus-visible.
      if (isOpen() || !matchesFocusVisible(event.target)) return;
      scheduleOpen(current().focusDelay, "focus");
    },
    blur(event: FocusEvent) {
      pointerFocus = false;
      if (!current().focus) return;
      clearOpen();
      if (within(untrack(popup), event.relatedTarget)) return;
      if (isOpen()) change(false, "focus");
    },
  };

  const popupHandlers = {
    pointerenter(event: PointerEvent) {
      if (!isMouseLike(event) || !current().hoverablePopup) return;
      clearClose();
      untrackPointer();
    },
    pointerleave(event: PointerEvent) {
      if (!isMouseLike(event) || !current().hoverablePopup) return;
      if (within(untrack(trigger), event.relatedTarget)) return;
      if (isOpen() && closesOnLeave()) scheduleClose();
    },
    focusout(event: FocusEvent) {
      const next = event.relatedTarget;
      if (!current().focus || next === null) return;
      if (within(untrack(popup), next) || within(untrack(trigger), next)) return;
      if (isOpen()) change(false, "focus");
    },
  };

  createEffect(
    () => (enabled() ? trigger() : undefined),
    (el) => {
      if (!el) return;
      const detach = listen(el, triggerHandlers);
      return () => {
        detach();
        reset();
        pointerFocus = false;
      };
    },
  );

  createEffect(
    () => (enabled() ? popup() : undefined),
    (el) => (el ? listen(el, popupHandlers) : undefined),
  );

  // However it closed (Escape, outside press, the consumer), nothing pending may reopen or re-close it.
  createEffect(
    () => open(),
    (isNowOpen) => {
      if (isNowOpen) return;
      reset();
      openedHere = false;
      untrack(options).group?.leave(member);
    },
  );
  onCleanup(() => {
    reset();
    untrack(options).group?.leave(member);
  });
}

export type DismissReason = "escape-key" | "outside-press";

/**
 * Escape and a press outside, for a `popover="manual"` popup (tooltip, preview card): the browser closes only an
 * `auto` popover itself, and hover popups can't be `auto` or `hint` yet. While `active`, Escape anywhere and a
 * pointer press outside both `trigger` and `popup` call `onDismiss`. Escape is consumed (`preventDefault`), so a
 * popover or dialog the popup sits in stays open; an Escape something else already consumed is left alone.
 */
export function createManualDismiss(
  active: Accessor<boolean>,
  trigger: Accessor<MaybeElement>,
  popup: Accessor<MaybeElement>,
  onDismiss: (reason: DismissReason) => void,
): void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    onDismiss("escape-key");
  };
  const onPointerDown = (event: PointerEvent) => {
    if (within(untrack(trigger), event.target) || within(untrack(popup), event.target)) return;
    onDismiss("outside-press");
  };
  createEffect(
    () => active(),
    (isActive) => {
      if (!isActive) return;
      document.addEventListener("keydown", onKeyDown);
      document.addEventListener("pointerdown", onPointerDown, true);
      return () => {
        document.removeEventListener("keydown", onKeyDown);
        document.removeEventListener("pointerdown", onPointerDown, true);
      };
    },
  );
}
