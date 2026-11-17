// DOM behaviour of panels that expand and collapse (collapsible, accordion): their measured size, and arrow-key
// movement between accordion triggers. `../disclosure.d.rx` declares how `.rx` may call them.
import { createEffect, type Accessor } from "solid-js";

type MaybeElement = HTMLElement | undefined;

function nextFrame(callback: () => void): () => void {
  if (typeof requestAnimationFrame === "function") {
    const id = requestAnimationFrame(callback);
    return () => cancelAnimationFrame(id);
  }
  const id = setTimeout(callback, 0);
  return () => clearTimeout(id);
}

/**
 * Writes a panel's measured size to `--<prefix>-height` and `--<prefix>-width` on the panel, so a stylesheet can
 * animate `height: var(--accordion-panel-height)` to and from 0 under `data-starting-style`/`data-ending-style`.
 *
 * - Opening: the variables are `auto` while the panel is measured, then its `scrollHeight`/`scrollWidth` in px
 *   until the open animation has finished, then `auto` again so the content can resize freely.
 * - Closing: the current size in px, written and laid out before the ending style can land, so the exit
 *   transition starts from a length rather than from `auto`.
 *
 * It writes the variables itself rather than returning them: the closing size has to reach the browser's
 * computed style before `data-ending-style` does, whichever effect runs first.
 */
export function createPanelSize(
  open: Accessor<boolean>,
  element: Accessor<MaybeElement>,
  prefix: string,
): void {
  const heightVar = `--${prefix}-height`;
  const widthVar = `--${prefix}-width`;
  const write = (el: HTMLElement, height: string, width: string) => {
    el.style.setProperty(heightVar, height);
    el.style.setProperty(widthVar, width);
  };

  createEffect(
    () => [open(), element()] as const,
    ([isOpen, el]) => {
      if (!el || !el.isConnected) return;
      if (!isOpen) {
        write(el, `${el.scrollHeight}px`, `${el.scrollWidth}px`);
        // Lay the length out now: the ending style must transition from it, not from `auto`.
        void el.offsetHeight;
        return;
      }
      // Measure from `auto`, so a length left over from the last close can't start a transition by itself.
      write(el, "auto", "auto");
      write(el, `${el.scrollHeight}px`, `${el.scrollWidth}px`);
      let cancelled = false;
      let cancelFrame = nextFrame(() => {
        // The second frame is the first one without `data-starting-style`, where the open transition exists.
        cancelFrame = nextFrame(() => {
          const settle = () => {
            if (!cancelled) write(el, "auto", "auto");
          };
          const running = el.getAnimations?.() ?? [];
          if (running.length === 0) settle();
          else Promise.allSettled(running.map((animation) => animation.finished)).then(settle);
        });
      });
      return () => {
        cancelled = true;
        cancelFrame();
      };
    },
  );
}

export type Orientation = "horizontal" | "vertical";

/**
 * Moves focus between the triggers of the accordion that owns `event.currentTarget`: the arrow keys of
 * `orientation`, Home and End. Triggers carry `data-rs-ui-accordion-trigger` (and `data-disabled` when they can't
 * take focus); the root carries `data-rs-ui-accordion`. Triggers of an accordion nested in a panel are skipped.
 * Keys pressed anywhere else (an input in a panel) are left alone, since only a trigger calls this.
 */
export function focusAdjacentTrigger(event: KeyboardEvent, orientation: Orientation, loop: boolean): void {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
  const trigger = event.currentTarget as HTMLElement | null;
  const root = trigger?.closest<HTMLElement>("[data-rs-ui-accordion]");
  if (!trigger || !root) return;
  const triggers = [...root.querySelectorAll<HTMLElement>("[data-rs-ui-accordion-trigger]")].filter(
    (item) =>
      item.closest("[data-rs-ui-accordion]") === root &&
      (item === trigger || !item.hasAttribute("data-disabled")),
  );
  const index = triggers.indexOf(trigger);
  const last = triggers.length - 1;
  const forward = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
  const backward = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
  let next: number | undefined;
  if (event.key === forward) next = index < last ? index + 1 : loop ? 0 : index;
  else if (event.key === backward) next = index > 0 ? index - 1 : loop ? last : index;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = last;
  if (next === undefined) return;
  event.preventDefault();
  triggers[next]?.focus();
}
