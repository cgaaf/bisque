// Lists of options (select, combobox, autocomplete): finding items by value, typeahead that matches an item's
// label, and the active-descendant navigation of a list whose focus stays in an input.
//
// The DOM is the registry, as in ./roving.ts: an option carries `data-rs-ui-item`, its value as `data-value`,
// `data-label` when its label differs from its text, and `data-disabled` while it can't be chosen.

import { createEffect, createSignal, untrack, type Accessor } from "solid-js";

type MaybeElement = HTMLElement | undefined;

const ITEM = "[data-rs-ui-item]";

function enabledItems(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(ITEM)].filter(
    (item) => !item.hasAttribute("data-disabled"),
  );
}

/** An item's label: its `data-label`, else its text. */
function labelOf(item: HTMLElement): string {
  return item.getAttribute("data-label")?.trim() ?? elementText(item);
}

/**
 * The text an element shows, trimmed, leaving out what is hidden from assistive technology (an indicator): the
 * label of an item that wasn't given one.
 */
export function elementText(element: MaybeElement): string {
  if (!element) return "";
  const copy = element.cloneNode(true) as HTMLElement;
  for (const hidden of copy.querySelectorAll("[aria-hidden='true']")) hidden.remove();
  return (copy.textContent ?? "").trim();
}

/** The value an item carries (`data-value`), or undefined for anything else. */
export function itemValue(element: EventTarget | null | undefined): string | undefined {
  if (!(element instanceof HTMLElement) || !element.matches(ITEM)) return undefined;
  return element.getAttribute("data-value") ?? undefined;
}

/**
 * Typeahead over a list's items, per list. Returns `match`, which takes a printable key and gives the next
 * enabled item whose label starts with what was typed, and `reset`, which starts a new search.
 *
 * Typing within 500 ms of the last key extends the search; the same letter again cycles through the items that
 * start with it. The search starts after `current` (a value), else after the focused item of `container`.
 */
export function createTypeahead(): [
  (container: MaybeElement, key: string, current: string | undefined) => HTMLElement | undefined,
  () => void,
] {
  let typed = "";
  let typedAt = 0;
  const match = (container: MaybeElement, key: string, current: string | undefined) => {
    if (!container || key.length !== 1 || key === " ") return undefined;
    const now = Date.now();
    typed = now - typedAt > 500 ? key : typed + key;
    typedAt = now;
    const items = enabledItems(container);
    const focused = container.ownerDocument.activeElement;
    const index =
      current !== undefined
        ? items.findIndex((item) => item.getAttribute("data-value") === current)
        : items.findIndex((item) => item === focused);
    const repeated = Array.from(typed).every((character) => character === typed[0]);
    const query = (repeated ? typed[0] : typed).toLowerCase();
    const from = repeated ? index + 1 : Math.max(index, 0);
    const ordered = [...items.slice(from), ...items.slice(0, from)];
    return ordered.find((item) => labelOf(item).toLowerCase().startsWith(query));
  };
  const reset = () => {
    typed = "";
    typedAt = 0;
  };
  return [match, reset];
}

export type Direction = "next" | "previous" | "first" | "last";

/**
 * The id of the item to highlight after `currentId` in a list navigated with `aria-activedescendant`, skipping
 * disabled items. With `loop`, moving past either end gives `undefined` (the input itself, nothing highlighted)
 * and the next move enters at the other end; without it the highlight stays on the end item.
 */
export function adjacentItemId(
  list: MaybeElement,
  currentId: string | undefined,
  direction: Direction,
  loop: boolean,
): string | undefined {
  if (!list) return undefined;
  const items = enabledItems(list);
  if (items.length === 0) return undefined;
  const index = currentId === undefined ? -1 : items.findIndex((item) => item.id === currentId);
  const last = items.length - 1;
  let next: number | undefined;
  if (direction === "first") next = 0;
  else if (direction === "last") next = last;
  else if (direction === "next") {
    next = index === -1 ? 0 : index < last ? index + 1 : loop ? undefined : last;
  } else {
    next = index === -1 ? last : index > 0 ? index - 1 : loop ? undefined : 0;
  }
  return next === undefined ? undefined : items[next]?.id || undefined;
}

/** Scrolls the item with `id` into view inside its list, as far as needed. */
export function scrollItemIntoView(list: MaybeElement, id: string | undefined): void {
  if (!list || id === undefined) return;
  const item = enabledItems(list).find((candidate) => candidate.id === id);
  item?.scrollIntoView?.({ block: "nearest" });
}

/** The label of the item with `id` in `list`, for an input that shows the highlighted option (inline mode). */
export function itemLabel(list: MaybeElement, id: string | undefined): string | undefined {
  if (!list || id === undefined) return undefined;
  const item = enabledItems(list).find((candidate) => candidate.id === id);
  return item ? labelOf(item) : undefined;
}

/** Clicks the item with `id`: Enter in an input chooses the highlighted option. */
export function clickItem(list: MaybeElement, id: string | undefined): void {
  if (!list || id === undefined) return;
  enabledItems(list)
    .find((candidate) => candidate.id === id)
    ?.click();
}

/** The value of the item with `id` in `list`, or undefined when there is no such item (it was removed). */
export function itemValueById(list: MaybeElement, id: string | undefined): string | undefined {
  if (!list || id === undefined) return undefined;
  const item = [...list.querySelectorAll<HTMLElement>(ITEM)].find((candidate) => candidate.id === id);
  return item?.getAttribute("data-value") ?? undefined;
}

/** The id of the enabled item of `list` whose value is `value`: where the highlight starts on opening. */
export function itemIdByValue(list: MaybeElement, value: string | undefined): string | undefined {
  if (!list || value === undefined) return undefined;
  return enabledItems(list).find((item) => item.getAttribute("data-value") === value)?.id || undefined;
}

function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();
}

/**
 * Whether an item labelled `label` passes the filter for `query`: `filter` when given, else a case- and
 * accent-insensitive "contains". An empty query matches everything.
 */
export function matchesFilter(
  filter: ((label: string, query: string) => boolean) | undefined,
  label: string,
  query: string,
): boolean {
  const trimmed = query.trim();
  if (trimmed === "") return true;
  if (filter) return filter(label, trimmed);
  return fold(label).includes(fold(trimmed));
}

/**
 * Calls `onShown` each time the popover `popup` has been shown: an item can't take focus, nor an option be scrolled
 * into view, while the popup is hidden. Listens to the `toggle` event itself, once per element: a `toggle` handler
 * passed as an element prop is re-attached whenever the part's props recompute, and the state write the native
 * popover driver makes on that same event recomputes them, so such a handler misses the event.
 */
export function createOnShow(popup: Accessor<MaybeElement>, onShown: () => void): void {
  const onToggle = (event: Event) => {
    if ((event as ToggleEvent).newState === "open") onShown();
  };
  createEffect(
    () => popup(),
    (el) => {
      if (!el) return;
      el.addEventListener("toggle", onToggle);
      return () => el.removeEventListener("toggle", onToggle);
    },
  );
}

/**
 * While `active`, calls `onOutside` when a press starts outside every element of `inside`. For a
 * `popover="manual"` list whose anchor is an input (combobox, autocomplete): the browser's light dismiss treats a
 * press on that input as a press outside (the `source` of `showPopover()` isn't exempt), so the list can't be
 * `popover="auto"` and closes itself on a press outside instead.
 */
export function createOutsidePress(
  active: Accessor<boolean>,
  inside: Accessor<MaybeElement[]>,
  onOutside: () => void,
): void {
  const onPointerDown = (event: PointerEvent) => {
    const path = event.composedPath();
    if (untrack(inside).some((el) => el !== undefined && path.includes(el))) return;
    onOutside();
  };
  createEffect(
    () => active(),
    (on) => {
      if (!on) return;
      document.addEventListener("pointerdown", onPointerDown, true);
      return () => document.removeEventListener("pointerdown", onPointerDown, true);
    },
  );
}

export type ItemLabel = { value: string; label: string };

/**
 * The label each value's item last showed, kept after the item is gone: a selected value goes on being named by its
 * label when a filter or a new answer from a server removes its item. Returns the labels and `register`, which an
 * item calls when it renders or its label changes. Nothing is unregistered, because nothing needs to be: a label
 * only names a value.
 *
 * Plain signals rather than a list source in .rx: an item registers from an effect, and a list source's store
 * proxies, written from there, are read untracked by Solid's dev tooling (`STRICT_READ_UNTRACKED`); and an item
 * removed with its `for` row can't call an action from its cleanup (`ACTION_CALLED_IN_OWNED_SCOPE`).
 */
export function createLabels(): [Accessor<ItemLabel[]>, (value: string, label: string) => void] {
  const [labels, setLabels] = createSignal<ItemLabel[]>([]);
  // The updater form: items register in one flush, and a read of `labels` there gives the value from before it.
  const register = (value: string, label: string) =>
    setLabels((current) =>
      current.some((entry) => entry.value === value && entry.label === label)
        ? current
        : [...current.filter((entry) => entry.value !== value), { value, label }],
    );
  return [labels, register];
}

/**
 * The label each value's item last showed in `container`, read from the items themselves (`data-value`, and
 * `data-label` else the text), and kept after the item is gone, as `createLabels` keeps them. Returns the labels and
 * `register`, for an item a consumer renders some other way.
 *
 * The items aren't asked to register: an item whose label is its text measures it after it renders, and an effect
 * that passed it on to a registry would make everything that reads both the item and the labels run twice for one
 * change, the first time with the old labels (`EFFECT_RELAY_TEAR`). The labels are read when the items change,
 * from a MutationObserver, and first in a microtask: outside the flush, so readers see each change once.
 */
export function createItemLabels(
  container: Accessor<MaybeElement>,
): [Accessor<ItemLabel[]>, (value: string, label: string) => void] {
  const [labels, setLabels] = createSignal<ItemLabel[]>([]);
  const register = (value: string, label: string) =>
    setLabels((current) =>
      current.some((entry) => entry.value === value && entry.label === label)
        ? current
        : [...current.filter((entry) => entry.value !== value), { value, label }],
    );
  createEffect(
    () => container(),
    (el) => {
      if (!el) return;
      const read = () => {
        const found: ItemLabel[] = [];
        for (const item of el.querySelectorAll<HTMLElement>(ITEM)) {
          const value = item.getAttribute("data-value");
          if (value !== null) found.push({ value, label: labelOf(item) });
        }
        if (found.length === 0) return;
        setLabels((current) => {
          const changed = found.filter(
            (entry) => !current.some((known) => known.value === entry.value && known.label === entry.label),
          );
          if (changed.length === 0) return current;
          const values = new Set(changed.map((entry) => entry.value));
          return [...current.filter((entry) => !values.has(entry.value)), ...changed];
        });
      };
      let live = true;
      queueMicrotask(() => {
        if (live) read();
      });
      const observer = new MutationObserver(read);
      observer.observe(el, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["data-value", "data-label"],
      });
      return () => {
        live = false;
        observer.disconnect();
      };
    },
  );
  return [labels, register];
}

/**
 * Calls `onChange` with the number of items (`data-rs-ui-item`) inside `container`, once it is set and after every
 * change to them: how a list knows it is empty, and that its items were replaced or changed value (a filter, a new
 * answer from a server), without its items registering themselves. An item that isn't rendered isn't counted. An
 * item whose element is kept with another `data-value` counts as a change too. (ReactiveScript's `for` keeps a
 * row's element only for an equal row, so this is a guard, not a case seen in the fixtures.)
 */
export function createItemObserver(
  container: Accessor<MaybeElement>,
  onChange: (count: number) => void,
): void {
  createEffect(
    () => container(),
    (el) => {
      if (!el) return;
      let last: [Element, string | null][] = [];
      const report = () => {
        const items = [...el.querySelectorAll(ITEM)].map(
          (item) => [item, item.getAttribute("data-value")] as [Element, string | null],
        );
        // A change elsewhere in the container (a status message) isn't a change of items.
        const same =
          items.length === last.length &&
          items.every(([item, value], index) => item === last[index][0] && value === last[index][1]);
        if (same) return;
        last = items;
        onChange(items.length);
      };
      report();
      const observer = new MutationObserver(report);
      observer.observe(el, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-value"],
      });
      return () => observer.disconnect();
    },
  );
}

/**
 * Keeps the text of `input` (a combobox's) equal to `value`, writing it only when `value` changes and differs from
 * what the input shows. A `value` prop in the input's props would be written again whenever those props recompute,
 * with whatever `value` is at that moment: a change that lands while the app's answer is still loading (the list,
 * `loading`) recomputes them before the typed text has landed, and the user's keystroke is written over.
 */
export function createInputValue(input: Accessor<MaybeElement>, value: Accessor<string>): void {
  createEffect(
    () => [input(), value()] as const,
    ([el, text]) => {
      if (el instanceof HTMLInputElement && el.value !== text) el.value = text;
    },
  );
}

/** Whether `element` itself has focus (not something inside it). */
export function hasFocus(element: MaybeElement): boolean {
  return element !== undefined && element.ownerDocument.activeElement === element;
}
