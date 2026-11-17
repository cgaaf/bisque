import { expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import arrows from "./fixtures/arrow.rx";

const centre = (element: Element) => {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};

async function openPopover(name: string, arrowId: string) {
  const mounted = mount(arrows);
  const trigger = mounted.getByRole("button", { name });
  const arrow = mounted.getByTestId(arrowId);
  const popup = arrow.parentElement!;
  expect(popup.getAttribute("data-side")).toBe(name === "Beside" ? "right" : "bottom");
  trigger.focus();
  await mounted.user.keyboard("{Enter}");
  await frame();
  await frame();
  return { ...mounted, trigger, arrow, popup };
}

test("data-side is the side asked for when the popup fits there, and the arrow sits on the facing edge", async () => {
  const { trigger, arrow, popup } = await openPopover("Below", "below-arrow");
  await expect.poll(() => arrow.getAttribute("data-side")).toBe("bottom");
  expect(popup.getAttribute("data-side")).toBe("bottom");
  expect(arrow.getAttribute("aria-hidden")).toBe("true");
  // Centred on the trigger, not on the wider popup, and on the popup's top edge.
  expect(Math.abs(centre(arrow).x - centre(trigger).x)).toBeLessThanOrEqual(1);
  expect(Math.abs(centre(arrow).y - popup.getBoundingClientRect().top)).toBeLessThanOrEqual(1);
});

test("data-side follows the browser's flip, and the arrow moves to the popup's other edge", async () => {
  const { trigger, arrow, popup } = await openPopover("Low", "flipped-arrow");
  await expect.poll(() => popup.getAttribute("data-side")).toBe("top");
  expect(arrow.getAttribute("data-side")).toBe("top");
  expect(popup.getBoundingClientRect().bottom).toBeLessThanOrEqual(trigger.getBoundingClientRect().top);
  expect(Math.abs(centre(arrow).x - centre(trigger).x)).toBeLessThanOrEqual(1);
  expect(Math.abs(centre(arrow).y - popup.getBoundingClientRect().bottom)).toBeLessThanOrEqual(1);
});

test("on an inline side the arrow is on the popup's near edge, level with the trigger", async () => {
  const { trigger, arrow, popup } = await openPopover("Beside", "beside-arrow");
  await expect.poll(() => arrow.getAttribute("data-side")).toBe("right");
  expect(Math.abs(centre(arrow).x - popup.getBoundingClientRect().left)).toBeLessThanOrEqual(1);
  expect(Math.abs(centre(arrow).y - centre(trigger).y)).toBeLessThanOrEqual(1);
});

test("closing puts data-side back to the side asked for", async () => {
  const { popup, user } = await openPopover("Low", "flipped-arrow");
  await expect.poll(() => popup.getAttribute("data-side")).toBe("top");
  await user.keyboard("{Escape}");
  await expect.poll(() => popup.getAttribute("data-side")).toBe("bottom");
});

test("data-side and the arrow follow a flip that scrolling causes while the popup is open", async () => {
  const mounted = mount(arrows);
  const trigger = mounted.getByRole("button", { name: "Scrolled" });
  const arrow = mounted.getByTestId("scrolled-arrow");
  const popup = arrow.parentElement!;
  const pageTop = trigger.getBoundingClientRect().top + window.scrollY;
  try {
    // The trigger at the top of the viewport: the popup fits below it.
    window.scrollTo(0, pageTop - 10);
    trigger.focus({ preventScroll: true });
    await mounted.user.keyboard("{Enter}");
    await expect.poll(() => popup.getAttribute("data-side")).toBe("bottom");
    expect(Math.abs(centre(arrow).y - popup.getBoundingClientRect().top)).toBeLessThanOrEqual(1);

    // The trigger at the bottom of the viewport: no room below it any more.
    window.scrollTo(0, pageTop + trigger.offsetHeight + 10 - window.innerHeight);
    await expect.poll(() => popup.getAttribute("data-side")).toBe("top");
    await expect.poll(() => arrow.getAttribute("data-side")).toBe("top");
    expect(Math.abs(centre(arrow).y - popup.getBoundingClientRect().bottom)).toBeLessThanOrEqual(1);
    expect(Math.abs(centre(arrow).x - centre(trigger).x)).toBeLessThanOrEqual(1);
  } finally {
    window.scrollTo(0, 0);
  }
});
