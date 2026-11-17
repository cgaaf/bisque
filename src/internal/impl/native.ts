// Thin drivers for the browser's own widgets. The browser does the work (top layer, focus, Escape, placement);
// these only keep a native element in step with a component's `open` state and report what the user did to it.
import { createEffect, createSignal, untrack, type Accessor } from "solid-js";

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

/** What a native close by `button` gives the dialog's `returnValue`: its `value` attribute, when it has one. */
function valueOf(button: Element | null | undefined): string | undefined {
  if (!(button instanceof HTMLButtonElement || button instanceof HTMLInputElement)) return undefined;
  return button.hasAttribute("value") ? button.value : undefined;
}

/** A `submit` that would close `dialog`: its form (or the submitter's `formmethod`) is `dialog`, and the dialog is
 * the form's nearest. */
function closesDialog(event: SubmitEvent, dialog: HTMLDialogElement): boolean {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.closest("dialog") !== dialog) return false;
  const submitter = event.submitter;
  const method =
    submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement
      ? submitter.hasAttribute("formmethod")
        ? submitter.formMethod
        : form.method
      : form.method;
  return method === "dialog";
}

/**
 * Keeps a `<dialog>` in step with `open`: `showModal()` (or `show()` when not `modal`) to open, and `close()`
 * after its exit animation.
 *
 * Every way the browser closes it by itself is stopped before it happens and reported through `onRequestClose`
 * instead, so a controlled dialog stays open until its owner agrees, and a close that goes ahead runs the exit
 * animation: Escape (the `cancel` event, also fired by `command="request-close"`), a press on the backdrop, the
 * submit of a `<form method="dialog">` (or a `formmethod="dialog"` button), and a `command="close"` button (the
 * `command` event). The submit and `command` events can be cancelled in all three engines; `beforetoggle` can't be
 * when a dialog closes, in any of them. The button's value still becomes the dialog's `returnValue` when it
 * closes. Only a script calling `close()` itself can't be stopped: that is reported after the fact, and the
 * element is opened again if the owner keeps `open` true.
 */
export function createNativeDialog(
  element: Accessor<HTMLDialogElement | undefined>,
  open: Accessor<boolean>,
  modal: Accessor<boolean>,
  onRequestClose: (reason: DialogCloseReason) => void,
): void {
  // The return value of a native close that was asked for, given to `close()` if the owner agrees. Kept until the
  // request has been answered: past this task, a later close is not that one.
  let result: string | undefined;
  const requestClose = (value: string | undefined) => {
    result = value;
    setTimeout(() => {
      result = undefined;
    }, 0);
    onRequestClose("close");
  };
  const onCancel = (event: Event) => {
    event.preventDefault();
    onRequestClose("escape-key");
  };
  const show = (el: HTMLDialogElement) => {
    if (untrack(modal)) el.showModal();
    else el.show();
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
      // A consumer's handler that cancelled the submit (its own validation) keeps it from closing anyway.
      const onSubmit = (event: SubmitEvent) => {
        if (event.defaultPrevented || !el.open || !closesDialog(event, el)) return;
        event.preventDefault();
        requestClose(valueOf(event.submitter));
      };
      const onCommand = (event: Event & { command?: string; source?: Element | null }) => {
        if (event.target !== el || event.defaultPrevented || event.command !== "close" || !el.open) return;
        event.preventDefault();
        requestClose(valueOf(event.source));
      };
      const onClose = () => {
        // The event comes a task after `close()`. If the dialog has been opened again since (a guessed close
        // reverted), it is stale: reporting it would ask the owner to close a dialog it has just reopened.
        if (el.open) return;
        if (!untrack(open)) return;
        onRequestClose("close");
        // The owner's answer has landed by the next microtask: if it kept the dialog open, open the element again.
        queueMicrotask(() => {
          if (el.isConnected && !el.open && untrack(open)) show(el);
        });
      };
      el.addEventListener("cancel", onCancel);
      el.addEventListener("close", onClose);
      el.addEventListener("pointerdown", onPointerDown);
      el.addEventListener("click", onClick);
      el.addEventListener("keydown", onKeyDown);
      el.addEventListener("submit", onSubmit);
      el.addEventListener("command", onCommand);
      return () => {
        el.removeEventListener("cancel", onCancel);
        el.removeEventListener("close", onClose);
        el.removeEventListener("pointerdown", onPointerDown);
        el.removeEventListener("click", onClick);
        el.removeEventListener("keydown", onKeyDown);
        el.removeEventListener("submit", onSubmit);
        el.removeEventListener("command", onCommand);
        if (el.open) el.close();
      };
    },
  );

  createEffect(
    () => [element(), open()] as const,
    ([el, isOpen]) => {
      if (!el) return;
      if (isOpen) {
        result = undefined;
        if (!el.open) show(el);
        return;
      }
      if (!el.open) return;
      const value = result;
      result = undefined;
      return animateOut(el, () => el.close(value));
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

export type Placement = {
  side: Side;
  /** The point of the popup's edge nearest the anchor's centre, in pixels from the popup's padding box. */
  x: number;
  y: number;
};

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);

type Box = { left: number; top: number; right: number; bottom: number };

/** A computed `translate` component in pixels; a percentage is of the element's own size. */
const length = (value: string | undefined, size: number) =>
  value === undefined ? 0 : value.endsWith("%") ? (parseFloat(value) / 100) * size : parseFloat(value) || 0;

/**
 * The element's border box where layout put it, without its transform, in viewport coordinates.
 *
 * `getBoundingClientRect` includes the transform, and a popup that animates in (`@starting-style { scale: 0.95 }`)
 * is measured while it is still scaled: a point read from that box is off by the scale's pull towards the
 * `transform-origin`, and it stays off, since nothing re-measures when the animation ends. So the transform is
 * composed from the computed `translate`, `scale` and `transform` and `transform-origin`, and taken back out. A
 * rotation, skew, flip or zero scale has no box to take it out to: the transformed box is used as it is.
 *
 * The computed style is not always the value being drawn: in Firefox, a popup that anchor positioning has flipped
 * reported its `@starting-style` scale (and `none` for a translate) all through the transition. The popup is
 * measured again when its own transitions and animations end, which corrects that.
 */
function layoutBox(element: HTMLElement): Box {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  if (style.transform === "none" && style.translate === "none" && style.scale === "none") return rect;
  if (style.rotate !== "none" && parseFloat(style.rotate.split(" ").pop()!) !== 0) return rect;
  const [ox = 0, oy = 0] = style.transformOrigin.split(" ").map(parseFloat);
  let matrix = new DOMMatrix().translate(ox, oy);
  if (style.translate !== "none") {
    const [tx, ty] = style.translate.split(" ");
    matrix = matrix.translate(length(tx, element.offsetWidth), length(ty, element.offsetHeight));
  }
  if (style.scale !== "none") {
    const [sx = 1, sy = sx] = style.scale.split(" ").map(parseFloat);
    matrix = matrix.scale(sx, sy);
  }
  if (style.transform !== "none") matrix = matrix.multiply(new DOMMatrix(style.transform));
  matrix = matrix.translate(-ox, -oy);
  // A point of the border box at (x, y) is drawn at (left + a·x + e, top + d·y + f).
  if (!matrix.is2D || matrix.b !== 0 || matrix.c !== 0 || !(matrix.a > 0) || !(matrix.d > 0)) return rect;
  const left = rect.left - matrix.e;
  const top = rect.top - matrix.f;
  return { left, top, right: left + rect.width / matrix.a, bottom: top + rect.height / matrix.d };
}

/**
 * Where the browser placed the popup against its anchor: undefined until it first opens, or while it overlaps the
 * anchor. A close keeps the last measurement. A closed popup can still be on screen while it animates out
 * (`display` and `overlay` transitions with `allow-discrete`), and dropping the placement there put an arrow in
 * the popup's corner, unrotated, for the length of the exit. A popup that reopens also starts from where it was.
 * It is not cleared once the exit ends: that write would rebuild every part's props for nothing, since the popup
 * isn't rendered by then.
 *
 * CSS anchor positioning flips a popup that doesn't fit (`position-try-fallbacks`) without telling anyone, so the
 * side is read back from the layout: the popup is on the side whose anchor edge it lies wholly beyond. The same
 * two boxes give the arrow its place; `anchor()` can't, because no engine resolves it correctly for an element
 * inside a popover. It is measured when the popup opens, when its own transitions and animations end, and after a
 * scroll, a window resize, or a size change of either element. A layout shift that moves the anchor some other way is not seen until one of those
 * happens.
 */
export function createPlacement(
  element: Accessor<HTMLElement | undefined>,
  anchor: Accessor<HTMLElement | undefined>,
  open: Accessor<boolean>,
): Accessor<Placement | undefined> {
  const [placement, setPlacement] = createSignal<Placement | undefined>(undefined, {
    // Within a twentieth of a pixel is the same place: taking a transform back out leaves rounding noise, and a
    // write for that would rebuild every part's props for nothing.
    equals: (a, b) =>
      a === b ||
      (!!a && !!b && a.side === b.side && Math.abs(a.x - b.x) < 0.05 && Math.abs(a.y - b.y) < 0.05),
  });

  const measure = (popup: HTMLElement, against: HTMLElement) => {
    if (!popup.isConnected || !shown(popup)) return;
    // The popup's box as laid out, not as drawn mid-animation, so the first measurement is already the final one.
    const p = layoutBox(popup);
    const a = against.getBoundingClientRect();
    // Half a pixel of slack: engines round the two boxes independently.
    const side: Side | undefined =
      p.top >= a.bottom - 0.5
        ? "bottom"
        : p.bottom <= a.top + 0.5
          ? "top"
          : p.left >= a.right - 0.5
            ? "right"
            : p.right <= a.left + 0.5
              ? "left"
              : undefined;
    if (!side) return setPlacement(undefined);
    // An absolutely positioned child is placed from the padding box. Clamping each axis to that box puts the
    // point on the edge that faces the anchor.
    setPlacement({
      side,
      x: clamp(a.left + a.width / 2 - p.left - popup.clientLeft, popup.clientWidth),
      y: clamp(a.top + a.height / 2 - p.top - popup.clientTop, popup.clientHeight),
    });
  };

  createEffect(
    () => [element(), anchor(), open()] as const,
    ([popup, against, isOpen]) => {
      if (!popup || !against || !isOpen) return;
      let cancel: (() => void) | undefined;
      const schedule = () => {
        cancel ??= nextFrame(() => {
          cancel = undefined;
          measure(popup, against);
        });
      };
      // Measured after this flush, not in it: a write here would make every reader of `open` run twice. It is
      // still before the first paint. The popup may not be shown yet (the effect that shows it can run after
      // this one): the frame and `toggle` cover that.
      let live = true;
      queueMicrotask(() => {
        if (live) measure(popup, against);
      });
      schedule();
      const sizes = new ResizeObserver(schedule);
      sizes.observe(popup);
      sizes.observe(against);
      popup.addEventListener("toggle", schedule);
      // Once the popup has settled. Only its own: one inside it (a spinner) says nothing about its box.
      const settled = (event: Event) => {
        if (event.target === popup) schedule();
      };
      popup.addEventListener("transitionend", settled);
      popup.addEventListener("animationend", settled);
      document.addEventListener("scroll", schedule, { capture: true, passive: true });
      window.addEventListener("resize", schedule);
      return () => {
        cancel?.();
        sizes.disconnect();
        popup.removeEventListener("toggle", schedule);
        popup.removeEventListener("transitionend", settled);
        popup.removeEventListener("animationend", settled);
        document.removeEventListener("scroll", schedule, { capture: true });
        window.removeEventListener("resize", schedule);
        live = false;
      };
    },
  );

  return placement;
}

/**
 * The inline style of an arrow inside an anchored popup: its centre on the popup's edge that faces the anchor,
 * level with the anchor's centre. A stylesheet rotates or offsets it from there (`[data-side]`).
 */
export function arrowStyle(placement: Placement | undefined): Record<string, string> {
  return {
    position: "absolute",
    left: `${placement?.x ?? 0}px`,
    top: `${placement?.y ?? 0}px`,
    translate: "-50% -50%",
  };
}
