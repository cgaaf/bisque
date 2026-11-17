// A scroll area whose content comes from a server (fixtures/async.rx): the scrollbars follow the content when the
// answer lands.
import { beforeEach, expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import { answered, put, releaseLoads, resetServer, server } from "../test/settings-server.ts";
import fixture from "./fixtures/async.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

test("overflow appears when the content loads", async () => {
  server.holdLoads = true;
  put(
    "rows",
    Array.from({ length: 20 }, (_, i) => `Row ${i + 1}`),
  );
  const { getByTestId } = mount(fixture);
  await frame();
  const root = getByTestId("root");
  expect(root.hasAttribute("data-has-overflow-y")).toBe(false);
  releaseLoads();
  await answered();
  await frame();
  await frame();
  expect(root.hasAttribute("data-has-overflow-y")).toBe(true);
  expect(getByTestId("viewport").scrollHeight).toBeGreaterThan(300);
});
