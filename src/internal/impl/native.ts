// Thin drivers for the browser's own widgets. The browser does the work (top layer, focus, Escape, placement);
// these only keep a native element in step with a component's `open` state and report what the user did to it.
import { createEffect, untrack, type Accessor } from "solid-js";

function nextFrame(callback: () => void): () => void {
  const id = requestAnimationFrame(callback);
  return () => cancelAnimationFrame(id);
}

/**
 * Runs an element's exit animation, then calls `done`.
 *
 * No engine but Chrome can animate a top-layer element out natively yet (`overlay`, and `display` transitions in
 * Firefox), so the element is closed late instead: it gets `data-ending-style`, its transitions and animations
 * run, and only then is it closed. A stylesheet animates out from `[data-ending-style]` and in with
 * `@starting-style`. Returns a function that abandons the exit (the element was reopened).
 */
export function animateOut(element: HTMLElement, done: () => void): () => void {
  let abandoned = false;
  element.setAttribute("data-ending-style", "");
  const finish = () => {
    if (abandoned) return;
    element.removeAttribute("data-ending-style");
    done();
  };
  // The attribute has to be styled before the animations it starts can be found.
  const cancelFrame = nextFrame(() => {
    const running = element.getAnimations({ subtree: true });
    if (running.length === 0) finish();
    else void Promise.allSettled(running.map((animation) => animation.finished)).then(finish);
  });
  return () => {
    abandoned = true;
    cancelFrame();
    element.removeAttribute("data-ending-style");
  };
}

const shown = (el: HTMLElement) => el.matches(":popover-open");

export type DialogCloseReason = "escape-key" | "outside-press" | "close";

/**
 * Keeps a `<dialog>` in step with `open`: `showModal()` (or `show()` when not `modal`) to open, and `close()`
 * after its exit animation.
 *
 * The browser asks to close it in three ways, and each is reported through `onRequestClose` instead of being
 * allowed to happen, so a controlled dialog stays open until its owner agrees: Escape (the `cancel` event), a
 * press on the backdrop, and anything else that closed it (a `<form method="dialog">`, a `command` button).
 */
export function createNativeDialog(
  element: Accessor<HTMLDialogElement | undefined>,
  open: Accessor<boolean>,
  modal: Accessor<boolean>,
  onRequestClose: (reason: DialogCloseReason) => void,
): void {
  const onCancel = (event: Event) => {
    event.preventDefault();
    onRequestClose("escape-key");
  };
  const onClose = () => {
    if (untrack(open)) onRequestClose("close");
  };

  createEffect(
    () => element(),
    (el) => {
      if (!el) return;
      let pressedBackdrop = false;
      const onBackdrop = (event: MouseEvent) => {
        if (event.target !== el) return false;
        const box = el.getBoundingClientRect();
        const inside =
          event.clientX >= box.left &&
          event.clientX <= box.right &&
          event.clientY >= box.top &&
          event.clientY <= box.bottom;
        return !inside;
      };
      // A drag that starts in the dialog and ends on the backdrop (selecting text) is not a press outside.
      const onPointerDown = (event: PointerEvent) => {
        pressedBackdrop = onBackdrop(event);
      };
      const onClick = (event: MouseEvent) => {
        if (pressedBackdrop && onBackdrop(event)) onRequestClose("outside-press");
        pressedBackdrop = false;
      };
      // Only a modal dialog gets Escape from the browser.
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Escape" || event.defaultPrevented || el.matches(":modal")) return;
        event.preventDefault();
        onRequestClose("escape-key");
      };
      el.addEventListener("cancel", onCancel);
      el.addEventListener("close", onClose);
      el.addEventListener("pointerdown", onPointerDown);
      el.addEventListener("click", onClick);
      el.addEventListener("keydown", onKeyDown);
      return () => {
        el.removeEventListener("cancel", onCancel);
        el.removeEventListener("close", onClose);
        el.removeEventListener("pointerdown", onPointerDown);
        el.removeEventListener("click", onClick);
        el.removeEventListener("keydown", onKeyDown);
        if (el.open) el.close();
      };
    },
  );

  createEffect(
    () => [element(), open()] as const,
    ([el, isOpen]) => {
      if (!el) return;
      if (isOpen) {
        if (el.open) return;
        if (untrack(modal)) el.showModal();
        else el.show();
        return;
      }
      if (!el.open) return;
      return animateOut(el, () => el.close());
    },
  );
}

/**
 * Keeps a `popover` element in step with `open`, and reports when the browser opened or closed it.
 *
 * With `popover="auto"` the browser closes the popup itself on Escape and on a press outside (light dismiss),
 * and opens it from a `popovertarget` button. Those can't be vetoed, so they are reported after the fact through
 * `onOpenChange`; if the owner's state then disagrees (a controlled `open` that didn't change), the element is
 * put back to match. Opening passes `source`, which makes that element the popup's implicit CSS anchor. It does
 * not protect the source from light dismiss: only a `popovertarget` button is exempt, so a popup opened from
 * anything else (a combobox's input) that must survive a press on it uses `popover="manual"`.
 *
 * Nothing here animates the popup out: a light dismiss can't be delayed, so exit animation is left to CSS where
 * the engine supports it (`transition-behavior: allow-discrete` with `overlay`). `@starting-style` animates it
 * in everywhere.
 */
export function createNativePopover(
  element: Accessor<HTMLElement | undefined>,
  open: Accessor<boolean>,
  source: Accessor<HTMLElement | undefined>,
  onOpenChange: (open: boolean) => void,
): void {
  createEffect(
    () => element(),
    (el) => {
      if (!el) return;
      const onToggle = (event: Event) => {
        const isOpen = (event as ToggleEvent).newState === "open";
        if (isOpen !== untrack(open)) onOpenChange(isOpen);
        // The owner may have refused the change: a later frame puts the element back in step.
        queueMicrotask(() => sync(el));
      };
      el.addEventListener("toggle", onToggle);
      return () => {
        el.removeEventListener("toggle", onToggle);
        if (el.isConnected && shown(el)) el.hidePopover();
      };
    },
  );

  const sync = (el: HTMLElement) => {
    if (!el.isConnected) return;
    const wanted = untrack(open);
    if (wanted && !shown(el)) el.showPopover({ source: untrack(source) });
    else if (!wanted && shown(el)) el.hidePopover();
  };

  createEffect(
    () => [element(), open()] as const,
    ([el]) => {
      if (el) sync(el);
    },
  );
}

export type Side = "top" | "bottom" | "left" | "right";
export type Align = "start" | "center" | "end";

const BLOCK_SPAN: Record<Align, string> = { start: " span-right", center: "", end: " span-left" };
const INLINE_SPAN: Record<Align, string> = { start: " span-bottom", center: "", end: " span-top" };
const FACING: Record<Side, string> = { top: "bottom", bottom: "top", left: "right", right: "left" };

/**
 * The inline style that places a popover against its anchor (the element that opened it) with CSS anchor
 * positioning: on `side`, aligned to the anchor's `align` edge, `sideOffset` pixels away, and flipped to the
 * opposite side when it would not fit. The browser does the placement; this only writes the declarations, so a
 * stylesheet can replace any of them.
 */
export function anchoredStyle(
  side: Side,
  align: Align,
  sideOffset: number,
  alignOffset: number,
): Record<string, string> {
  const block = side === "top" || side === "bottom";
  const style: Record<string, string> = {
    // A popover is centred in the viewport by default (`inset: 0; margin: auto`).
    inset: "auto",
    margin: "0",
    "position-area": side + (block ? BLOCK_SPAN[align] : INLINE_SPAN[align]),
    "position-try-fallbacks": block
      ? "flip-block, flip-inline, flip-block flip-inline"
      : "flip-inline, flip-block, flip-inline flip-block",
  };
  // Margins flip with the fallback, so the gap stays between the popup and its anchor.
  if (sideOffset) style[`margin-${FACING[side]}`] = `${sideOffset}px`;
  if (alignOffset && align !== "center") {
    const edge = block ? (align === "start" ? "left" : "right") : align === "start" ? "top" : "bottom";
    style[`margin-${edge}`] = `${alignOffset}px`;
  }
  return style;
}
