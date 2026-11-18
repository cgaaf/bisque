// Layout maths and pointer dragging for the splitter, which `.rx` can't do itself: it has no `Math`, loops,
// `JSON` or layout. `../splitter.d.rx` declares how `.rx` may call it.
//
// A layout is one size per panel, in percent of the space the panels share (the group less its handles), in the
// panels' document order, summing to 100. The functions here never read the DOM, except the two primitives at the
// end: the registry that reads which panels and handles a root holds, and the pointer drag.
import { createEffect, createSignal, untrack, type Accessor } from "solid-js";

type MaybeElement = HTMLElement | undefined;

export type SplitterOrientation = "horizontal" | "vertical";

/** What a panel declares about itself, carried on its element (`data-bisque-splitter-panel`) as JSON. */
export type SplitterPanelSpec = {
  id: string;
  /** Percent. Undefined shares what the panels with a default leave. */
  defaultSize: number | undefined;
  minSize: number;
  maxSize: number;
  collapsible: boolean;
  collapsedSize: number;
};

/** A handle (by its `data-bisque-splitter-handle` id) and the index of the panel before it, or -1. */
export type SplitterHandleSpec = { id: string; before: number };

/** What a root holds, read from the DOM. */
export type SplitterItems = { panels: SplitterPanelSpec[]; handles: SplitterHandleSpec[] };

/** A panel's last open size, kept so Enter can restore it after collapsing. */
export type SplitterRestore = { id: string; size: number };

/**
 * What moved a handle. A drag collapses a collapsible panel once it passes halfway between its minimum and
 * collapsed sizes, and expands a collapsed one once it passes halfway back; an arrow key collapses a panel that is
 * already at its minimum and expands a collapsed one to its minimum; an exact move (Home/End, Enter, a reset)
 * collapses only when asked for the collapsed size.
 */
export type SplitterTrigger = "pointer" | "keyboard" | "exact";

export const EPSILON = 1e-6;

const ROOT = "[data-bisque-splitter-root]";
const PANEL = "[data-bisque-splitter-panel]";
const HANDLE = "[data-bisque-splitter-handle]";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function finite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * A panel's declaration as the attribute value its element carries. Sizes are clamped to 0–100, the maximum to at
 * least the minimum, and the collapsed size to at most the minimum.
 */
export function encodePanel(
  id: string,
  defaultSize: number | undefined,
  minSize: number,
  maxSize: number,
  collapsible: boolean,
  collapsedSize: number,
): string {
  const min = clamp(finite(minSize, 0), 0, 100);
  const max = clamp(finite(maxSize, 100), min, 100);
  const spec: SplitterPanelSpec = {
    id,
    defaultSize: defaultSize === undefined ? undefined : clamp(finite(defaultSize, 0), 0, 100),
    minSize: min,
    maxSize: max,
    collapsible,
    collapsedSize: clamp(finite(collapsedSize, 0), 0, min),
  };
  return JSON.stringify(spec);
}

/** Reads a panel's declaration back from its attribute value; undefined when it isn't one. */
export function decodePanel(text: string | null): SplitterPanelSpec | undefined {
  if (!text) return undefined;
  try {
    const value = JSON.parse(text) as Partial<SplitterPanelSpec>;
    if (typeof value?.id !== "string") return undefined;
    const min = clamp(finite(value.minSize, 0), 0, 100);
    return {
      id: value.id,
      defaultSize: typeof value.defaultSize === "number" ? value.defaultSize : undefined,
      minSize: min,
      maxSize: clamp(finite(value.maxSize, 100), min, 100),
      collapsible: value.collapsible === true,
      collapsedSize: clamp(finite(value.collapsedSize, 0), 0, min),
    };
  } catch {
    return undefined;
  }
}

/** Whether a panel at `size` is collapsed: it is collapsible and no bigger than its collapsed size. */
export function isCollapsed(size: number | undefined, panel: SplitterPanelSpec | undefined): boolean {
  return (
    panel !== undefined && size !== undefined && panel.collapsible && size <= panel.collapsedSize + EPSILON
  );
}

function clampToPanel(size: number, panel: SplitterPanelSpec): number {
  if (isCollapsed(size, panel)) return panel.collapsedSize;
  return clamp(size, panel.minSize, panel.maxSize);
}

/**
 * Makes any list of numbers a valid layout for `panels`: one size per panel, scaled to sum to 100, each within its
 * panel's bounds (or exactly collapsed), the difference handed to the panels that can still take it, in order.
 * When the bounds can't all be met (minimums that add up to more than 100), the sum wins over the bounds.
 */
export function validateLayout(layout: readonly number[], panels: readonly SplitterPanelSpec[]): number[] {
  const count = panels.length;
  if (count === 0) return [];
  const sizes = panels.map((_, index) => Math.max(0, finite(layout[index], 0)));
  const total = sizes.reduce((sum, size) => sum + size, 0);
  const scaled = total > EPSILON ? sizes.map((size) => (size / total) * 100) : sizes.map(() => 100 / count);
  const next = scaled.map((size, index) => clampToPanel(size, panels[index]));
  let remainder = 100 - next.reduce((sum, size) => sum + size, 0);
  // First within the open panels' bounds, then, if that can't absorb it, into any panel regardless of bounds.
  for (let index = 0; index < count && Math.abs(remainder) > EPSILON; index += 1) {
    const panel = panels[index];
    if (isCollapsed(next[index], panel)) continue;
    const target = clamp(next[index] + remainder, panel.minSize, panel.maxSize);
    remainder -= target - next[index];
    next[index] = target;
  }
  if (Math.abs(remainder) > EPSILON) {
    for (let index = count - 1; index >= 0 && Math.abs(remainder) > EPSILON; index -= 1) {
      const target = Math.max(0, next[index] + remainder);
      remainder -= target - next[index];
      next[index] = target;
    }
  }
  return next;
}

/**
 * The layout before anything has moved: `defaultSizes` when it has one size per panel, else each panel's
 * `defaultSize`, with what those leave shared equally by the panels without one.
 */
export function initialLayout(
  panels: readonly SplitterPanelSpec[],
  defaultSizes?: readonly number[],
): number[] {
  if (defaultSizes && defaultSizes.length === panels.length) return validateLayout(defaultSizes, panels);
  let assigned = 0;
  let unassigned = 0;
  for (const panel of panels) {
    if (panel.defaultSize === undefined) unassigned += 1;
    else assigned += panel.defaultSize;
  }
  const share = unassigned > 0 ? Math.max(0, 100 - assigned) / unassigned : 0;
  return validateLayout(
    panels.map((panel) => panel.defaultSize ?? share),
    panels,
  );
}

/**
 * The layout to show for the panels a root holds now, from sizes that were given for some set of panels:
 * - `ids` names the panels `sizes` belonged to (the root's own layout): each panel still there keeps its size, a
 *   new one takes its default (or an equal share), and the result is validated. That is what keeps sizes sane when
 *   a panel is added or removed after mount.
 * - Without `ids` (the app's `sizes`, `defaultSizes`), sizes are positional: used when there is one per panel,
 *   otherwise the panels' defaults apply.
 */
export function resolveLayout(
  sizes: readonly number[] | undefined,
  ids: readonly string[],
  panels: readonly SplitterPanelSpec[],
): number[] {
  if (panels.length === 0) return [];
  if (sizes === undefined) return initialLayout(panels);
  if (ids.length === sizes.length && ids.length > 0) {
    const same = ids.length === panels.length && ids.every((id, index) => panels[index].id === id);
    if (same) return validateLayout(sizes, panels);
    const byId = new Map(ids.map((id, index) => [id, sizes[index]] as const));
    const kept = panels.filter((panel) => byId.has(panel.id));
    const fresh = panels.filter((panel) => !byId.has(panel.id));
    // New panels take their default size, or an equal share of a group that has one more panel.
    const share = 100 / panels.length;
    const added = fresh.reduce((sum, panel) => sum + (panel.defaultSize ?? share), 0);
    const keptTotal = kept.reduce((sum, panel) => sum + finite(byId.get(panel.id), 0), 0);
    const room = Math.max(0, 100 - added);
    return validateLayout(
      panels.map((panel) => {
        if (!byId.has(panel.id)) return panel.defaultSize ?? share;
        const size = finite(byId.get(panel.id), 0);
        return keptTotal > EPSILON ? (size / keptTotal) * room : room / Math.max(1, kept.length);
      }),
      panels,
    );
  }
  return initialLayout(panels, sizes);
}

/**
 * Moves the handle between panel `handle` and panel `handle + 1` by `delta` percent (positive grows the panel
 * before it). The shrinking side gives the space, starting with the adjacent panel and moving outwards as panels
 * reach their minimum; the growing side takes it, the adjacent panel first, spilling outwards as panels reach
 * their maximum. Collapsed panels other than the adjacent one are passed over on both sides. Returns the layout
 * unchanged when the move isn't possible, and moves as far as the bounds allow otherwise.
 */
export function moveHandle(
  layout: readonly number[],
  panels: readonly SplitterPanelSpec[],
  handle: number,
  delta: number,
  trigger: SplitterTrigger,
): number[] {
  const count = layout.length;
  if (count !== panels.length || handle < 0 || handle >= count - 1 || !(Math.abs(delta) > EPSILON)) {
    return layout.slice();
  }
  const growing = delta > 0;
  const growStart = growing ? handle : handle + 1;
  const growStep = growing ? -1 : 1;
  const shrinkStart = growing ? handle + 1 : handle;
  const shrinkStep = -growStep;
  const inRange = (index: number) => index >= 0 && index < count;
  let amount = Math.abs(delta);

  // A collapsed panel can't stop between its collapsed and minimum sizes: it expands to its minimum or not at all.
  const pivot = panels[growStart];
  const pivotCollapsed = isCollapsed(layout[growStart], pivot);
  const expandGap = pivot.minSize - layout[growStart];
  if (pivotCollapsed) {
    if (trigger === "pointer" && amount < expandGap / 2) return layout.slice();
    amount = Math.max(amount, expandGap);
  }

  let capacity = 0;
  for (let index = growStart; inRange(index); index += growStep) {
    if (index !== growStart && isCollapsed(layout[index], panels[index])) continue;
    capacity += Math.max(0, panels[index].maxSize - layout[index]);
  }
  amount = Math.min(amount, capacity);
  if (amount < EPSILON) return layout.slice();

  const next = layout.slice();
  let given = 0;
  for (let index = shrinkStart; inRange(index) && amount - given > EPSILON; index += shrinkStep) {
    const panel = panels[index];
    const size = next[index];
    if (isCollapsed(size, panel)) continue;
    const wanted = amount - given;
    let target = Math.max(panel.minSize, size - wanted);
    if (index === shrinkStart && panel.collapsible && size - wanted < panel.minSize - EPSILON) {
      const collapse =
        trigger === "pointer"
          ? size - wanted < (panel.minSize + panel.collapsedSize) / 2
          : trigger === "keyboard"
            ? size <= panel.minSize + EPSILON
            : size - wanted <= panel.collapsedSize + EPSILON;
      if (collapse && given + size - panel.collapsedSize <= capacity + EPSILON) target = panel.collapsedSize;
    }
    given += size - target;
    next[index] = target;
  }
  if (given < EPSILON || (pivotCollapsed && given < expandGap - EPSILON)) return layout.slice();

  let rest = given;
  for (let index = growStart; inRange(index) && rest > EPSILON; index += growStep) {
    if (index !== growStart && isCollapsed(layout[index], panels[index])) continue;
    const added = Math.min(rest, Math.max(0, panels[index].maxSize - next[index]));
    next[index] += added;
    rest -= added;
  }
  if (rest > EPSILON) return layout.slice();
  return next;
}

/** Whether two layouts are the same, size for size. */
export function sameSizes(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((size, index) => Math.abs(size - b[index]) < EPSILON);
}

/**
 * The smallest and largest sizes the panel before `handle` can reach by moving that handle alone, given every
 * other panel's bounds: what the handle reports as `aria-valuemin` and `aria-valuemax`, and where Home and End take
 * it. A collapsible panel's smallest is its collapsed size, when the panels after the handle can take the space.
 */
export function handleRange(
  layout: readonly number[],
  panels: readonly SplitterPanelSpec[],
  handle: number,
): [number, number] {
  if (handle < 0 || handle >= layout.length - 1 || layout.length !== panels.length) return [0, 100];
  const low = moveHandle(layout, panels, handle, -100, "exact")[handle];
  const high = moveHandle(layout, panels, handle, 100, "exact")[handle];
  return [low, high];
}

/** One end of `handleRange`, as a whole percent: what the handle announces (`aria-valuemin`, `aria-valuemax`). */
export function handleLimit(
  layout: readonly number[],
  panels: readonly SplitterPanelSpec[],
  handle: number,
  end: "min" | "max",
): number {
  const [low, high] = handleRange(layout, panels, handle);
  return Math.round(end === "min" ? low : high);
}

/**
 * The layout a key press on the handle after panel `handle` asks for, or null for a key the handle doesn't take.
 * Per the APG Window Splitter pattern: the arrows along the group's axis move the handle by `step` (Left/Right in a
 * horizontal group, mirrored in a right-to-left one; Up/Down in a vertical group). Home gives the panel before it
 * its smallest allowed size and End its largest, exactly the ends of `handleRange` that the handle announces: for a
 * collapsible panel Home collapses it (the APG's "may completely collapse"). Enter is `toggleCollapse`.
 */
export function keyLayout(
  key: string,
  layout: readonly number[],
  panels: readonly SplitterPanelSpec[],
  handle: number,
  step: number,
  orientation: SplitterOrientation,
  rtl: boolean,
): number[] | null {
  const panel = panels[handle];
  if (!panel || handle >= layout.length - 1) return null;
  const horizontal = orientation === "horizontal";
  const size = layout[handle];
  let delta: number;
  let trigger: SplitterTrigger = "keyboard";
  switch (key) {
    case "ArrowLeft":
      if (!horizontal) return null;
      delta = rtl ? step : -step;
      break;
    case "ArrowRight":
      if (!horizontal) return null;
      delta = rtl ? -step : step;
      break;
    case "ArrowUp":
      if (horizontal) return null;
      delta = -step;
      break;
    case "ArrowDown":
      if (horizontal) return null;
      delta = step;
      break;
    case "Home":
      delta = handleRange(layout, panels, handle)[0] - size;
      trigger = "exact";
      break;
    case "End":
      delta = handleRange(layout, panels, handle)[1] - size;
      trigger = "exact";
      break;
    default:
      return null;
  }
  return moveHandle(layout, panels, handle, delta, trigger);
}

/**
 * Which panel Enter on the handle after panel `handle` collapses or expands: the panel before it when that one is
 * collapsible (the APG's primary pane), else the panel after it when that one is (a sidebar on the far side), else
 * -1.
 */
export function collapseTarget(panels: readonly SplitterPanelSpec[], handle: number): number {
  if (panels[handle]?.collapsible) return handle;
  if (panels[handle + 1]?.collapsible) return handle + 1;
  return -1;
}

/**
 * Collapses panel `index` if it is open, or expands it if it is collapsed, through the handle beside it. A panel
 * expands to `restore` (its size before it collapsed), at least its minimum size; without one, to its default size
 * or minimum.
 */
export function toggleCollapse(
  layout: readonly number[],
  panels: readonly SplitterPanelSpec[],
  index: number,
  restore: number | undefined,
): number[] {
  const panel = panels[index];
  if (!panel?.collapsible || layout.length !== panels.length || layout.length < 2) return layout.slice();
  const size = layout[index];
  const target = isCollapsed(size, panel)
    ? clamp(restore ?? panel.defaultSize ?? panel.minSize, panel.minSize, panel.maxSize)
    : panel.collapsedSize;
  return resizePanel(layout, panels, index, target);
}

/** Resizes panel `index` to `size` through the handle after it, or the one before it for the last panel. */
export function resizePanel(
  layout: readonly number[],
  panels: readonly SplitterPanelSpec[],
  index: number,
  size: number,
): number[] {
  if (index < 0 || index >= layout.length || layout.length < 2) return layout.slice();
  const delta = size - layout[index];
  if (index < layout.length - 1) return moveHandle(layout, panels, index, delta, "exact");
  return moveHandle(layout, panels, index - 1, -delta, "exact");
}

/** The size Enter restores panel `id` to, if one was remembered. */
export function restoreSizeFor(list: readonly SplitterRestore[], id: string): number | undefined {
  return list.find((entry) => entry.id === id)?.size;
}

/**
 * `list` with the size each panel had in `before` remembered for every panel that is collapsed in `after` and was
 * open in `before`: what Enter restores it to.
 */
export function rememberCollapsed(
  list: readonly SplitterRestore[],
  panels: readonly SplitterPanelSpec[],
  before: readonly number[],
  after: readonly number[],
): SplitterRestore[] {
  if (before.length !== panels.length || after.length !== panels.length) return list.slice();
  let next = list.slice();
  panels.forEach((panel, index) => {
    if (isCollapsed(after[index], panel) && !isCollapsed(before[index], panel)) {
      next = [...next.filter((entry) => entry.id !== panel.id), { id: panel.id, size: before[index] }];
    }
  });
  return next;
}

/** The ids of `panels`, in order. */
export function panelIds(panels: readonly SplitterPanelSpec[]): string[] {
  return panels.map((panel) => panel.id);
}

/** The index of panel `id` in `panels`, or -1. */
export function panelIndex(panels: readonly SplitterPanelSpec[], id: string): number {
  return panels.findIndex((panel) => panel.id === id);
}

/** The index of the panel before handle `id`, or -1 for a handle that isn't between two panels. */
export function handleBefore(items: SplitterItems, id: string): number {
  const before = items.handles.find((handle) => handle.id === id)?.before ?? -1;
  return before >= 0 && before < items.panels.length - 1 ? before : -1;
}

/** A size as the handle announces it: a whole percent. */
export function roundSize(size: number | undefined): number | undefined {
  return size === undefined ? undefined : Math.round(size);
}

/** A panel's flex grow factor: its size, or before the root has read the panels, its default size or 1. */
export function panelGrow(size: number | undefined, fallback: number | undefined): string {
  const grow = size ?? fallback ?? 1;
  // Rounded so a drag doesn't write sizes like 33.333333333333336 into the style attribute.
  return `${Math.round(grow * 1000) / 1000}`;
}

/** Whether `element` lays out right to left. */
export function isRightToLeft(element: Element | null | undefined): boolean {
  return element ? getComputedStyle(element).direction === "rtl" : false;
}

// ---------------------------------------------------------------------------------------------------------------
// The registry: which panels and handles a root holds, in document order.

function ownedBy(root: HTMLElement, element: Element): boolean {
  return element.parentElement?.closest(ROOT) === root;
}

function readItems(root: HTMLElement): SplitterItems {
  const panels: SplitterPanelSpec[] = [];
  const handles: SplitterHandleSpec[] = [];
  for (const element of root.querySelectorAll(`${PANEL}, ${HANDLE}`)) {
    if (!ownedBy(root, element)) continue;
    if (element.hasAttribute("data-bisque-splitter-handle")) {
      handles.push({
        id: element.getAttribute("data-bisque-splitter-handle") ?? "",
        before: panels.length - 1,
      });
    } else {
      const spec = decodePanel(element.getAttribute("data-bisque-splitter-panel"));
      // Two panels with one id are one panel to the layout: the second is ignored.
      if (spec && !panels.some((panel) => panel.id === spec.id)) panels.push(spec);
    }
  }
  return { panels, handles };
}

function sameItems(a: SplitterItems, b: SplitterItems): boolean {
  return (
    a.panels.length === b.panels.length &&
    a.handles.length === b.handles.length &&
    a.panels.every((panel, index) => JSON.stringify(panel) === JSON.stringify(b.panels[index])) &&
    a.handles.every(
      (handle, index) => handle.id === b.handles[index].id && handle.before === b.handles[index].before,
    )
  );
}

/**
 * The panels (with what each declares) and handles inside `root` that belong to it, not to a splitter nested in one
 * of its panels, in document order. Panels and handles don't register: they carry `data-bisque-splitter-panel` and
 * `data-bisque-splitter-handle`, and the root reads them, first in a microtask after it mounts, then whenever its
 * children or those attributes change (a MutationObserver), and outside the flush, so readers see each change once
 * (as `createItemLabels` does). The value changes only when what was read differs.
 */
export function createSplitterRegistry(root: Accessor<MaybeElement>): Accessor<SplitterItems> {
  const [items, setItems] = createSignal<SplitterItems>({ panels: [], handles: [] });
  createEffect(
    () => root(),
    (element) => {
      if (!element) return;
      const read = () => {
        const next = readItems(element);
        setItems((current) => (sameItems(current, next) ? current : next));
      };
      let live = true;
      queueMicrotask(() => {
        if (live) read();
      });
      const observer = new MutationObserver(read);
      observer.observe(element, {
        childList: true,
        subtree: true,
        attributes: true,
        // Not `style`: the sizes written during a drag must not make the root read its children again.
        attributeFilter: ["data-bisque-splitter-panel", "data-bisque-splitter-handle"],
      });
      return () => {
        live = false;
        observer.disconnect();
      };
    },
  );
  return items;
}

// ---------------------------------------------------------------------------------------------------------------
// Pointer dragging.

/** What the drag reads from the root, live. */
export type SplitterDragOptions = {
  layout: number[];
  items: SplitterItems;
  orientation: SplitterOrientation;
  disabled: boolean;
};

const noop = () => {};

/**
 * Dragging a handle of `root` with a pointer. A primary-button press on one of its handles (not a nested
 * splitter's, not a disabled one) focuses the handle, captures the pointer on it and starts the drag; moving the
 * pointer moves the handle by the distance from the press, converted to percent of the space the root's panels
 * share (the root less its handles), and mirrored in a right-to-left horizontal group. Each layout is computed
 * from the one at the press, so dragging past a panel's minimum and back restores it. `onChange` gets each new
 * layout, `onCommit` the last one on release if anything changed, and `onDragging` the handle's id at the press and
 * "" at the release.
 */
export function createSplitterDrag(
  root: Accessor<MaybeElement>,
  options: Accessor<SplitterDragOptions>,
  onChange: (sizes: number[]) => void,
  onCommit: (sizes: number[]) => void,
  onDragging: (handle: string) => void,
): void {
  createEffect(
    () => root(),
    (element) => {
      if (!element) return;
      let stop: () => void = noop;

      const down = (event: PointerEvent) => {
        const o = untrack(options);
        if (o.disabled || event.defaultPrevented || event.button !== 0) return;
        const target = event.target instanceof Element ? event.target : null;
        const handle = target?.closest<HTMLElement>(HANDLE);
        if (!handle || !ownedBy(element, handle) || handle.hasAttribute("data-disabled")) return;
        const id = handle.getAttribute("data-bisque-splitter-handle") ?? "";
        const index = handleBefore(o.items, id);
        if (index < 0 || o.layout.length !== o.items.panels.length) return;
        const horizontal = o.orientation === "horizontal";
        const panels = o.items.panels;
        const base = o.layout.slice();
        // The space the panels share: their own sizes along the axis, which leaves the handles out.
        let available = 0;
        for (const panel of element.querySelectorAll<HTMLElement>(PANEL)) {
          if (!ownedBy(element, panel)) continue;
          const box = panel.getBoundingClientRect();
          available += horizontal ? box.width : box.height;
        }
        const rtl = horizontal && isRightToLeft(element);
        const start = horizontal ? event.clientX : event.clientY;
        let latest = base;
        let changed = false;

        // Keeps the press from selecting text; focus then has to be given by hand.
        event.preventDefault();
        handle.focus({ preventScroll: true });
        try {
          handle.setPointerCapture?.(event.pointerId);
        } catch {
          // Not an active pointer (a synthetic event): the document listeners still follow it.
        }
        onDragging(id);

        const end = () => {
          stop();
          try {
            if (handle.hasPointerCapture?.(event.pointerId)) handle.releasePointerCapture(event.pointerId);
          } catch {
            // As above.
          }
          onDragging("");
          if (changed) onCommit(latest);
        };
        const move = (moveEvent: PointerEvent) => {
          // A release another element swallowed: end the drag rather than follow a pointer that isn't pressed.
          if (moveEvent.buttons === 0) {
            end();
            return;
          }
          let pixels = (horizontal ? moveEvent.clientX : moveEvent.clientY) - start;
          if (rtl) pixels = -pixels;
          const delta = available > 0 ? (pixels / available) * 100 : 0;
          const next = moveHandle(base, panels, index, delta, "pointer");
          if (sameSizes(next, latest)) return;
          latest = next;
          changed = true;
          onChange(next);
        };

        stop();
        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", end);
        document.addEventListener("pointercancel", end);
        stop = () => {
          document.removeEventListener("pointermove", move);
          document.removeEventListener("pointerup", end);
          document.removeEventListener("pointercancel", end);
          stop = noop;
        };
      };

      element.addEventListener("pointerdown", down);
      return () => {
        element.removeEventListener("pointerdown", down);
        stop();
      };
    },
  );
}
