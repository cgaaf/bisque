// Lists of options (select, combobox, autocomplete): finding items by value, typeahead that matches an item's
// label, and the active-descendant navigation of a list whose focus stays in an input.
//
// The DOM is the registry, as in ./roving.ts: an option carries `data-rs-ui-item`, its value as `data-value`,
// `data-label` when its label differs from its text, and `data-disabled` while it can't be chosen.

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
    const repeated = [...typed].every((character) => character === typed[0]);
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
