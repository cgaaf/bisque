// A meter whose value comes from a server (fixtures/async.rx): the value is asked again, and the request fails. A
// failing value is the app's to show, in its `errored` region; the rest of the page goes on working.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, put, releaseLoads, resetServer, server } from "../test/settings-server.ts";
import fixture from "./fixtures/async.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

async function setup() {
  const mounted = mount(fixture);
  await answered();
  return { ...mounted, text: (id: string) => mounted.getByTestId(id).textContent };
}

test("shows the answer, and keeps it while a new one is on its way", async () => {
  const { getByRole, getByTestId, text, user } = await setup();
  const meter = getByRole("meter", { name: "Storage" });
  expect(meter.getAttribute("aria-valuenow")).toBe("40");
  expect(text("value")).toBe("40%");
  put("level", 70);
  server.holdLoads = true;
  await user.click(getByRole("button", { name: "Reload" }));
  expect(meter.getAttribute("aria-valuenow")).toBe("40");
  releaseLoads();
  await answered();
  expect(meter.getAttribute("aria-valuenow")).toBe("70");
  expect(getByTestId("indicator").style.width).toBe("70%");
});

test("a value that fails shows in the app's errored region, and the page stays live", async () => {
  const { getByRole, getByTestId, queryByRole, text, user } = await setup();
  server.failingLoads = ["level"];
  await user.click(getByRole("button", { name: "Reload" }));
  await answered();
  expect(getByTestId("error").textContent).toContain("Couldn't load level");
  expect(queryByRole("meter")).toBeNull();
  await user.click(getByRole("button", { name: "Count" }));
  expect(text("clicks")).toBe("1");
  server.failingLoads = [];
  put("level", 55);
  await user.click(getByRole("button", { name: "Retry" }));
  await answered();
  expect(getByRole("meter", { name: "Storage" }).getAttribute("aria-valuenow")).toBe("55");
});
