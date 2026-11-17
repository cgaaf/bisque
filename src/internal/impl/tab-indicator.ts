// Where the selected tab is inside its list, for a tabs indicator, and which way the selection last moved.
// `../tab-indicator.d.rx` declares how `.rx` may call it.
import { createEffect, createSignal, type Accessor } from "solid-js";

type MaybeElement = HTMLElement | undefined;

export type TabRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};
export type ActivationDirection = "left" | "right" | "up" | "down" | "none";
export type Orientation = "horizontal" | "vertical";

/** The list's selected tab: `[role="tab"][aria-selected="true"]`, leaving out tabs of a list nested in it. */
function selectedTab(list: HTMLElement): HTMLElement | undefined {
  return [...list.querySelectorAll<HTMLElement>('[role="tab"][aria-selected="true"]')].find(
    (tab) => tab.closest('[role="tablist"]') === list,
  );
}

/** The tab's box relative to the list's padding box, including the list's own scroll. */
function measure(tab: HTMLElement, list: HTMLElement): TabRect {
  const tabRect = tab.getBoundingClientRect();
  const listRect = list.getBoundingClientRect();
  const left = tabRect.left - listRect.left + list.scrollLeft - list.clientLeft;
  const top = tabRect.top - listRect.top + list.scrollTop - list.clientTop;
  const width = tab.offsetWidth;
  const height = tab.offsetHeight;
  return {
    left,
    top,
    width,
    height,
    right: list.scrollWidth - left - width,
    bottom: list.scrollHeight - top - height,
  };
}

function direction(from: HTMLElement, to: HTMLElement, orientation: Orientation): ActivationDirection {
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const measured = a.width > 0 && b.width > 0;
  // Without layout (or before it), document order stands in for position.
  const after = measured
    ? orientation === "horizontal"
      ? b.left > a.left
      : b.top > a.top
    : (from.compareDocumentPosition(to) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  if (orientation === "horizontal") return after ? "right" : "left";
  return after ? "down" : "up";
}

const sameRect = (a: TabRect | undefined, b: TabRect | undefined) =>
  a === b ||
  (!!a &&
    !!b &&
    a.left === b.left &&
    a.right === b.right &&
    a.top === b.top &&
    a.bottom === b.bottom &&
    a.width === b.width &&
    a.height === b.height);

/**
 * Measures the selected tab of `list` whenever `value` (the selected value) changes, and when the list or the
 * tab resizes. Returns its rect (undefined while no tab is selected) and the direction of the last change of
 * selection: `"none"` at first, then `left`/`right` (horizontal) or `up`/`down` (vertical).
 *
 * Both are read from the layout, so they are written after the flush that changed the selection, in a microtask:
 * by then every part has written its `aria-selected`, and it is still before the next paint. Written in the
 * flush itself, everything that reads the selection along with them would run twice for one change, the first
 * time with the old rect (`EFFECT_RELAY_TEAR`).
 */
export function createSelectedTab(
  list: Accessor<MaybeElement>,
  value: Accessor<string | undefined>,
  orientation: Accessor<Orientation>,
): [Accessor<TabRect | undefined>, Accessor<ActivationDirection>] {
  const [rect, setRect] = createSignal<TabRect | undefined>(undefined, { equals: sameRect });
  const [moved, setMoved] = createSignal<ActivationDirection>("none");
  let previous: HTMLElement | undefined;

  createEffect(
    () => [list(), value(), orientation()] as const,
    ([el, , axis]) => {
      if (!el) return;
      let live = true;
      const update = () => {
        const current = selectedTab(el);
        setRect(current ? measure(current, el) : undefined);
      };
      queueMicrotask(() => {
        if (!live) return;
        const tab = selectedTab(el);
        if (tab !== previous) {
          if (tab && previous?.isConnected) setMoved(direction(previous, tab, axis));
          previous = tab;
        }
        update();
      });
      if (typeof ResizeObserver !== "function") {
        return () => {
          live = false;
        };
      }
      const observer = new ResizeObserver(update);
      // Every tab: one before the selected tab can move it by changing size.
      observer.observe(el);
      for (const item of el.querySelectorAll<HTMLElement>('[role="tab"]')) observer.observe(item);
      return () => {
        live = false;
        observer.disconnect();
      };
    },
  );

  return [rect, moved];
}
