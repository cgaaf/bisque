// Keyboard navigation inside a composite widget (menu, listbox, tabs, toolbar, radio group).
//
// The DOM is the registry: a part marks itself an item with `data-rs-ui-item`, and a disabled one also carries
// `data-disabled`. Nothing registers with its parent, so items can be added, removed and reordered freely.
import { createEffect, untrack, type Accessor } from "solid-js";

type MaybeElement = HTMLElement | undefined;

const LIST = "data-rs-ui-list";
const ITEM = "[data-rs-ui-item]";

export type RovingOptions = {
  orientation: "horizontal" | "vertical" | "both";
  /** Whether the arrow keys wrap around at the ends. */
  loop: boolean;
  /** Whether typing a character moves focus to the next item whose text starts with it. */
  typeahead: boolean;
  /**
   * Whether the list is one Tab stop (tabs, toolbar, radio group): one item has `tabindex="0"`, the others
   * `-1`. That item is the one marked `data-rs-ui-current`, else the last one focused, else the first.
   * In a popup (menu, listbox) this is false and the part gives every item `tabindex="-1"`.
   */
  tabStop: boolean;
};

/** Whether `item` is `container`'s own item, not one of a list nested inside it (a submenu, tabs in a panel). */
function belongsTo(item: HTMLElement, container: HTMLElement): boolean {
  // `container` may not carry the list marker yet: another part's effect can ask for its items first.
  const list = item.closest<HTMLElement>(`[${LIST}]`);
  return list === null || list === container || !container.contains(list);
}

/** A disabled item is skipped, unless it is marked `data-focusable` (a toolbar button that stays reachable). */
function isFocusable(item: HTMLElement): boolean {
  return !item.hasAttribute("data-disabled") || item.hasAttribute("data-focusable");
}

/** The focusable items of `container`, in document order, leaving out those of a list nested inside it. */
export function listItems(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(ITEM)].filter(
    (item) => isFocusable(item) && belongsTo(item, container),
  );
}

/** Moves focus to the first, last or current (`data-rs-ui-current`) item of a list. */
export function focusListItem(container: MaybeElement, which: "first" | "last" | "current"): void {
  if (!container) return;
  const items = listItems(container);
  const current = items.find((item) => item.hasAttribute("data-rs-ui-current"));
  const target =
    which === "last" ? items[items.length - 1] : which === "current" ? (current ?? items[0]) : items[0];
  (target ?? container).focus();
}

export function createRovingFocus(container: Accessor<MaybeElement>, options: Accessor<RovingOptions>): void {
  // Options are read when used, never tracked: changing one must not tear the listeners down.
  const current = () => untrack(options);
  createEffect(
    () => container(),
    (el) => {
      if (!el) return;
      el.setAttribute(LIST, "");
      let typed = "";
      let typedAt = 0;

      const syncTabStop = (focused?: HTMLElement) => {
        if (!current().tabStop) return;
        const items = listItems(el);
        const stop =
          focused ??
          items.find((item) => item.hasAttribute("data-rs-ui-current")) ??
          items.find((item) => item.getAttribute("tabindex") === "0") ??
          items[0];
        for (const item of el.querySelectorAll<HTMLElement>(ITEM)) {
          if (!belongsTo(item, el)) continue;
          const value = item === stop ? "0" : "-1";
          if (item.getAttribute("tabindex") !== value) item.setAttribute("tabindex", value);
        }
      };

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
        const target = event.target as HTMLElement;
        if (target !== el && !belongsTo(target, el)) return;
        const { orientation, loop, typeahead } = current();
        const items = listItems(el);
        if (items.length === 0) return;
        const index = items.indexOf(document.activeElement as HTMLElement);
        const vertical = orientation !== "horizontal";
        const horizontal = orientation !== "vertical";
        let next: number | undefined;
        if ((vertical && event.key === "ArrowDown") || (horizontal && event.key === "ArrowRight")) {
          next = index + 1 < items.length ? index + 1 : loop ? 0 : index;
        } else if ((vertical && event.key === "ArrowUp") || (horizontal && event.key === "ArrowLeft")) {
          next = index === -1 ? items.length - 1 : index > 0 ? index - 1 : loop ? items.length - 1 : index;
        } else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = items.length - 1;
        else if (typeahead && event.key.length === 1 && event.key !== " ") {
          const now = Date.now();
          typed = now - typedAt > 500 ? event.key : typed + event.key;
          typedAt = now;
          // The same letter again cycles through the items that start with it; other input narrows the search.
          const repeated = Array.from(typed).every((character) => character === typed[0]);
          const query = (repeated ? typed[0] : typed).toLowerCase();
          const from = repeated ? index + 1 : Math.max(index, 0);
          const ordered = [...items.slice(from), ...items.slice(0, from)];
          const match = ordered.find((item) =>
            (item.textContent ?? "").trim().toLowerCase().startsWith(query),
          );
          if (match) next = items.indexOf(match);
        }
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
        typeof MutationObserver === "function" ? new MutationObserver(() => syncTabStop()) : undefined;
      observer?.observe(el, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["data-disabled", "data-rs-ui-current"],
      });
      return () => {
        el.removeEventListener("keydown", onKeyDown);
        el.removeEventListener("focusin", onFocusIn);
        observer?.disconnect();
      };
    },
  );
}
