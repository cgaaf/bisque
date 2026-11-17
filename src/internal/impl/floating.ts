// Anchored positioning for popups, on @floating-ui/dom.
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
  size,
  type Placement,
  type ReferenceElement,
} from "@floating-ui/dom";
import { createEffect, createSignal, untrack, type Accessor } from "solid-js";

type MaybeElement = HTMLElement | undefined;
/** A point (or a box) in viewport coordinates to position against instead of an element: a context menu's cursor. */
export type AnchorPoint = { x: number; y: number; width?: number; height?: number };
export type Anchor = HTMLElement | AnchorPoint | undefined;
export type Side = "top" | "bottom" | "left" | "right";
export type Align = "start" | "center" | "end";

export type FloatingOptions = {
  side: Side;
  align: Align;
  /** Distance from the anchor, in pixels. */
  sideOffset: number;
  /** Shift along the anchor's edge, in pixels. */
  alignOffset: number;
  /** Space kept between the popup and the viewport's edges, in pixels. */
  collisionPadding: number;
};

const OPPOSITE: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };

/**
 * While `active`, keeps `floating` positioned against `anchor`, flipping and shifting to stay in the viewport.
 * `anchor` is an element, or a point in viewport coordinates (a box when it has a width and height).
 *
 * It styles `floating` directly (`position`, `left`, `top`) and sets CSS variables a stylesheet can use:
 * `--anchor-width`, `--anchor-height`, `--available-width`, `--available-height`, `--transform-origin`.
 * It returns the side and alignment actually used, which differ from the requested ones after a flip.
 */
export function createFloating(
  active: Accessor<boolean>,
  anchor: Accessor<Anchor>,
  floating: Accessor<MaybeElement>,
  options: Accessor<FloatingOptions>,
): [Accessor<Side>, Accessor<Align>] {
  const [side, setSide] = createSignal<Side>(untrack(options).side);
  const [align, setAlign] = createSignal<Align>(untrack(options).align);

  createEffect(
    () => (active() ? ([anchor(), floating(), options()] as const) : undefined),
    (input) => {
      if (!input) return;
      const [target, el, wanted] = input;
      if (!target || !el) return;
      const reference = toReference(target);
      el.style.position = "absolute";
      el.style.left = "0";
      el.style.top = "0";
      const update = async () => {
        const placement = (
          wanted.align === "center" ? wanted.side : `${wanted.side}-${wanted.align}`
        ) as Placement;
        const result = await computePosition(reference, el, {
          placement,
          middleware: [
            offset({ mainAxis: wanted.sideOffset, crossAxis: wanted.alignOffset }),
            flip({ padding: wanted.collisionPadding }),
            shift({ padding: wanted.collisionPadding }),
            size({
              padding: wanted.collisionPadding,
              apply({ availableWidth, availableHeight, rects }) {
                el.style.setProperty("--available-width", `${availableWidth}px`);
                el.style.setProperty("--available-height", `${availableHeight}px`);
                el.style.setProperty("--anchor-width", `${rects.reference.width}px`);
                el.style.setProperty("--anchor-height", `${rects.reference.height}px`);
              },
            }),
          ],
        });
        const [usedSide, usedAlign = "center"] = result.placement.split("-") as [Side, Align?];
        el.style.left = `${result.x}px`;
        el.style.top = `${result.y}px`;
        el.style.setProperty("--transform-origin", `${OPPOSITE[usedSide]} ${usedAlign}`);
        setSide(usedSide);
        setAlign(usedAlign);
      };
      return autoUpdate(reference, el, update);
    },
  );

  return [side, align];
}

/** An element as it is; a point as floating-ui's virtual element, so it can be positioned against. */
function toReference(anchor: HTMLElement | AnchorPoint): ReferenceElement {
  if (anchor instanceof Element) return anchor;
  const { x, y, width = 0, height = 0 } = anchor;
  const rect = { x, y, width, height, left: x, top: y, right: x + width, bottom: y + height };
  return { getBoundingClientRect: () => ({ ...rect, toJSON: () => rect }) as DOMRect };
}
