// A popover opened and closed twice from the keyboard (fixtures/twice.rx). With a controlled `open` this used to
// report UNSTABLE_MEMO_OUTPUT from PopoverPopup in all three engines: its props read the context directly, and the
// context is rebuilt on every open and close. The test setup fails a test that reports a Solid diagnostic.
import { expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import twice from "./fixtures/twice.rx";

/** Opens and closes the popover twice from the keyboard; returns how many times it closed. */
async function twiceOpen(name: string, testId: string): Promise<number> {
  const { getByRole, getByTestId, user } = mount(twice);
  const trigger = getByRole("button", { name });
  const panel = getByTestId(testId);
  let closed = 0;
  for (let i = 0; i < 2; i++) {
    trigger.focus();
    // oxlint-disable-next-line no-await-in-loop -- each step acts on what the one before left
    await user.keyboard("{Enter}");
    // oxlint-disable-next-line no-await-in-loop
    await expect.poll(() => panel.matches(":popover-open")).toBe(true);
    // oxlint-disable-next-line no-await-in-loop
    await user.keyboard("{Escape}");
    // oxlint-disable-next-line no-await-in-loop
    await expect.poll(() => panel.matches(":popover-open")).toBe(false);
    closed += 1;
  }
  return closed;
}

test("controlled popover opened and closed twice", async () => {
  expect(await twiceOpen("Toggle", "panel")).toBe(2);
});

test("uncontrolled popover that reports its state, opened and closed twice", async () => {
  expect(await twiceOpen("Reported", "reported")).toBe(2);
});
