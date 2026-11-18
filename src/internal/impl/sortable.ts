// Drag and drop reordering for the Sortable family: the pointer gesture, the keyboard gesture, the geometry that
// says where a dragged item would land, edge scrolling, the announcement texts and the order maths. `.rx` has no
// layout, no `document` and no `Math`. `../sortable.d.rx` declares how `.rx` may call it.
//
// The model: nothing moves in the DOM while an item is dragged. The dragged item follows the pointer (or, from the
// keyboard, steps from slot to slot) through `x`/`y`, the items it passes get the offset that opens its gap
// (`offsets`), and the parts turn both into CSS variables. On drop the owner's order changes once, the list
// re-renders in the new order and every offset returns to zero in the same flush, so nothing jumps.
import { createEffect, createSignal, untrack, type Accessor } from "solid-js";

type MaybeElement = HTMLElement | undefined;

export type SortableReason = "pointer" | "keyboard";
/** A place in a list: the list's id (`""` for a Root outside a group) and the index in its order. */
export type SortablePosition = { list: string; index: number };
/** What the drag callbacks receive. `to` is where the item would land (on drop, where it landed). */
export type SortableDragDetails = {
  id: string;
  from: SortablePosition;
  to: SortablePosition;
  reason: SortableReason;
};
/** What the announcement texts are written from. `position` counts from 1. */
export type SortableMessageDetails = {
  id: string;
  /** The item's `aria-label`, else its text. */
  label: string;
  position: number;
  total: number;
  list: string;
  /** The list's `aria-label` (or the text of its `aria-labelledby`), else its id. */
  listLabel: string;
  /** The list is one of several in a SortableGroup, so the texts name it. */
  grouped: boolean;
};
export type SortableMessages = {
  /** Read after a handle's name: how to use it from the keyboard. */
  instructions: string;
  /** What a handle is announced as, in place of "button". */
  roleDescription: string;
  pickedUp: (details: SortableMessageDetails) => string;
  moved: (details: SortableMessageDetails) => string;
  dropped: (details: SortableMessageDetails) => string;
  cancelled: (details: SortableMessageDetails) => string;
};
export type SortableOffset = { x: number; y: number };
export type SortableDropSide = "before" | "after";

/** What the parts read while a drag is on. Every field tracks. */
export type SortableDragState = {
  /** The id of the item being dragged. */
  active: string | undefined;
  reason: SortableReason | undefined;
  /** The list it came from, and the list it would land in. */
  source: string | undefined;
  over: string | undefined;
  /** Where it would land in `over`, counted without it. */
  index: number;
  /** The dragged item's offset from where it rests, in px. */
  x: number;
  y: number;
  /** The offset of each item moved out of the way, by id. */
  offsets: Record<string, SortableOffset>;
  /** The item the dragged one would land beside, and on which side; for an indicator line. */
  target: string | undefined;
  side: SortableDropSide | undefined;
};

export type SortableOptions = { disabled: boolean; messages: SortableMessages };

const LIST = "data-bisque-sortable-list";
const ITEM = "data-bisque-sortable-item";
const HANDLE = "data-bisque-sortable-handle";
const GROUP = "data-bisque-sortable-group";
/** A mouse or pen press becomes a drag once it has moved this far, so a click stays a click. */
const ACTIVATION_DISTANCE = 4;
/** A touch on an item that has no handle becomes a drag after this long a press, so a swipe still scrolls. */
const LONG_PRESS_MS = 250;
const LONG_PRESS_TOLERANCE = 6;
/** How close to a scroll container's edge the pointer must be to scroll it, and its top speed per frame. */
const EDGE = 48;
const EDGE_SPEED = 18;
// Presses on these inside an item that is its own handle don't start a drag, so the controls in it still work.
// Text inside these isn't part of an item's name in the announcements.
const CONTROLS = 'button,input,select,textarea,[role="button"]';
const INTERACTIVE =
  'a[href],button,input,select,textarea,label,summary,[contenteditable=""],[contenteditable="true"]';

// ---------------------------------------------------------------------------------------------------------------
// The order maths, for `.rx`.

/** `order` with `id` moved to `index` (counted without it). The same array when nothing moves. */
export function moveInOrder(order: readonly string[], id: string, index: number): string[] {
  const from = order.indexOf(id);
  if (from < 0) return order.slice();
  const rest = order.filter((value) => value !== id);
  const to = Math.min(Math.max(index, 0), rest.length);
  rest.splice(to, 0, id);
  return rest;
}

/** The lists with `id` taken out of whichever holds it and put into `list` at `index` (counted without it). */
export function moveInLists(
  lists: Readonly<Record<string, readonly string[]>>,
  id: string,
  list: string,
  index: number,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, order] of Object.entries(lists)) out[key] = order.filter((value) => value !== id);
  const target = out[list] ?? [];
  target.splice(Math.min(Math.max(index, 0), target.length), 0, id);
  out[list] = target;
  return out;
}

export function sameOrder(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  if (!a || !b) return a === b;
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function sameLists(
  a: Readonly<Record<string, readonly string[]>> | undefined,
  b: Readonly<Record<string, readonly string[]>> | undefined,
): boolean {
  if (!a || !b) return a === b;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => sameOrder(a[key], b[key]));
}

/** What `cachedOrder` remembers for one list: the order it last gave. */
export type OrderCache = { last: string[] | undefined };

export function createOrderCache(): OrderCache {
  return { last: undefined };
}

/**
 * `order`, as the same array as last time while its content is the same. A drop changes the owner's value more than
 * once with equal content (the list's draft, the owner's write, the draft cleared), and in a group every list's
 * order is rebuilt each time; without this, every part reading an order would rebuild its props each time for
 * nothing. (A Solid memo with `equals` does this too, but read from `.rx` through a `ref` result it broke the docs
 * build's first render, so the cache is a plain object.)
 */
export function cachedOrder(cache: OrderCache, order: readonly string[]): string[] {
  if (cache.last && sameOrder(cache.last, order)) return cache.last;
  cache.last = [...order];
  return cache.last;
}

/** A copy of a group's value, so a source seeded from the consumer's object doesn't alias it. */
export function copyLists(
  lists: Readonly<Record<string, readonly string[]>> | undefined,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, order] of Object.entries(lists ?? {})) out[key] = [...order];
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// The texts.

const where = (d: SortableMessageDetails) =>
  `position ${d.position} of ${d.total}${d.grouped ? ` in ${d.listLabel}` : ""}`;

export const DEFAULT_MESSAGES: SortableMessages = {
  instructions:
    "Press Space or Enter to pick up. Then use the arrow keys to move, Space or Enter to drop, and Escape to cancel.",
  roleDescription: "sortable",
  pickedUp: (d) => `Picked up ${d.label}, ${where(d)}.`,
  moved: (d) => `${d.label} moved to ${where(d)}.`,
  dropped: (d) => `Dropped ${d.label} at ${where(d)}.`,
  cancelled: (d) => `Cancelled. ${d.label} is back at ${where(d)}.`,
};

/** The given texts over the English defaults. */
export function sortableMessages(messages: Partial<SortableMessages> | undefined): SortableMessages {
  return { ...DEFAULT_MESSAGES, ...messages };
}

// ---------------------------------------------------------------------------------------------------------------
// Geometry.

type Box = { left: number; top: number; width: number; height: number };
type Point = { x: number; y: number };

type ItemGeo = { id: string; element: HTMLElement; rel: Box };
type ListGeo = {
  id: string;
  element: HTMLElement;
  vertical: boolean;
  rtl: boolean;
  disabled: boolean;
  items: ItemGeo[];
  /** The list's content box, relative to the list's border box: where the first item of an empty list goes. */
  content: Box;
  scroll: Point;
  gap: number;
  label: string;
};

function boxOf(element: Element): Box {
  const r = element.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

function px(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textOf(element: Element): string {
  return (element.textContent ?? "").replaceAll(/\s+/g, " ").trim();
}

function labelOfList(element: HTMLElement): string {
  const label = element.getAttribute("aria-label");
  if (label) return label;
  const ids = element.getAttribute("aria-labelledby");
  if (ids) {
    const text = ids
      .split(/\s+/)
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)
      .map(textOf)
      .join(" ");
    if (text) return text;
  }
  return element.getAttribute(LIST) ?? "";
}

/**
 * The item's `aria-label`, else its text, leaving out its handle's (a grip glyph), its controls' ("Remove") and
 * hidden text.
 */
function labelOfItem(element: HTMLElement): string {
  const label = element.getAttribute("aria-label");
  if (label) return label;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let text = "";
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const skip = node.parentElement?.closest(`[${HANDLE}],[aria-hidden="true"],${CONTROLS}`);
    if (skip && skip !== element && element.contains(skip)) continue;
    text += ` ${node.nodeValue ?? ""}`;
  }
  return text.replaceAll(/\s+/g, " ").trim();
}

function itemsOf(list: HTMLElement): HTMLElement[] {
  return [...list.querySelectorAll<HTMLElement>(`[${ITEM}]`)].filter(
    (item) => item.closest(`[${LIST}]`) === list,
  );
}

function listsOf(container: HTMLElement): HTMLElement[] {
  if (container.hasAttribute(LIST)) return [container];
  return [...container.querySelectorAll<HTMLElement>(`[${LIST}]`)].filter(
    (list) => list.closest(`[${GROUP}]`) === container,
  );
}

function measureList(element: HTMLElement): ListGeo {
  const box = boxOf(element);
  const styles = getComputedStyle(element);
  const vertical = element.getAttribute("data-orientation") !== "horizontal";
  const rtl = styles.direction === "rtl";
  const items = itemsOf(element).map((item) => {
    const b = boxOf(item);
    return {
      id: item.getAttribute(ITEM) ?? "",
      element: item,
      rel: { left: b.left - box.left, top: b.top - box.top, width: b.width, height: b.height },
    };
  });
  const content = {
    left: px(styles.borderLeftWidth) + px(styles.paddingLeft),
    top: px(styles.borderTopWidth) + px(styles.paddingTop),
    width: element.clientWidth - px(styles.paddingLeft) - px(styles.paddingRight),
    height: element.clientHeight - px(styles.paddingTop) - px(styles.paddingBottom),
  };
  const list: ListGeo = {
    id: element.getAttribute(LIST) ?? "",
    element,
    vertical,
    rtl,
    disabled: element.hasAttribute("data-disabled"),
    items,
    content,
    scroll: { x: element.scrollLeft, y: element.scrollTop },
    gap: 0,
    label: labelOfList(element),
  };
  if (items.length >= 2) {
    list.gap = Math.max(0, start(list, items[1].rel) - end(list, items[0].rel));
  } else {
    const gap = vertical ? styles.rowGap : styles.columnGap;
    list.gap = gap === "normal" ? 0 : px(gap);
  }
  return list;
}

// Positions along a list's axis run "forward": down a vertical list, along the inline direction of a horizontal
// one (leftwards in a right-to-left one), so the maths below is written once.
function start(list: ListGeo, box: Box): number {
  if (list.vertical) return box.top;
  return list.rtl ? -(box.left + box.width) : box.left;
}
function size(list: ListGeo, box: Box): number {
  return list.vertical ? box.height : box.width;
}
function end(list: ListGeo, box: Box): number {
  return start(list, box) + size(list, box);
}
function crossStart(list: ListGeo, box: Box): number {
  return list.vertical ? box.left : box.top;
}
/** A distance forward along the list as an x/y offset. */
function along(list: ListGeo, distance: number, cross = 0): SortableOffset {
  if (list.vertical) return { x: cross, y: distance };
  return { x: list.rtl ? -distance : distance, y: cross };
}

/** Where a box measured at drag start (relative to its list) is now, after the page or the list has scrolled. */
function now(list: ListGeo, rel: Box): Box {
  const box = list.element.getBoundingClientRect();
  return {
    left: box.left + rel.left - (list.element.scrollLeft - list.scroll.x),
    top: box.top + rel.top - (list.element.scrollTop - list.scroll.y),
    width: rel.width,
    height: rel.height,
  };
}

function contains(element: HTMLElement, point: Point): boolean {
  const box = element.getBoundingClientRect();
  return point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;
}

function scrollable(element: Element, vertical: boolean): boolean {
  const overflow = getComputedStyle(element)[vertical ? "overflowY" : "overflowX"];
  const room = vertical
    ? element.scrollHeight > element.clientHeight
    : element.scrollWidth > element.clientWidth;
  return room && (overflow === "auto" || overflow === "scroll");
}

/** The element and every ancestor that scrolls along an axis, innermost first, then the document. */
function scrollers(element: HTMLElement, vertical: boolean): Element[] {
  const out: Element[] = [];
  for (let el: Element | null = element; el && el !== document.documentElement; el = el.parentElement) {
    if (el !== document.body && scrollable(el, vertical)) out.push(el);
  }
  if (document.scrollingElement) out.push(document.scrollingElement);
  return out;
}

function viewportOf(scroller: Element): { start: Point; end: Point } {
  if (scroller === document.scrollingElement) {
    return { start: { x: 0, y: 0 }, end: { x: window.innerWidth, y: window.innerHeight } };
  }
  const box = scroller.getBoundingClientRect();
  return { start: { x: box.left, y: box.top }, end: { x: box.right, y: box.bottom } };
}

function canScroll(scroller: Element, vertical: boolean, direction: number): boolean {
  if (vertical) {
    const max = scroller.scrollHeight - scroller.clientHeight;
    return direction < 0 ? scroller.scrollTop > 0 : scroller.scrollTop < max - 1;
  }
  const max = scroller.scrollWidth - scroller.clientWidth;
  const left = Math.abs(scroller.scrollLeft);
  return direction < 0 ? left > 0 : left < max - 1;
}

/** Scrolls whatever scrolls near the pointer, a little; true if something moved. */
function scrollNear(element: HTMLElement, point: Point): boolean {
  let moved = false;
  for (const vertical of [true, false]) {
    for (const scroller of scrollers(element, vertical)) {
      const view = viewportOf(scroller);
      const p = vertical ? point.y : point.x;
      const lo = vertical ? view.start.y : view.start.x;
      const hi = vertical ? view.end.y : view.end.x;
      if (p < lo || p > hi) continue;
      const direction = p < lo + EDGE ? -1 : p > hi - EDGE ? 1 : 0;
      if (direction === 0 || !canScroll(scroller, vertical, direction)) continue;
      const depth = direction < 0 ? lo + EDGE - p : p - (hi - EDGE);
      const step = Math.ceil((Math.min(depth, EDGE) / EDGE) * EDGE_SPEED) * direction;
      scroller.scrollBy(vertical ? { top: step } : { left: step });
      moved = true;
      break;
    }
  }
  return moved;
}

/** Scrolls the nearest scroll containers so a box (in viewport coordinates) is in view. */
function reveal(element: HTMLElement, box: Box): void {
  for (const vertical of [true, false]) {
    const scroller = scrollers(element, vertical)[0];
    if (!scroller) continue;
    const view = viewportOf(scroller);
    const lo = vertical ? box.top : box.left;
    const hi = lo + (vertical ? box.height : box.width);
    const viewLo = vertical ? view.start.y : view.start.x;
    const viewHi = vertical ? view.end.y : view.end.x;
    const delta = lo < viewLo ? lo - viewLo : hi > viewHi ? hi - viewHi : 0;
    if (delta !== 0) scroller.scrollBy(vertical ? { top: delta } : { left: delta });
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The gesture.

type Session = {
  id: string;
  reason: SortableReason;
  handle: HTMLElement;
  lists: ListGeo[];
  source: ListGeo;
  origin: number;
  item: ItemGeo;
  over: ListGeo;
  index: number;
  /** Pointer: where the press started and where the item's centre was then. */
  start: Point;
  center: Point;
  pointer: Point;
  pointerId: number;
};

type Layout = {
  over: string | undefined;
  index: number;
  offsets: Record<string, SortableOffset>;
  target: string | undefined;
  side: SortableDropSide | undefined;
};
const IDLE_LAYOUT: Layout = { over: undefined, index: -1, offsets: {}, target: undefined, side: undefined };
const NO_OFFSET: SortableOffset = { x: 0, y: 0 };

function noop(): void {}

function others(list: ListGeo, id: string): ItemGeo[] {
  return list.items.filter((item) => item.id !== id);
}

/** The offsets that open the dragged item's gap at `index` in `over`, and the item it lands beside. */
function layoutFor(session: Session, over: ListGeo, index: number): Layout {
  const offsets: Record<string, SortableOffset> = {};
  const { source, origin, item } = session;
  const sourceShift = size(source, item.rel) + source.gap;
  if (over === source) {
    source.items.forEach((entry, i) => {
      if (i === origin) return;
      if (origin < i && i <= index) offsets[entry.id] = along(source, -sourceShift);
      else if (index <= i && i < origin) offsets[entry.id] = along(source, sourceShift);
    });
  } else {
    source.items.forEach((entry, i) => {
      if (i > origin) offsets[entry.id] = along(source, -sourceShift);
    });
    const overShift = size(over, item.rel) + over.gap;
    over.items.forEach((entry, i) => {
      if (i >= index) offsets[entry.id] = along(over, overShift);
    });
  }
  const rest = others(over, session.id);
  const beside = rest[index] ?? rest.at(-1);
  return {
    over: over.id,
    index,
    offsets,
    target: beside?.id,
    side: beside === undefined ? undefined : rest[index] ? "before" : "after",
  };
}

/** Where the dragged item would rest at `index` in `over`, as an offset from where it rests now. */
function slotOffset(session: Session, over: ListGeo, index: number): SortableOffset {
  const { item, source } = session;
  const current = now(source, item.rel);
  const firstItem = over.items[0];
  const first = firstItem ? now(over, firstItem.rel) : now(over, over.content);
  const rest = others(over, session.id);
  let position = start(over, first);
  for (let i = 0; i < index && i < rest.length; i += 1) position += size(over, rest[i].rel) + over.gap;
  const forward = position - start(over, current);
  const cross = over === source ? 0 : crossStart(over, first) - crossStart(over, current);
  return along(over, forward, cross);
}

function messageDetails(session: Session, list: ListGeo, index: number): SortableMessageDetails {
  const total = others(list, session.id).length + 1;
  return {
    id: session.id,
    label: labelOfItem(session.item.element),
    position: index + 1,
    total,
    list: list.id,
    listLabel: list.label,
    grouped: session.lists.length > 1,
  };
}

type Focused = { handle: HTMLElement; id: string };

function focusedEntry(target: EventTarget | null): Focused | undefined {
  if (!(target instanceof HTMLElement) || !target.hasAttribute(HANDLE)) return undefined;
  const id = target.closest(`[${ITEM}]`)?.getAttribute(ITEM);
  return id == null ? undefined : { handle: target, id };
}

function prevent(event: Event): void {
  if (event.cancelable) event.preventDefault();
}

function swallow(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

/** The click a release that ended a drag would send (to the list, which has the pointer captured) isn't one. */
function suppressClick(): void {
  window.addEventListener("click", swallow, { capture: true, once: true });
  setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
}

/**
 * Drag and drop reordering inside `container`: a Root outside a group, or a Group's element. Items, handles and
 * lists are found in the DOM by their `data-bisque-sortable-*` attributes. The pointer drags from a handle (or an
 * item that is its own handle); the keyboard picks up from one with Space or Enter. Each callback is the owner's
 * hook for that moment; `announce` gets the text for the live region. Returns the drag's state for the parts.
 */
export function createSortable(
  container: Accessor<MaybeElement>,
  options: Accessor<SortableOptions>,
  onStart: (details: SortableDragDetails) => void,
  onOver: (details: SortableDragDetails) => void,
  onDrop: (details: SortableDragDetails) => void,
  onCancel: (details: SortableDragDetails) => void,
  announce: (text: string) => void,
): SortableDragState {
  const [active, setActive] = createSignal<
    { id: string; reason: SortableReason; source: string } | undefined
  >(undefined);
  const [offset, setOffset] = createSignal<SortableOffset>(NO_OFFSET, { equals: sameOffset });
  const [layout, setLayout] = createSignal<Layout>(IDLE_LAYOUT);
  let last = "";
  const say = (text: string) => {
    // A live region announces a change of text: the same message twice in a row gets a trailing space.
    last = text === last.trimEnd() && !last.endsWith(" ") ? `${text} ` : text;
    announce(last);
  };

  createEffect(
    () => container(),
    (root) => {
      if (!root) return;
      let session: Session | undefined;
      let pending:
        | { handle: HTMLElement; pointerId: number; start: Point; timer: number; touch: boolean }
        | undefined;
      let frame = 0;
      // The pointer of a drag called off before its release.
      let ending: number | undefined;
      let stopPointer: () => void = noop;

      const details = (s: Session, list: ListGeo, index: number): SortableDragDetails => ({
        id: s.id,
        from: { list: s.source.id, index: s.origin },
        to: { list: list.id, index },
        reason: s.reason,
      });

      const handleOf = (target: EventTarget | null): HTMLElement | undefined => {
        if (!(target instanceof Element)) return undefined;
        const handle = target.closest<HTMLElement>(`[${HANDLE}]`);
        if (!handle) return undefined;
        const item = handle.closest<HTMLElement>(`[${ITEM}]`);
        const list = item?.closest<HTMLElement>(`[${LIST}]`);
        if (!item || !list) return undefined;
        const owner = root.hasAttribute(GROUP) ? list.closest(`[${GROUP}]`) : list;
        if (owner !== root) return undefined;
        if (item.hasAttribute("data-disabled") || list.hasAttribute("data-disabled")) return undefined;
        if (handle instanceof HTMLButtonElement && handle.disabled) return undefined;
        return handle;
      };

      const begin = (handle: HTMLElement, reason: SortableReason, point: Point, pointerId: number) => {
        if (untrack(options).disabled) return false;
        const itemElement = handle.closest<HTMLElement>(`[${ITEM}]`)!;
        const listElement = itemElement.closest<HTMLElement>(`[${LIST}]`)!;
        const lists = listsOf(root).map(measureList);
        const source = lists.find((list) => list.element === listElement);
        if (!source) return false;
        const origin = source.items.findIndex((item) => item.element === itemElement);
        if (origin < 0) return false;
        const item = source.items[origin];
        const box = now(source, item.rel);
        session = {
          id: item.id,
          reason,
          handle,
          lists,
          source,
          origin,
          item,
          over: source,
          index: origin,
          start: point,
          center: { x: box.left + box.width / 2, y: box.top + box.height / 2 },
          pointer: point,
          pointerId,
        };
        setOffset(NO_OFFSET);
        setLayout(layoutFor(session, source, origin));
        setActive({ id: item.id, reason, source: source.id });
        say(untrack(options).messages.pickedUp(messageDetails(session, source, origin)));
        onStart(details(session, source, origin));
        return true;
      };

      const moveTo = (over: ListGeo, index: number) => {
        const s = session;
        if (!s) return;
        const changed = over !== s.over || index !== s.index;
        s.over = over;
        s.index = index;
        // A key that can't move it further still says where it is.
        if (!changed && s.reason === "keyboard")
          say(untrack(options).messages.moved(messageDetails(s, over, index)));
        if (!changed) return;
        setLayout(layoutFor(s, over, index));
        if (s.reason === "keyboard") setOffset(slotOffset(s, over, index));
        say(untrack(options).messages.moved(messageDetails(s, over, index)));
        onOver(details(s, over, index));
      };

      // `released` is false for a pointer drag called off with Escape while the button is still down: its listeners
      // stay until the release, so the release isn't a click and no text is selected meanwhile.
      const finish = (drop: boolean, released = true) => {
        const s = session;
        if (!s) return;
        session = undefined;
        if (released) stopPointer();
        else ending = s.pointerId;
        cancelAnimationFrame(frame);
        frame = 0;
        const list = drop ? s.over : s.source;
        const index = drop ? s.index : s.origin;
        setActive(undefined);
        setOffset(NO_OFFSET);
        setLayout(IDLE_LAYOUT);
        const messages = untrack(options).messages;
        say((drop ? messages.dropped : messages.cancelled)(messageDetails(s, list, index)));
        if (drop) onDrop(details(s, list, index));
        else onCancel(details(s, s.source, s.origin));
      };

      // Focus through a reorder. A keyed list moves rows with insertBefore, and a focused row that is moved loses
      // focus in every engine; one that went to another list is a new element. That happens after a drop, and again
      // when an owner's server refuses the order and it goes back. So when the rows change while a handle had focus
      // and focus is now on nothing, its item's handle (found again by id) gets it back. Chromium sends `focusout`
      // for a moved element and Firefox and WebKit send nothing: a handle that lost focus to nothing is kept for the
      // rest of the task, a handle that still has it is remembered from `focusin`. A press on empty space changes no
      // rows, so focus stays where the user put it.
      let current: Focused | undefined;
      let lost: Focused | undefined;
      const onFocusIn = (event: FocusEvent) => {
        current = focusedEntry(event.target);
      };
      const onFocusLost = (event: FocusEvent) => {
        const entry = current ?? focusedEntry(event.target);
        current = undefined;
        if (event.relatedTarget !== null || !entry) return;
        lost = entry;
        setTimeout(() => {
          if (lost === entry) lost = undefined;
        }, 0);
      };
      const rows = new MutationObserver(() => {
        const entry = lost ?? current;
        if (!entry) return;
        const focused = document.activeElement;
        if (focused && focused !== document.body) return;
        lost = undefined;
        const item = entry.handle.isConnected
          ? entry.handle.closest<HTMLElement>(`[${ITEM}]`)
          : root.querySelector<HTMLElement>(`[${ITEM}="${CSS.escape(entry.id)}"]`);
        if (!item) return;
        const handle = item.hasAttribute(HANDLE) ? item : item.querySelector<HTMLElement>(`[${HANDLE}]`);
        handle?.focus({ preventScroll: true });
      });
      rows.observe(root, { childList: true, subtree: true });

      // Pointer.

      const pointerTarget = (point: Point) => {
        const s = session!;
        const candidates = s.lists.filter((list) => list === s.source || !list.disabled);
        const over = candidates.toReversed().find((list) => contains(list.element, point)) ?? s.over;
        // The dragged item's centre, carried by the pointer.
        const center = { x: s.center.x + point.x - s.start.x, y: s.center.y + point.y - s.start.y };
        const c = over.vertical ? center.y : over.rtl ? -center.x : center.x;
        let index = 0;
        for (const item of others(over, s.id)) {
          const box = now(over, item.rel);
          if (start(over, box) + size(over, box) / 2 < c) index += 1;
        }
        return { over, index };
      };

      const follow = (point: Point) => {
        const s = session;
        if (!s) return;
        s.pointer = point;
        const rest = now(s.source, s.item.rel);
        const restAtStart = { left: s.center.x - rest.width / 2, top: s.center.y - rest.height / 2 };
        setOffset({
          x: point.x - s.start.x - (rest.left - restAtStart.left),
          y: point.y - s.start.y - (rest.top - restAtStart.top),
        });
        const { over, index } = pointerTarget(point);
        moveTo(over, index);
      };

      const tick = () => {
        const s = session;
        if (!s || s.reason !== "pointer") {
          frame = 0;
          return;
        }
        if (scrollNear(s.over.element, s.pointer)) {
          follow(s.pointer);
          frame = requestAnimationFrame(tick);
        } else frame = 0;
      };

      const activate = () => {
        const p = pending;
        if (!p) return;
        pending = undefined;
        clearTimeout(p.timer);
        if (!begin(p.handle, "pointer", p.start, p.pointerId)) {
          stopPointer();
          return;
        }
        window.getSelection()?.removeAllRanges();
        try {
          root.setPointerCapture(p.pointerId);
        } catch {
          // Not an active pointer (a dispatched event; Firefox throws): the document listeners still follow it.
        }
      };

      const onPointerMove = (event: PointerEvent) => {
        if (pending && event.pointerId === pending.pointerId) {
          const distance = Math.hypot(event.clientX - pending.start.x, event.clientY - pending.start.y);
          if (pending.touch) {
            // A touch that moves before the long press is a scroll: let the browser have it.
            if (distance > LONG_PRESS_TOLERANCE) {
              clearTimeout(pending.timer);
              pending = undefined;
              stopPointer();
            }
            return;
          }
          if (distance < ACTIVATION_DISTANCE) return;
          activate();
        }
        const s = session;
        if (!s || s.reason !== "pointer" || event.pointerId !== s.pointerId) return;
        // A release that something else swallowed: end the drag rather than follow a pointer that isn't pressed.
        if (event.buttons === 0 && event.pointerType === "mouse") {
          finish(true);
          return;
        }
        follow({ x: event.clientX, y: event.clientY });
        if (frame === 0) frame = requestAnimationFrame(tick);
      };

      const onPointerUp = (event: PointerEvent) => {
        if (pending && event.pointerId === pending.pointerId) {
          clearTimeout(pending.timer);
          pending = undefined;
          stopPointer();
          return;
        }
        if (ending === event.pointerId && !session) {
          ending = undefined;
          stopPointer();
          suppressClick();
          return;
        }
        const s = session;
        if (!s || s.reason !== "pointer" || event.pointerId !== s.pointerId) return;
        finish(event.type === "pointerup");
        // The click that follows the release that ended a drag is not a click.
        suppressClick();
      };

      const onKeyWhilePointer = (event: KeyboardEvent) => {
        if (event.key !== "Escape" || session?.reason !== "pointer") return;
        event.preventDefault();
        event.stopPropagation();
        finish(false, false);
      };

      const onPointerDown = (event: PointerEvent) => {
        if (session || pending || event.button !== 0 || event.defaultPrevented) return;
        ending = undefined;
        stopPointer();
        const handle = handleOf(event.target);
        if (!handle) return;
        // An item that is its own handle keeps its controls: a press on a button or field inside it is theirs.
        if (handle.hasAttribute(ITEM) && event.target instanceof Element) {
          const control = event.target.closest(INTERACTIVE);
          if (control && control !== handle && handle.contains(control)) return;
        }
        const touch = event.pointerType === "touch" && handle.hasAttribute(ITEM);
        pending = {
          handle,
          pointerId: event.pointerId,
          start: { x: event.clientX, y: event.clientY },
          timer: touch ? window.setTimeout(activate, LONG_PRESS_MS) : 0,
          touch,
        };
        document.addEventListener("pointermove", onPointerMove);
        document.addEventListener("pointerup", onPointerUp);
        document.addEventListener("pointercancel", onPointerUp);
        document.addEventListener("keydown", onKeyWhilePointer, true);
        // While a press may become a drag: no text selection, and no native drag of an image or link inside it.
        document.addEventListener("selectstart", prevent);
        document.addEventListener("dragstart", prevent);
        stopPointer = () => {
          document.removeEventListener("pointermove", onPointerMove);
          document.removeEventListener("pointerup", onPointerUp);
          document.removeEventListener("pointercancel", onPointerUp);
          document.removeEventListener("keydown", onKeyWhilePointer, true);
          document.removeEventListener("selectstart", prevent);
          document.removeEventListener("dragstart", prevent);
          stopPointer = noop;
        };
      };

      // A touch drag of an item with no `touch-action: none` would scroll the page and cancel the pointer.
      const onTouchMove = (event: TouchEvent) => {
        if (session?.reason === "pointer" && event.cancelable) event.preventDefault();
      };

      // Keyboard.

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
        const s = session;
        if (!s) {
          if (event.key !== " " && event.key !== "Enter") return;
          const handle = handleOf(event.target);
          // An item that is its own handle: only a key pressed on the item itself, not in a field inside it.
          if (!handle || (handle.hasAttribute(ITEM) && event.target !== handle)) return;
          event.preventDefault();
          begin(handle, "keyboard", { x: 0, y: 0 }, -1);
          return;
        }
        if (s.reason !== "keyboard" || event.target !== s.handle) return;
        const key = event.key;
        if (key === " " || key === "Enter") {
          event.preventDefault();
          finish(true);
          return;
        }
        if (key === "Escape") {
          // Also keeps an enclosing dialog or popover open.
          event.preventDefault();
          event.stopPropagation();
          finish(false);
          return;
        }
        if (key === "Tab") return;
        const over = s.over;
        const count = others(over, s.id).length;
        const forward = over.vertical ? "ArrowDown" : over.rtl ? "ArrowLeft" : "ArrowRight";
        const backward = over.vertical ? "ArrowUp" : over.rtl ? "ArrowRight" : "ArrowLeft";
        const nextList = over.vertical ? (over.rtl ? "ArrowLeft" : "ArrowRight") : "ArrowDown";
        const previousList = over.vertical ? (over.rtl ? "ArrowRight" : "ArrowLeft") : "ArrowUp";
        let target: { over: ListGeo; index: number } | undefined;
        if (key === forward) target = { over, index: Math.min(s.index + 1, count) };
        else if (key === backward) target = { over, index: Math.max(s.index - 1, 0) };
        else if (key === "Home") target = { over, index: 0 };
        else if (key === "End") target = { over, index: count };
        else if (key === nextList || key === previousList) {
          const step = key === nextList ? 1 : -1;
          const usable = s.lists.filter((list) => list === s.source || !list.disabled);
          const next = usable[usable.indexOf(over) + step];
          if (next) target = { over: next, index: Math.min(s.index, others(next, s.id).length) };
          else {
            event.preventDefault();
            return;
          }
        }
        if (!target) return;
        event.preventDefault();
        moveTo(target.over, target.index);
        const slot = slotOffset(s, target.over, target.index);
        const rest = now(s.source, s.item.rel);
        reveal(target.over.element, { ...rest, left: rest.left + slot.x, top: rest.top + slot.y });
      };

      const onKeyUp = (event: KeyboardEvent) => {
        // A button activates on the release of Space: not when that Space picked the item up or dropped it.
        if (event.key === " " && handleOf(event.target)) event.preventDefault();
      };

      // Focus leaving the handle mid-drag (Tab, a press elsewhere) calls the drag off.
      const onFocusOut = (event: FocusEvent) => {
        const s = session;
        if (!s || s.reason !== "keyboard" || event.target !== s.handle) return;
        queueMicrotask(() => {
          if (session === s && document.activeElement !== s.handle) finish(false);
        });
      };

      root.addEventListener("pointerdown", onPointerDown);
      root.addEventListener("touchmove", onTouchMove, { passive: false });
      root.addEventListener("keydown", onKeyDown);
      root.addEventListener("keyup", onKeyUp);
      root.addEventListener("focusout", onFocusOut);
      root.addEventListener("focusout", onFocusLost);
      root.addEventListener("focusin", onFocusIn);
      return () => {
        root.removeEventListener("focusin", onFocusIn);
        rows.disconnect();
        root.removeEventListener("focusout", onFocusLost);
        root.removeEventListener("pointerdown", onPointerDown);
        root.removeEventListener("touchmove", onTouchMove);
        root.removeEventListener("keydown", onKeyDown);
        root.removeEventListener("keyup", onKeyUp);
        root.removeEventListener("focusout", onFocusOut);
        if (pending) clearTimeout(pending.timer);
        pending = undefined;
        session = undefined;
        cancelAnimationFrame(frame);
        stopPointer();
      };
    },
  );

  return {
    get active() {
      return active()?.id;
    },
    get reason() {
      return active()?.reason;
    },
    get source() {
      return active()?.source;
    },
    get over() {
      return layout().over;
    },
    get index() {
      return layout().index;
    },
    get x() {
      return offset().x;
    },
    get y() {
      return offset().y;
    },
    get offsets() {
      return layout().offsets;
    },
    get target() {
      return layout().target;
    },
    get side() {
      return layout().side;
    },
  };
}

function sameOffset(a: SortableOffset, b: SortableOffset): boolean {
  return a.x === b.x && a.y === b.y;
}
