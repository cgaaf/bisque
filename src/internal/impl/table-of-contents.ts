// Scroll spy for a table of contents: which of a document's sections is being read, and where the link to it sits.
// `../table-of-contents.d.rx` declares how `.rx` may call it.
//
// The platform has the rest (fragment links, `scroll-margin-top`, `scroll-behavior`, `:target`). What it lacks in
// every engine is the one thing here: `:target-current` and `scroll-target-group` are Chrome only, and a
// scroll-driven animation (`view-timeline`) can colour a link but sets no `aria-current`, needs a wrapping element
// and a CSS rule per section, and has no answer for the end of the page.
import { createEffect, createSignal, untrack, type Accessor } from "solid-js";

type MaybeElement = HTMLElement | undefined;

/**
 * How long after a link click, with no `scroll` event since, the scroll it started counts as finished. It stands
 * in for `scrollend` where the click scrolled nothing (the target was already in place) and as a fallback.
 */
const SETTLE_MS = 150;
/** Sub-pixel scroll positions and rounding: a heading this close to the line counts as past it. */
const SLACK = 1;

/** The element id a same-document fragment link points at (`"#intro"` gives `"intro"`), else undefined. */
export function targetId(href: string | undefined): string | undefined {
  if (!href || !href.startsWith("#") || href.length < 2) return undefined;
  try {
    return decodeURIComponent(href.slice(1));
  } catch {
    return href.slice(1);
  }
}

/** The element that scrolls: the container, or the document's scrolling element for the viewport. */
function scrollerOf(container: MaybeElement): HTMLElement {
  return container ?? ((document.scrollingElement ?? document.documentElement) as HTMLElement);
}

/**
 * The active id for the current scroll position: of the targets whose top has reached the line `offset` px below
 * the top of the scrollport, the lowest one (the section being read, however tall it is). At the end of a
 * scrollable range, the last target on the page, which may never reach the line. Undefined while no target has
 * reached the line yet.
 */
export function activeTarget(ids: string[], container: MaybeElement, offset: number): string | undefined {
  const scroller = scrollerOf(container);
  const top = container ? container.getBoundingClientRect().top + container.clientTop : 0;
  const line = top + offset + SLACK;
  let reached: string | undefined;
  let reachedTop = -Infinity;
  let last: string | undefined;
  let lastTop = -Infinity;
  for (const id of ids) {
    const element = document.getElementById(id);
    if (!element || (container && !container.contains(element))) continue;
    // Not rendered (`display: none`, or inside a closed `<details>`): it has no position to compare.
    if (element.getClientRects().length === 0) continue;
    const y = element.getBoundingClientRect().top;
    if (y > lastTop) {
      last = id;
      lastTop = y;
    }
    if (y <= line && y > reachedTop) {
      reached = id;
      reachedTop = y;
    }
  }
  const range = scroller.scrollHeight - scroller.clientHeight;
  const atEnd = range > SLACK && scroller.scrollTop >= range - SLACK;
  return atEnd ? last : reached;
}

/**
 * Follows which of `ids` is active in `container` (the viewport when undefined) as it scrolls, resizes and as the
 * targets come and go, with the line for "reached" `offset` px below the scrollport's top (a sticky header's
 * height). See `activeTarget` for the rule.
 *
 * `activate(id)` makes `id` active at once, for a link that was just clicked: the scroll the click starts (smooth
 * or not) doesn't override it, and neither does where it ends. A target near the end of the page can't reach the
 * line, so the position alone would name another; the clicked id stays active until the user scrolls again.
 *
 * `onChange` is called with each new active id, from an event or a frame, never during a reactive update.
 */
export function createScrollSpy(
  ids: Accessor<string[]>,
  container: Accessor<MaybeElement>,
  offset: Accessor<number>,
  onChange?: (id: string | undefined) => void,
): [Accessor<string | undefined>, (id: string) => void] {
  const [active, setActive] = createSignal<string | undefined>(undefined);
  const write = (id: string | undefined) => {
    if (id === untrack(active)) return;
    setActive(() => id);
    onChange?.(id);
  };

  // The click lock: while `scrolling`, the scroll a click started is running; once `settled`, the clicked id
  // stays until the position moves away from `settledAt`.
  let lock: { phase: "scrolling" | "settled"; settledAt: number } | undefined;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  let frame = 0;
  // What the current effect run measures with; the lock outlives a change of inputs.
  let measure: (() => void) | undefined;
  let currentScroller: HTMLElement | undefined;

  const settle = () => {
    clearTimeout(settleTimer);
    settleTimer = undefined;
    if (lock?.phase === "scrolling") lock = { phase: "settled", settledAt: currentScroller?.scrollTop ?? 0 };
  };
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!lock) measure?.();
    });
  };

  const activate = (id: string) => {
    lock = { phase: "scrolling", settledAt: 0 };
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, SETTLE_MS);
    write(id);
  };

  createEffect(
    () => [ids(), container(), offset()] as const,
    ([list, element, line]) => {
      const scroller = scrollerOf(element);
      // `scroll` and `scrollend` of the viewport are fired at the document.
      const events: EventTarget = element ?? document;
      currentScroller = scroller;
      measure = () => write(activeTarget(list, element, line));

      const onScroll = () => {
        if (lock?.phase === "scrolling") {
          clearTimeout(settleTimer);
          settleTimer = setTimeout(settle, SETTLE_MS);
          return;
        }
        if (lock?.phase === "settled") {
          // A trailing `scroll` from the click's own scroll lands where it settled; a user's scroll moves.
          if (Math.abs(scroller.scrollTop - lock.settledAt) <= SLACK) return;
          lock = undefined;
        }
        schedule();
      };
      events.addEventListener("scroll", onScroll, { passive: true });
      events.addEventListener("scrollend", settle);
      addEventListener("resize", schedule);

      // Targets added, removed or renamed (content that loads after the list), and layout that moves them without a
      // scroll.
      const mutations = new MutationObserver(schedule);
      mutations.observe(element ?? document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["id"],
      });
      const resizes = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : undefined;
      if (resizes) {
        resizes.observe(scroller);
        for (const child of (element ?? document.body).children) resizes.observe(child);
      }

      schedule();
      return () => {
        events.removeEventListener("scroll", onScroll);
        events.removeEventListener("scrollend", settle);
        removeEventListener("resize", schedule);
        mutations.disconnect();
        resizes?.disconnect();
        cancelAnimationFrame(frame);
        frame = 0;
      };
    },
  );

  return [active, activate];
}

/** The ids the fragment links inside `nav` point at, in document order, without repeats. */
function linkedIds(nav: HTMLElement): string[] {
  const ids: string[] = [];
  for (const link of nav.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    const id = targetId(link.getAttribute("href") ?? undefined);
    if (id !== undefined && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * Scroll spy over the sections that the fragment links inside `nav` point at (`<a href="#intro">`): the links are
 * the registry, re-read when they change, so a list rendered from content that arrives later needs nothing more.
 * A primary click on one of those links (or Enter on it) makes its target active at once (`createScrollSpy`'s
 * `activate`); the browser's own navigation still happens, so the URL and `:target` update as without script.
 */
export function createTableOfContents(
  nav: Accessor<MaybeElement>,
  container: Accessor<MaybeElement>,
  offset: Accessor<number>,
  onChange: (id: string | undefined) => void,
): Accessor<string | undefined> {
  const [ids, setIds] = createSignal<string[]>([], { equals: sameIds });
  const [active, activate] = createScrollSpy(ids, container, offset, onChange);

  createEffect(nav, (element) => {
    if (!element) return;
    const read = () => setIds(linkedIds(element));
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!link || !element.contains(link)) return;
      const id = targetId(link.getAttribute("href") ?? undefined);
      if (id !== undefined) activate(id);
    };
    const observer = new MutationObserver(read);
    observer.observe(element, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href"],
    });
    element.addEventListener("click", onClick);
    read();
    return () => {
      observer.disconnect();
      element.removeEventListener("click", onClick);
    };
  });

  return active;
}

export type LinkRect = { top: number; left: number; width: number; height: number };

const sameRect = (a: LinkRect | undefined, b: LinkRect | undefined) =>
  a === b ||
  (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);

/** The first link inside `nav` that points at `id`. */
function linkTo(nav: HTMLElement, id: string): HTMLElement | undefined {
  for (const link of nav.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    if (targetId(link.getAttribute("href") ?? undefined) === id) return link;
  }
  return undefined;
}

/**
 * The box of the link to `activeId` inside `nav`, relative to the nav's padding box (including its own scroll),
 * for an indicator. Measured after the change that set `activeId` (in a microtask, still before the next paint),
 * and again when the nav or its content resizes. Undefined while no link is active or none points at it.
 */
export function createActiveLinkRect(
  nav: Accessor<MaybeElement>,
  activeId: Accessor<string | undefined>,
): Accessor<LinkRect | undefined> {
  const [rect, setRect] = createSignal<LinkRect | undefined>(undefined, { equals: sameRect });
  createEffect(
    () => [nav(), activeId()] as const,
    ([element, id]) => {
      if (!element) return;
      let live = true;
      const update = () => {
        const link = id === undefined ? undefined : linkTo(element, id);
        if (!link) {
          setRect(undefined);
          return;
        }
        const a = link.getBoundingClientRect();
        const b = element.getBoundingClientRect();
        setRect({
          top: a.top - b.top + element.scrollTop - element.clientTop,
          left: a.left - b.left + element.scrollLeft - element.clientLeft,
          width: link.offsetWidth,
          height: link.offsetHeight,
        });
      };
      queueMicrotask(() => {
        if (live) update();
      });
      if (typeof ResizeObserver !== "function") {
        return () => {
          live = false;
        };
      }
      const observer = new ResizeObserver(update);
      observer.observe(element);
      for (const link of element.querySelectorAll("a[href]")) observer.observe(link);
      return () => {
        live = false;
        observer.disconnect();
      };
    },
  );
  return rect;
}
