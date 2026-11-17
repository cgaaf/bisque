// Keyboard navigation for a toolbar or toggle group: one Tab stop, arrow keys between items.
//
// It differs from `createRovingFocus` (./roving.ts) in what it skips and what it leaves alone:
// - An item with `data-disabled` stays in the arrow order when it also carries `data-focusable`. A toolbar
//   button is disabled but focusable by default (Base UI's `focusableWhenDisabled`), so it can still be reached
//   and announced; `listItems` in ./roving.ts drops every `data-disabled` item.
// - In a text input the arrow keys move the caret until it reaches the edge, and Home and End always stay with
//   the input. The input's own handler can't stop this listener: Solid delegates `onKeyDown` to the document,
//   which runs after a listener on the container.
// - No typeahead: an item's text is not a name to type in a toolbar.
//
// It shares the DOM registry of ./roving.ts: items carry `data-rs-ui-item`, the container `data-rs-ui-list`.
import { createEffect, untrack, type Accessor } from "solid-js";

type MaybeElement = HTMLElement | undefined;

const LIST = "data-rs-ui-list";
const ITEM = "[data-rs-ui-item]";

export type CompositeOptions = {
  orientation: "horizontal" | "vertical";
  /** Whether the arrow keys wrap around at the ends. */
  loop: boolean;
  /** Whether Home and End move to the first and last item. */
  homeEnd: boolean;
};

function belongsTo(item: HTMLElement, container: HTMLElement): boolean {
  const list = item.closest<HTMLElement>(`[${LIST}]`);
  return list === null || list === container || !container.contains(list);
}

function ownItems(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(ITEM)].filter((item) => belongsTo(item, container));
}

function focusable(item: HTMLElement): boolean {
  if ((item as HTMLButtonElement).disabled) return false;
  return !item.hasAttribute("data-disabled") || item.hasAttribute("data-focusable");
}

function isTextInput(element: Element): element is HTMLInputElement | HTMLTextAreaElement {
  if (element instanceof HTMLTextAreaElement) return true;
  if (!(element instanceof HTMLInputElement)) return false;
  return element.selectionStart !== null;
}

/** Whether a key pressed in a text field belongs to the field (moves its caret) rather than to the list. */
function keyStaysInField(
  field: HTMLInputElement | HTMLTextAreaElement,
  event: KeyboardEvent,
  forward: string,
  backward: string,
): boolean {
  if (event.key === "Home" || event.key === "End") return true;
  if (event.key !== forward && event.key !== backward) return false;
  const start = field.selectionStart;
  const end = field.selectionEnd;
  if (start === null || event.shiftKey || start !== end) return true;
  if (event.key === forward && start < field.value.length) return true;
  if (event.key === backward && start > 0) return true;
  return false;
}

export function createCompositeFocus(
  container: Accessor<MaybeElement>,
  options: Accessor<CompositeOptions>,
): void {
  // Options are read when used, never tracked: changing one must not tear the listeners down.
  const current = () => untrack(options);
  createEffect(
    () => container(),
    (el) => {
      if (!el) return;
      el.setAttribute(LIST, "");

      const syncTabStop = (focused?: HTMLElement) => {
        const all = ownItems(el);
        const enabled = all.filter(focusable);
        const stop =
          focused ??
          enabled.find((item) => item.hasAttribute("data-rs-ui-current")) ??
          enabled.find((item) => item.getAttribute("tabindex") === "0") ??
          enabled[0];
        for (const item of all) {
          const value = item === stop ? "0" : "-1";
          if (item.getAttribute("tabindex") !== value) item.setAttribute("tabindex", value);
        }
      };

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
        const target = event.target as HTMLElement;
        if (target !== el && !belongsTo(target, el)) return;
        const { orientation, loop, homeEnd } = current();
        const forward = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
        const backward = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
        if (isTextInput(target) && keyStaysInField(target, event, forward, backward)) return;
        const items = ownItems(el).filter(focusable);
        if (items.length === 0) return;
        const index = items.indexOf(document.activeElement as HTMLElement);
        let next: number | undefined;
        if (event.key === forward) {
          next = index + 1 < items.length ? index + 1 : loop ? 0 : index;
        } else if (event.key === backward) {
          next = index === -1 ? items.length - 1 : index > 0 ? index - 1 : loop ? items.length - 1 : index;
        } else if (homeEnd && event.key === "Home") next = 0;
        else if (homeEnd && event.key === "End") next = items.length - 1;
        if (next === undefined) return;
        event.preventDefault();
        items[next]?.focus();
      };

      const onFocusIn = (event: FocusEvent) => {
        const target = event.target as HTMLElement;
        if (target.matches(ITEM) && belongsTo(target, el)) syncTabStop(target);
      };

      el.addEventListener("keydown", onKeyDown);
      el.addEventListener("focusin", onFocusIn);
      syncTabStop();
      const observer =
        typeof MutationObserver === "function"
          ? new MutationObserver(() => {
              // Keep the item that has focus as the stop; otherwise re-pick (the stop may have been disabled).
              const active = document.activeElement as HTMLElement | null;
              syncTabStop(active && el.contains(active) && active.matches(ITEM) ? active : undefined);
            })
          : undefined;
      observer?.observe(el, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["data-disabled", "data-focusable", "disabled", "data-rs-ui-current"],
      });
      return () => {
        el.removeEventListener("keydown", onKeyDown);
        el.removeEventListener("focusin", onFocusIn);
        observer?.disconnect();
      };
    },
  );
}
