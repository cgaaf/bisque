// The splitter's layout maths (../internal/impl/splitter.ts), which needs no browser.
import { describe, expect, test } from "vitest";
import {
  collapseTarget,
  decodePanel,
  encodePanel,
  handleRange,
  initialLayout,
  isCollapsed,
  keyLayout,
  moveHandle,
  rememberCollapsed,
  resolveLayout,
  toggleCollapse,
  validateLayout,
  type SplitterPanelSpec,
} from "../internal/impl/splitter.ts";

function panel(id: string, options: Partial<SplitterPanelSpec> = {}): SplitterPanelSpec {
  return {
    id,
    defaultSize: undefined,
    minSize: 0,
    maxSize: 100,
    collapsible: false,
    collapsedSize: 0,
    ...options,
  };
}

const sum = (layout: number[]) => layout.reduce((total, size) => total + size, 0);

function round(layout: number[]) {
  return layout.map((size) => Math.round(size * 1000) / 1000);
}

describe("initialLayout", () => {
  test("panels without a default share what the others leave", () => {
    expect(initialLayout([panel("a", { defaultSize: 40 }), panel("b"), panel("c")])).toEqual([40, 30, 30]);
    expect(round(initialLayout([panel("a"), panel("b"), panel("c")]))).toEqual([33.333, 33.333, 33.333]);
  });

  test("defaultSizes win when there is one per panel, and are ignored otherwise", () => {
    expect(initialLayout([panel("a"), panel("b")], [25, 75])).toEqual([25, 75]);
    expect(initialLayout([panel("a"), panel("b")], [25, 25, 50])).toEqual([50, 50]);
  });

  test("defaults that don't sum to 100 are scaled", () => {
    expect(initialLayout([panel("a", { defaultSize: 20 }), panel("b", { defaultSize: 20 })])).toEqual([
      50, 50,
    ]);
  });
});

describe("validateLayout", () => {
  test("clamps to each panel's bounds and hands the difference on", () => {
    const panels = [panel("a", { minSize: 30 }), panel("b", { maxSize: 50 }), panel("c")];
    const layout = validateLayout([10, 80, 10], panels);
    expect(sum(layout)).toBeCloseTo(100);
    expect(layout[0]).toBeGreaterThanOrEqual(30);
    expect(layout[1]).toBeLessThanOrEqual(50);
  });

  test("keeps a collapsed panel at its collapsed size", () => {
    const panels = [panel("a", { minSize: 20, collapsible: true, collapsedSize: 5 }), panel("b")];
    expect(validateLayout([3, 97], panels)).toEqual([5, 95]);
  });

  test("a wrong length, negative or non-numeric sizes still give a valid layout", () => {
    const panels = [panel("a"), panel("b"), panel("c")];
    expect(sum(validateLayout([50], panels))).toBeCloseTo(100);
    expect(sum(validateLayout([-10, Number.NaN, 20], panels))).toBeCloseTo(100);
    expect(round(validateLayout([0, 0, 0], panels))).toEqual([33.333, 33.333, 33.333]);
  });

  test("minimums that add up to more than 100 give way to the sum", () => {
    const layout = validateLayout([50, 50], [panel("a", { minSize: 60 }), panel("b", { minSize: 60 })]);
    expect(sum(layout)).toBeCloseTo(100);
  });
});

describe("resolveLayout", () => {
  const three = [panel("a"), panel("b"), panel("c", { defaultSize: 20 })];

  test("without sizes, the panels' defaults", () => {
    expect(resolveLayout(undefined, [], three)).toEqual([40, 40, 20]);
  });

  test("positional sizes are used when there is one per panel", () => {
    expect(resolveLayout([10, 20, 70], [], three)).toEqual([10, 20, 70]);
    expect(resolveLayout([50, 50], [], three)).toEqual([40, 40, 20]);
  });

  test("a panel added after mount takes its default; the others keep their proportions", () => {
    const next = resolveLayout([25, 75], ["a", "b"], three);
    expect(round(next)).toEqual([20, 60, 20]);
  });

  test("a panel removed after mount gives its space to the others in proportion", () => {
    const next = resolveLayout([20, 30, 50], ["a", "b", "c"], [panel("a"), panel("c")]);
    expect(round(next)).toEqual([28.571, 71.429]);
  });

  test("panels reordered keep their sizes by id", () => {
    expect(resolveLayout([20, 80], ["a", "b"], [panel("b"), panel("a")])).toEqual([80, 20]);
  });
});

describe("moveHandle", () => {
  test("moves the space between the two panels beside the handle", () => {
    expect(moveHandle([50, 50], [panel("a"), panel("b")], 0, 10, "keyboard")).toEqual([60, 40]);
    expect(moveHandle([50, 50], [panel("a"), panel("b")], 0, -10, "keyboard")).toEqual([40, 60]);
  });

  test("stops at the shrinking panel's minimum and the growing panel's maximum", () => {
    expect(moveHandle([50, 50], [panel("a"), panel("b", { minSize: 45 })], 0, 20, "pointer")).toEqual([
      55, 45,
    ]);
    expect(moveHandle([50, 50], [panel("a", { maxSize: 52 }), panel("b")], 0, 20, "pointer")).toEqual([
      52, 48,
    ]);
  });

  test("with more panels, takes from the nearest ones that can still shrink on that side", () => {
    const panels = [panel("a"), panel("b", { minSize: 20 }), panel("c", { minSize: 10 })];
    expect(round(moveHandle([20, 40, 40], panels, 0, 40, "pointer"))).toEqual([60, 20, 20]);
    expect(round(moveHandle([20, 40, 40], panels, 0, 70, "pointer"))).toEqual([70, 20, 10]);
  });

  test("the growing side spills past a panel at its maximum", () => {
    const panels = [panel("a"), panel("b", { maxSize: 35 }), panel("c")];
    expect(round(moveHandle([20, 30, 50], panels, 0, -20, "pointer"))).toEqual([0, 35, 65]);
    expect(round(moveHandle([20, 30, 50], panels, 1, 20, "pointer"))).toEqual([35, 35, 30]);
  });

  test("a move that isn't possible leaves the layout as it was", () => {
    const panels = [panel("a"), panel("b", { minSize: 50 })];
    expect(moveHandle([50, 50], panels, 0, 10, "keyboard")).toEqual([50, 50]);
    expect(moveHandle([50, 50], panels, 3, 10, "keyboard")).toEqual([50, 50]);
  });

  test("a drag collapses a panel past halfway between its minimum and collapsed sizes, and not before", () => {
    const panels = [panel("a", { minSize: 20, collapsible: true, collapsedSize: 4 }), panel("b")];
    expect(moveHandle([30, 70], panels, 0, -17, "pointer")).toEqual([20, 80]);
    expect(moveHandle([30, 70], panels, 0, -19, "pointer")).toEqual([4, 96]);
  });

  test("a drag expands a collapsed panel past halfway back, to its minimum at least", () => {
    const panels = [panel("a", { minSize: 20, collapsible: true, collapsedSize: 4 }), panel("b")];
    expect(moveHandle([4, 96], panels, 0, 7, "pointer")).toEqual([4, 96]);
    expect(moveHandle([4, 96], panels, 0, 9, "pointer")).toEqual([20, 80]);
  });

  test("an arrow key collapses a panel already at its minimum, and expands it back to its minimum", () => {
    const panels = [panel("a", { minSize: 20, collapsible: true, collapsedSize: 0 }), panel("b")];
    expect(moveHandle([25, 75], panels, 0, -10, "keyboard")).toEqual([20, 80]);
    expect(moveHandle([20, 80], panels, 0, -10, "keyboard")).toEqual([0, 100]);
    expect(moveHandle([0, 100], panels, 0, 10, "keyboard")).toEqual([20, 80]);
  });

  test("from the layout at the press, a drag past a minimum and back restores it", () => {
    const panels = [panel("a"), panel("b", { minSize: 30 })];
    const base = [40, 60];
    expect(moveHandle(base, panels, 0, 50, "pointer")).toEqual([70, 30]);
    expect(moveHandle(base, panels, 0, 0, "pointer")).toEqual([40, 60]);
  });

  test("invariants hold over random layouts, bounds and moves", () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let run = 0; run < 2000; run += 1) {
      const count = 2 + Math.floor(random() * 4);
      const panels = Array.from({ length: count }, (_, index) => {
        const min = Math.floor(random() * (60 / count));
        const max = Math.min(100, min + 10 + Math.floor(random() * 90));
        const collapsible = random() < 0.3;
        return panel(`p${index}`, {
          minSize: min,
          maxSize: max,
          collapsible,
          collapsedSize: collapsible ? Math.floor(random() * min) : 0,
        });
      });
      const raw = panels.map(() => random() * 100);
      const layout = validateLayout(raw, panels);
      const handle = Math.floor(random() * (count - 1));
      const delta = (random() - 0.5) * 120;
      const trigger = (["pointer", "keyboard", "exact"] as const)[Math.floor(random() * 3)];
      const next = moveHandle(layout, panels, handle, delta, trigger);
      expect(next).toHaveLength(count);
      expect(Math.abs(sum(next) - sum(layout))).toBeLessThan(1e-6);
      // A layout that met every bound before still does after the move.
      const metBounds = (l: number[]) =>
        l.every(
          (size, index) =>
            isCollapsed(size, panels[index]) ||
            (size >= panels[index].minSize - 1e-6 && size <= panels[index].maxSize + 1e-6),
        );
      expect(!metBounds(layout) || metBounds(next)).toBe(true);
      // The panels on the growing side only grow; those on the shrinking side only shrink.
      const before = next
        .slice(0, handle + 1)
        .every((size, i) => (delta > 0 ? size >= layout[i] - 1e-6 : size <= layout[i] + 1e-6));
      const after = next
        .slice(handle + 1)
        .every((size, i) =>
          delta > 0 ? size <= layout[handle + 1 + i] + 1e-6 : size >= layout[handle + 1 + i] - 1e-6,
        );
      expect(before && after).toBe(true);
    }
  });
});

describe("keyLayout", () => {
  const panels = [panel("a", { minSize: 10, maxSize: 80 }), panel("b")];

  test("only the arrows on the group's axis move the handle", () => {
    expect(keyLayout("ArrowRight", [50, 50], panels, 0, 10, "horizontal", false)).toEqual([60, 40]);
    expect(keyLayout("ArrowLeft", [50, 50], panels, 0, 10, "horizontal", false)).toEqual([40, 60]);
    expect(keyLayout("ArrowUp", [50, 50], panels, 0, 10, "horizontal", false)).toBeNull();
    expect(keyLayout("ArrowDown", [50, 50], panels, 0, 10, "vertical", false)).toEqual([60, 40]);
    expect(keyLayout("ArrowUp", [50, 50], panels, 0, 10, "vertical", false)).toEqual([40, 60]);
    expect(keyLayout("ArrowLeft", [50, 50], panels, 0, 10, "vertical", false)).toBeNull();
    expect(keyLayout("a", [50, 50], panels, 0, 10, "vertical", false)).toBeNull();
  });

  test("right to left mirrors the horizontal arrows", () => {
    expect(keyLayout("ArrowLeft", [50, 50], panels, 0, 10, "horizontal", true)).toEqual([60, 40]);
    expect(keyLayout("ArrowRight", [50, 50], panels, 0, 10, "horizontal", true)).toEqual([40, 60]);
  });

  test("Home and End give the panel before the handle its minimum and maximum, the ends of its range", () => {
    expect(keyLayout("Home", [50, 50], panels, 0, 10, "horizontal", false)).toEqual([10, 90]);
    expect(keyLayout("End", [50, 50], panels, 0, 10, "horizontal", false)).toEqual([80, 20]);
    expect(handleRange([50, 50], panels, 0)).toEqual([10, 80]);
    // Bounded by the other side too: b can't go below 30.
    const bounded = [panel("a", { minSize: 10 }), panel("b", { minSize: 30 })];
    expect(keyLayout("End", [50, 50], bounded, 0, 10, "horizontal", false)).toEqual([70, 30]);
  });

  test("Home collapses a collapsible panel to its collapsed size, which its range starts at", () => {
    const collapsible = [panel("a", { minSize: 20, collapsible: true, collapsedSize: 5 }), panel("b")];
    expect(handleRange([50, 50], collapsible, 0)).toEqual([5, 100]);
    expect(keyLayout("Home", [50, 50], collapsible, 0, 10, "horizontal", false)).toEqual([5, 95]);
    // When the far side can't take the space, collapsing isn't reachable: range and Home stop at the minimum.
    const full = [
      panel("a", { minSize: 20, collapsible: true, collapsedSize: 5 }),
      panel("b", { maxSize: 75 }),
    ];
    expect(handleRange([50, 50], full, 0)).toEqual([25, 100]);
    expect(keyLayout("Home", [50, 50], full, 0, 10, "horizontal", false)).toEqual([25, 75]);
  });
});

describe("collapse", () => {
  const panels = [
    panel("a", { minSize: 20, collapsible: true, collapsedSize: 5, defaultSize: 30 }),
    panel("b"),
  ];

  test("Enter's panel is the one before the handle if collapsible, else the one after", () => {
    expect(collapseTarget(panels, 0)).toBe(0);
    expect(collapseTarget([panel("a"), panel("b", { collapsible: true })], 0)).toBe(1);
    expect(collapseTarget([panel("a"), panel("b")], 0)).toBe(-1);
  });

  test("toggling collapses an open panel and restores its previous size", () => {
    expect(toggleCollapse([40, 60], panels, 0, undefined)).toEqual([5, 95]);
    expect(toggleCollapse([5, 95], panels, 0, 40)).toEqual([40, 60]);
    // Without a remembered size: the default size.
    expect(toggleCollapse([5, 95], panels, 0, undefined)).toEqual([30, 70]);
  });

  test("the size before a panel collapsed is remembered", () => {
    expect(rememberCollapsed([], panels, [40, 60], [5, 95])).toEqual([{ id: "a", size: 40 }]);
    expect(rememberCollapsed([], panels, [40, 60], [30, 70])).toEqual([]);
  });

  test("a collapsible panel's range reaches its collapsed size", () => {
    expect(handleRange([40, 60], panels, 0)).toEqual([5, 100]);
    expect(handleRange([40, 60], [panel("a", { minSize: 10 }), panel("b", { minSize: 30 })], 0)).toEqual([
      10, 70,
    ]);
  });
});

describe("encodePanel", () => {
  test("round-trips, with bounds put in order", () => {
    const spec = decodePanel(encodePanel("x", 30, 50, 20, true, 80));
    expect(spec).toEqual({
      id: "x",
      defaultSize: 30,
      minSize: 50,
      maxSize: 50,
      collapsible: true,
      collapsedSize: 50,
    });
    expect(decodePanel("not json")).toBeUndefined();
    expect(decodePanel(null)).toBeUndefined();
  });
});
