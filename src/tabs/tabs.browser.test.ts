import { OBSERVE } from "solid-js";
import { attribution } from "solid-js/attribution";
import { expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import indicatorFixture from "./fixtures/indicator.rx";

/**
 * The EFFECT_RELAY_TEAR reports about signals of `primitive` while `run` runs. Solid checks for an effect that
 * relays a change into a signal only while its attribution engine is on, which Vitest doesn't do, and reports the
 * first two sightings at `info`, on the structured channel only: the console, and so `src/test/browser-setup.ts`,
 * would see the third.
 */
async function relayTears(primitive: string, run: () => Promise<void>): Promise<string[]> {
  // OBSERVE exists in Solid's dev and observe builds, which are what tests run on.
  const capture = OBSERVE!.diagnostics.capture();
  const release = attribution.enable({ log: false });
  try {
    await run();
  } finally {
    release();
  }
  type Diagnostic = { code: string; message: string; data?: { wrote?: string } };
  return (capture.stop() as Diagnostic[])
    .filter((event) => event.code === "EFFECT_RELAY_TEAR" && event.data?.wrote?.startsWith(`${primitive}.`))
    .map((event) => event.message);
}

// The fixture has panels: `createPresence`, which TabsPanel uses, must not relay its status through an effect
// either (src/test/browser-setup.ts fails the test on any diagnostic).
test("the indicator follows the selected tab without relaying the change through an effect", async () => {
  const tears = await relayTears("createSelectedTab", async () => {
    const { getByRole, getByTestId, user } = mount(indicatorFixture);
    const indicator = getByTestId("indicator");
    const list = getByTestId("list");
    const box = (tab: HTMLElement) => ({
      left: tab.getBoundingClientRect().left - list.getBoundingClientRect().left - list.clientLeft,
      width: tab.offsetWidth,
    });
    const variables = () => ({
      left: Number.parseFloat(indicator.style.getPropertyValue("--active-tab-left")),
      width: Number.parseFloat(indicator.style.getPropertyValue("--active-tab-width")),
    });

    await frame();
    expect(indicator.hidden).toBe(false);
    expect(variables()).toEqual(box(getByRole("tab", { name: "Overview" })));

    for (const name of ["Account", "Projects", "Overview", "Account"]) {
      // oxlint-disable-next-line no-await-in-loop -- each selection acts on the one before
      await user.click(getByRole("tab", { name }));
      // oxlint-disable-next-line no-await-in-loop
      await frame();
      expect(variables()).toEqual(box(getByRole("tab", { name })));
    }
    expect(getByTestId("root").getAttribute("data-activation-direction")).toBe("right");
  });
  expect(tears).toEqual([]);
});
