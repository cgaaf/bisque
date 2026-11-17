// Anchored positioning for popups, on @floating-ui/dom.
import { autoUpdate, computePosition, flip, offset, shift, size, type Placement } from "@floating-ui/dom";
import { createEffect, createSignal, untrack, type Accessor } from "solid-js";

type MaybeElement = HTMLElement | undefined;
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
 *
 * It styles `floating` directly (`position`, `left`, `top`) and sets CSS variables a stylesheet can use:
 * `--anchor-width`, `--anchor-height`, `--available-width`, `--available-height`, `--transform-origin`.
 * It returns the side and alignment actually used, which differ from the requested ones after a flip.
 */
export function createFloating(
  active: Accessor<boolean>,
  anchor: Accessor<MaybeElement>,
  floating: Accessor<MaybeElement>,
  options: Accessor<FloatingOptions>,
): [Accessor<Side>, Accessor<Align>] {
  const [side, setSide] = createSignal<Side>(untrack(options).side);
  const [align, setAlign] = createSignal<Align>(untrack(options).align);

  createEffect(
    () => (active() ? ([anchor(), floating(), options()] as const) : undefined),
    (input) => {
      if (!input) return;
      const [reference, el, wanted] = input;
      if (!reference || !el) return;
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
