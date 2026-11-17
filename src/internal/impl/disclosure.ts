// DOM behaviour of disclosures built on <details> (collapsible, accordion): keeping the element in step with the
// component's state, the panel's measured size, the exit animation, and arrow-key movement between accordion
// triggers. `../disclosure.d.rx` declares how `.rx` may call them.
//
// The browser does the rest: it holds the open state, toggles on a click, Enter or Space on the <summary>, hides
// the content (`::details-content`), opens a closed <details> for find-in-page, and keeps one open per `name`.
import { createEffect, untrack, type Accessor } from "solid-js";
import { animateOut } from "./native.ts";

type MaybeElement = HTMLElement | undefined;

function nextFrame(callback: () => void): () => void {
  const id = requestAnimationFrame(callback);
  return () => cancelAnimationFrame(id);
}

/**
 * Keeps a `<details>` in step with `open`, reports when the browser opened or closed it, and writes the panel's
 * measured size to `--<prefix>-height` and `--<prefix>-width` on the panel.
 *
 * - The trigger part cancels the summary's own toggle and asks the component instead, so a controlled `open`
 *   decides. What the browser does by itself (find-in-page opening it, another `<details>` of the same `name`
 *   closing it) can't be vetoed: it is reported through `onOpenChange`, and if the owner disagrees the element is
 *   put back.
 * - Opening sets `open` at once. The size variables already hold the panel's height in px (a closed panel is
 *   still laid out), so a stylesheet can transition `height` from 0 to `var(--…-height)`; once the open animation
 *   has finished they become `auto`, so the content can resize.
 * - Closing is sequenced, because a `<details>` hides its content the moment it closes. Chrome can keep it
 *   visible for a transition (`content-visibility` with `allow-discrete` on `::details-content`); Firefox can't,
 *   and in WebKit a height transition under it didn't run. The variables go back to px, the panel gets
 *   `data-ending-style`, and the element closes when the panel's animations end.
 *   A close the browser makes by itself (a sibling of the same `name` opened) happens at once.
 */
export function createDisclosure(
  element: Accessor<HTMLDetailsElement | undefined>,
  panel: Accessor<MaybeElement>,
  open: Accessor<boolean>,
  prefix: string,
  onOpenChange: (open: boolean) => void,
): void {
  const heightVar = `--${prefix}-height`;
  const widthVar = `--${prefix}-width`;
  // The state this driver last gave the element: a `toggle` that matches it is the echo of its own change.
  let pushed: boolean | undefined;
  let cancelExit: (() => void) | undefined;

  const measure = (el: HTMLElement) => {
    el.style.setProperty(heightVar, `${el.scrollHeight}px`);
    el.style.setProperty(widthVar, `${el.scrollWidth}px`);
  };
  const push = (el: HTMLDetailsElement, isOpen: boolean) => {
    pushed = isOpen;
    el.open = isOpen;
  };

  createEffect(
    () => element(),
    (el) => {
      if (!el) return;
      pushed = el.open;
      const onToggle = () => {
        const isOpen = el.open;
        if (isOpen === pushed) return;
        pushed = isOpen;
        if (!isOpen) {
          // Closed under a running exit: nothing is left to animate.
          cancelExit?.();
          cancelExit = undefined;
        }
        if (isOpen !== untrack(open)) onOpenChange(isOpen);
        // The owner may have refused the change: put the element back in step.
        queueMicrotask(() => {
          if (!el.isConnected) return;
          const wanted = untrack(open);
          if (wanted && !el.open) push(el, true);
          else if (!wanted && el.open && !cancelExit) push(el, false);
        });
      };
      el.addEventListener("toggle", onToggle);
      return () => el.removeEventListener("toggle", onToggle);
    },
  );

  createEffect(
    () => [element(), open()] as const,
    ([el, isOpen]) => {
      if (!el) return;
      const p = untrack(panel);
      if (isOpen) {
        if (!el.open) {
          // Measured before `[open]` applies, so the open transition runs to the current size.
          if (p) measure(p);
          push(el, true);
        }
        if (!p) return;
        let cancelled = false;
        let cancelFrame = nextFrame(() => {
          // By the second frame the open transition, if the stylesheet has one, is running.
          cancelFrame = nextFrame(() => {
            const settle = () => {
              if (cancelled) return;
              p.style.setProperty(heightVar, "auto");
              p.style.setProperty(widthVar, "auto");
            };
            const running = p.getAnimations({ subtree: true });
            if (running.length === 0) settle();
            else void Promise.allSettled(running.map((animation) => animation.finished)).then(settle);
          });
        });
        return () => {
          cancelled = true;
          cancelFrame();
        };
      }
      if (!el.open || !p) {
        if (p) measure(p);
        if (el.open) push(el, false);
        return;
      }
      // From `auto` (or nothing yet) the exit transition has nothing to start from: give it a length, laid out
      // now. A length means the open transition is still running, and it simply reverses.
      if (!p.style.getPropertyValue(heightVar).endsWith("px")) measure(p);
      void p.offsetHeight;
      const cancel = animateOut(p, () => {
        cancelExit = undefined;
        push(el, false);
      });
      cancelExit = cancel;
      return () => {
        if (cancelExit === cancel) cancelExit = undefined;
        cancel();
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
