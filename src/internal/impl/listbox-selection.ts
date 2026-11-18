// Selection in an always-visible listbox (src/listbox): which values lie between two items, every value that can
// be selected, and the value of the focused item. Stateless queries over the DOM: the selection and its anchor stay
// in the family's .rx, and focus movement is ./roving.ts's.
//
// The DOM is the registry, as for every list here: an option carries `data-bisque-item`, its value as `data-value`,
// and `data-disabled` while it can't be chosen. Options of a list nested inside the listbox aren't its own.
import { createEffect, type Accessor } from "solid-js";
import { listItems } from "./roving.ts";

type MaybeElement = HTMLElement | undefined;

function valueOf(item: HTMLElement): string | undefined {
  return item.getAttribute("data-value") ?? undefined;
}

/** The listbox's enabled options, in document order (a disabled option is skipped, as the arrow keys skip it). */
function enabled(list: HTMLElement): HTMLElement[] {
  return listItems(list).filter((item) => !item.hasAttribute("data-disabled"));
}

/**
 * A listbox's value as a list: `value` is a string (single selection), a list (multiple), or null or undefined for
 * none. Always a new array, so a source seeded from it never aliases the consumer's.
 */
export function selectionValues(value: string | string[] | null | undefined): string[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? [...value] : [value];
}

/** The values of the enabled options, in document order: what Ctrl+A selects. */
export function enabledValues(list: MaybeElement): string[] {
  if (!list) return [];
  return enabled(list).flatMap((item) => valueOf(item) ?? []);
}

/**
 * The values of the enabled options from the one holding `from` to the one holding `to`, both included, in document
 * order whichever comes first: a range from the anchor. When `from` names no enabled option (it was removed or
 * disabled), the range is `to` alone.
 */
export function valuesBetween(list: MaybeElement, from: string, to: string): string[] {
  if (!list) return [];
  const values = enabledValues(list);
  const end = values.indexOf(to);
  if (end === -1) return [];
  const start = values.indexOf(from);
  if (start === -1) return [to];
  return values.slice(Math.min(start, end), Math.max(start, end) + 1);
}

/** The value of the enabled option of `list` that has focus, or undefined when focus is elsewhere. */
export function focusedValue(list: MaybeElement): string | undefined {
  if (!list) return undefined;
  const focused = list.ownerDocument.activeElement;
  const item = enabled(list).find((candidate) => candidate === focused);
  return item ? valueOf(item) : undefined;
}

/**
 * Puts a listbox's Tab stop back on its first selected option each time focus leaves the list, as the APG listbox
 * asks ("focus is set on the selected option"). `createRovingFocus` (`tabStop: true`) makes the option last focused
 * the Tab stop, which is right while focus is inside; this runs only once it has left, and only when an enabled
 * option is selected (`data-bisque-current`), so a list with nothing selected keeps the option last focused.
 */
export function createSelectedTabStop(container: Accessor<MaybeElement>): void {
  createEffect(
    () => container(),
    (el) => {
      if (!el) return;
      const onFocusOut = (event: FocusEvent) => {
        if (el.contains(event.relatedTarget as Node | null)) return;
        const items = enabled(el);
        const stop = items.find((item) => item.hasAttribute("data-bisque-current"));
        if (!stop) return;
        for (const item of listItems(el)) item.setAttribute("tabindex", item === stop ? "0" : "-1");
      };
      el.addEventListener("focusout", onFocusOut);
      return () => el.removeEventListener("focusout", onFocusOut);
    },
  );
}
