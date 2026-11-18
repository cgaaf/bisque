// Calendars beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a plain
// write, and props of the calendars are computed from it: the selected day, focus moves, page turns and a range
// under way must still follow the user while the request is out.
import { beforeEach, expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const dayIn = (root: HTMLElement, iso: string) =>
  root.querySelector<HTMLButtonElement>(`button[data-date="${iso}"]:not([data-outside-month])`)!;

test("a day is selected by a press and the keyboard, and the page turns, while an app action holds its props", async () => {
  const { getByRole, getByTestId, user } = mount(held);
  const root = getByTestId("day");
  await user.click(getByRole("button", { name: "Next" }));
  expect(waiting()).toEqual(["step"]);
  expect(getByTestId("step").textContent).toBe("1");
  await user.click(dayIn(root, "2030-05-20"));
  await answered();
  expect(dayIn(root, "2030-05-20").hasAttribute("data-selected")).toBe(true);
  expect(getByTestId("day-value").textContent).toBe("2030-05-20");
  dayIn(root, "2030-05-20").focus();
  await user.keyboard("{ArrowRight}{ArrowRight}{ArrowDown}{Enter}");
  expect(document.activeElement).toBe(dayIn(root, "2030-05-29"));
  expect(getByTestId("day-value").textContent).toBe("2030-05-29");
  await user.keyboard("{PageDown}");
  await frame();
  expect(getByTestId("day-label").textContent).toBe("June 2030");
  expect(document.activeElement).toBe(dayIn(root, "2030-06-29"));
  await user.click(getByRole("button", { name: "Next month" }));
  expect(getByTestId("day-label").textContent).toBe("July 2030");
  expect(getByTestId("step").textContent).toBe("1");
  release("step");
  await answered();
  expect(getByTestId("step").textContent).toBe("2");
  expect(getByTestId("day-label").textContent).toBe("July 2030");
  expect(getByTestId("day-value").textContent).toBe("2030-05-29");
});

test("a range is anchored, previewed and completed while an app action holds its props", async () => {
  const { getByRole, getByTestId, user } = mount(held);
  const root = getByTestId("range");
  await user.click(getByRole("button", { name: "Next" }));
  expect(waiting()).toEqual(["step"]);
  dayIn(root, "2030-05-15").focus();
  await user.keyboard("{Enter}");
  expect(getByTestId("range-value").textContent).toBe("pending");
  await user.keyboard("{ArrowRight}{ArrowRight}");
  expect(dayIn(root, "2030-05-16").hasAttribute("data-range-preview")).toBe(true);
  await user.keyboard("{Enter}");
  expect(getByTestId("range-value").textContent).toBe("2030-05-15");
  expect(dayIn(root, "2030-05-17").hasAttribute("data-range-end")).toBe(true);
  expect(getByTestId("step").textContent).toBe("1");
  release("step");
  await answered();
  expect(dayIn(root, "2030-05-16").hasAttribute("data-range-middle")).toBe(true);
});
