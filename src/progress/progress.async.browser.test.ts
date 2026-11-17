// A progress bar whose value comes from a server (fixtures/async.rx): indeterminate until the first answer, asked
// again, and failing. A failing value is the app's to show, in its `errored` region; the page goes on working.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, put, releaseLoads, resetServer, server } from "../test/settings-server.ts";
import fixture from "./fixtures/async.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

test("indeterminate until the first answer, then the answer, kept while a new one is on its way", async () => {
  server.holdLoads = true;
  const { getByRole, getByTestId, user } = mount(fixture);
  const bar = getByRole("progressbar", { name: "Upload" });
  expect(bar.hasAttribute("data-indeterminate")).toBe(true);
  expect(bar.hasAttribute("aria-valuenow")).toBe(false);
  releaseLoads();
  await answered();
  expect(bar.hasAttribute("data-progressing")).toBe(true);
  expect(bar.getAttribute("aria-valuenow")).toBe("40");
  put("done", 100);
  await user.click(getByRole("button", { name: "Reload" }));
  expect(bar.getAttribute("aria-valuenow")).toBe("40");
  releaseLoads();
  await answered();
  expect(bar.hasAttribute("data-complete")).toBe(true);
  expect(getByTestId("value").textContent).toBe("100%");
});

test("a value that fails shows in the app's errored region, and the page stays live", async () => {
  const { getByRole, getByTestId, queryByRole, user } = mount(fixture);
  await answered();
  server.failingLoads = ["done"];
  await user.click(getByRole("button", { name: "Reload" }));
  await answered();
  expect(getByTestId("error").textContent).toContain("Couldn't load done");
  expect(queryByRole("progressbar")).toBeNull();
  await user.click(getByRole("button", { name: "Count" }));
  expect(getByTestId("clicks").textContent).toBe("1");
  server.failingLoads = [];
  await user.click(getByRole("button", { name: "Retry" }));
  await answered();
  expect(getByRole("progressbar", { name: "Upload" }).getAttribute("aria-valuenow")).toBe("40");
});
