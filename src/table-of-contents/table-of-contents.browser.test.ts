import { afterEach, describe, expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import container from "./fixtures/container.rx";
import controlled from "./fixtures/controlled.rx";
import dynamic from "./fixtures/dynamic.rx";

/** The text of the link marked as the current location, or null. Fails if more than one is marked. */
function active(): string | null {
  const marked = [...document.querySelectorAll('a[aria-current="location"]')];
  expect(marked.length).toBeLessThanOrEqual(1);
  return marked[0]?.textContent ?? null;
}

/** Waits for the scroll spy's next frame and the browser's paint after it. */
async function frames(count = 3): Promise<void> {
  // oxlint-disable-next-line no-await-in-loop -- each frame follows the one before
  for (let i = 0; i < count; i += 1) await frame();
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Scrolls the document so `id`'s heading sits `at` px below the viewport's top. */
async function scrollPageTo(id: string, at: number): Promise<void> {
  const heading = document.getElementById(id)!;
  window.scrollTo({ top: heading.getBoundingClientRect().top + window.scrollY - at, behavior: "instant" });
  await frames();
}

/** Scrolls `box` so `id`'s heading is at its top (or as far as it goes). */
async function scrollBoxTo(box: HTMLElement, id: string, extra = 0): Promise<void> {
  const heading = document.getElementById(id)!;
  const top = heading.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
  box.scrollTo({ top: top + extra, behavior: "instant" });
  await frames();
}

afterEach(() => {
  history.replaceState(null, "", location.pathname + location.search);
  window.scrollTo({ top: 0, behavior: "instant" });
});

describe("in the viewport", () => {
  test("is a labelled navigation landmark with nothing marked before the first heading", async () => {
    const { getByRole } = mount(basic);
    await frames();
    expect(getByRole("navigation", { name: "On this page" })).toBeTruthy();
    expect(active()).toBe(null);
    expect(getByRole("link", { name: "Alpha" }).hasAttribute("data-active")).toBe(false);
  });

  test("marks the link with aria-current=location and data-active, and only that one", async () => {
    const { getByRole } = mount(basic);
    await scrollPageTo("beta", 40);
    const link = getByRole("link", { name: "Beta" });
    expect(link.getAttribute("aria-current")).toBe("location");
    expect(link.hasAttribute("data-active")).toBe(true);
    expect(getByRole("link", { name: "Alpha" }).hasAttribute("aria-current")).toBe(false);
    expect(getByRole("link", { name: "Alpha" }).hasAttribute("data-active")).toBe(false);
  });

  test("with several headings in view, the lowest one past the offset line wins", async () => {
    mount(basic);
    // Alpha at the line; Beta and Gamma are visible below it.
    await scrollPageTo("alpha", 40);
    expect(active()).toBe("Alpha");
    // Alpha has gone under the header, Beta is 10px below the line: still Alpha.
    await scrollPageTo("beta", 50);
    expect(active()).toBe("Alpha");
    await scrollPageTo("beta", 40);
    expect(active()).toBe("Beta");
    await scrollPageTo("gamma", 45);
    expect(active()).toBe("Beta");
  });

  test("a section taller than the viewport stays active after its heading has scrolled away", async () => {
    mount(basic);
    await scrollPageTo("gamma", 40);
    expect(active()).toBe("Gamma");
    await scrollPageTo("gamma", -800);
    expect(document.getElementById("gamma")!.getBoundingClientRect().bottom).toBeLessThan(0);
    expect(active()).toBe("Gamma");
  });

  test("at the bottom of the page the last heading is active, though it can't reach the line", async () => {
    mount(basic);
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
    await frames();
    expect(document.getElementById("epsilon")!.getBoundingClientRect().top).toBeGreaterThan(40);
    expect(active()).toBe("Epsilon");
    window.scrollBy({ top: -60, behavior: "instant" });
    await frames();
    expect(active()).toBe("Gamma");
  });

  test("reports each change to onActiveChange", async () => {
    const { getByTestId } = mount(basic);
    await scrollPageTo("alpha", 40);
    expect(getByTestId("reported").textContent).toBe("alpha");
    await scrollPageTo("gamma", 40);
    expect(getByTestId("reported").textContent).toBe("gamma");
    const calls = Number(getByTestId("calls").textContent);
    // Scrolling within the same section reports nothing.
    await scrollPageTo("gamma", -100);
    expect(Number(getByTestId("calls").textContent)).toBe(calls);
    await scrollPageTo("alpha", 200);
    expect(getByTestId("reported").textContent).toBe("undefined");
  });

  test("a clicked link is active at once and stays active where the scroll ends, until the user scrolls", async () => {
    const { getByRole, user } = mount(basic);
    await user.click(getByRole("link", { name: "Delta" }));
    expect(active()).toBe("Delta");
    expect(location.hash).toBe("#delta");
    await wait(300);
    await frames();
    // Delta can't reach the line: the page is at its end, where the position alone names Epsilon.
    const range = document.documentElement.scrollHeight - window.innerHeight;
    expect(Math.abs(window.scrollY - range)).toBeLessThanOrEqual(1);
    expect(active()).toBe("Delta");
    window.scrollBy({ top: -60, behavior: "instant" });
    await frames();
    expect(active()).toBe("Gamma");
  });

  test("Enter on a link activates it", async () => {
    const { getByRole, user } = mount(basic);
    getByRole("link", { name: "Beta" }).focus();
    await user.keyboard("{Enter}");
    expect(active()).toBe("Beta");
    await wait(300);
    await frames();
    expect(active()).toBe("Beta");
    expect(Math.round(document.getElementById("beta")!.getBoundingClientRect().top)).toBe(40);
  });

  test("the indicator is placed on the active link through CSS variables", async () => {
    const { getByRole, getByTestId } = mount(basic);
    await scrollPageTo("gamma", 40);
    await frames();
    const nav = getByRole("navigation");
    const link = getByRole("link", { name: "Gamma" });
    const indicator = getByTestId("indicator");
    expect(indicator.hidden).toBe(false);
    expect(indicator.getAttribute("aria-hidden")).toBe("true");
    const top = link.getBoundingClientRect().top - nav.getBoundingClientRect().top;
    expect(parseFloat(indicator.style.getPropertyValue("--active-link-top"))).toBeCloseTo(top, 0);
    expect(indicator.style.getPropertyValue("--active-link-height")).toBe(`${link.offsetHeight}px`);
    expect(indicator.style.getPropertyValue("--active-link-width")).toBe(`${link.offsetWidth}px`);
  });
});

describe("in a scroll container", () => {
  test("follows the container's scroll, not the page's", async () => {
    const { getByTestId } = mount(container);
    const box = getByTestId("box");
    await frames();
    expect(active()).toBe("One");
    await scrollBoxTo(box, "n-three");
    expect(active()).toBe("Three");
    expect(getByTestId("reported").textContent).toBe("n-three");
    await scrollBoxTo(box, "n-two", 100);
    expect(active()).toBe("Two");
    expect(window.scrollY).toBe(0);
  });

  test("a click isn't overridden by the headings a smooth scroll passes, nor by where it ends", async () => {
    const { getByRole, getByTestId } = mount(container);
    const box = getByTestId("box");
    await frames();
    expect(active()).toBe("One");
    getByRole("link", { name: "Four" }).click();
    const seen = new Set<string | null>();
    let last = -1;
    let still = 0;
    let moved = false;
    while (still < 5) {
      // oxlint-disable-next-line no-await-in-loop -- sampled once per frame until the scroll stops
      await frame();
      seen.add(active());
      if (box.scrollTop !== last && last !== -1) moved = true;
      still = box.scrollTop === last ? still + 1 : 0;
      last = box.scrollTop;
    }
    expect(moved).toBe(true);
    expect([...seen]).toEqual(["Four"]);
    await wait(300);
    await frames();
    // At the end of the box, where the position alone names Five.
    expect(Math.abs(box.scrollTop - (box.scrollHeight - box.clientHeight))).toBeLessThanOrEqual(1);
    expect(active()).toBe("Four");
    expect(getByTestId("reported").textContent).toBe("n-four");
    box.scrollTo({ top: 500, behavior: "instant" });
    await frames();
    expect(active()).toBe("Two");
  });

  test("a click scrolls the container only, not the page around it, and updates the URL", async () => {
    const { getByRole, getByTestId, user } = mount(container);
    const box = getByTestId("box");
    await frames();
    window.scrollTo({ top: 20, behavior: "instant" });
    await frames();
    await user.click(getByRole("link", { name: "Three" }));
    await wait(600);
    await frames();
    expect(window.scrollY).toBe(20);
    const heading = document.getElementById("n-three")!;
    expect(
      Math.abs(heading.getBoundingClientRect().top - box.getBoundingClientRect().top),
    ).toBeLessThanOrEqual(1);
    expect(location.hash).toBe("#n-three");
    expect(active()).toBe("Three");
  });
});

describe("controlled", () => {
  test("shows the owner's id and reports what the scroll position names", async () => {
    const { getByRole, getByTestId, user } = mount(controlled);
    const box = getByTestId("box");
    await frames();
    expect(active()).toBe("One");
    await scrollBoxTo(box, "c-three");
    expect(getByTestId("reported").textContent).toBe("c-three");
    expect(active()).toBe("One");
    await user.click(getByRole("button", { name: "Mark three" }));
    expect(active()).toBe("Three");
  });

  test("any fragment link inside the root counts as a click on an item, a plain <a> too", async () => {
    const { getByTestId } = mount(controlled);
    const box = getByTestId("box");
    await frames();
    getByTestId("plain").click();
    await wait(300);
    await frames();
    expect(Math.abs(box.scrollTop - (box.scrollHeight - box.clientHeight))).toBeLessThanOrEqual(1);
    expect(getByTestId("reported").textContent).toBe("c-two");
  });
});

describe("sections that change after mount", () => {
  test("a section added later is followed", async () => {
    const { getByRole, getByTestId, user } = mount(dynamic);
    const box = getByTestId("box");
    await user.click(getByRole("button", { name: "Add three" }));
    await frames();
    expect(getByRole("link", { name: "Three" })).toBeTruthy();
    await scrollBoxTo(box, "d-three", 10);
    expect(active()).toBe("Three");
  });

  test("removing the active section moves the mark without a scroll", async () => {
    const { getByRole, getByTestId, user } = mount(dynamic);
    const box = getByTestId("box");
    await user.click(getByRole("button", { name: "Add three" }));
    await frames();
    await scrollBoxTo(box, "d-two", 10);
    expect(active()).toBe("Two");
    const before = box.scrollTop;
    await user.click(getByRole("button", { name: "Remove two" }));
    await frames();
    expect(box.scrollTop).toBe(before);
    // Three has moved up into Two's place, past the line.
    expect(getByRole("link", { name: "Three" })).toBeTruthy();
    expect(document.getElementById("d-two")).toBe(null);
    expect(active()).toBe("Three");
  });

  test("a heading that gets its id later is followed from then, without a scroll", async () => {
    const { getByRole, getByTestId, user } = mount(dynamic);
    const box = getByTestId("box");
    const late = getByTestId("late");
    box.scrollTo({
      top: late.getBoundingClientRect().top - box.getBoundingClientRect().top + 5,
      behavior: "instant",
    });
    await frames();
    expect(active()).toBe("Two");
    await user.click(getByRole("button", { name: "Name late heading" }));
    await frames();
    expect(active()).toBe("Late");
  });
});
