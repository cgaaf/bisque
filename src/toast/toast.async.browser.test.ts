// Toasts that follow requests, used as an app would against a slow server (fixtures/async.rx): a promise toast in
// a plain handler and awaited in an action, a failure and its retry, answers that arrive out of order, and a toast
// whose own content loads. The fake server holds every answer until the test releases it.
import { beforeEach, expect, test } from "vitest";
import { within } from "@testing-library/dom";
import { mount } from "../test/browser.ts";
import { answered, held, release, resetServer, server, waiting } from "../test/slow-server.ts";
import slow from "./fixtures/async.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const toasts = () =>
  [...document.querySelectorAll<HTMLElement>("[data-bisque-toast]")].filter(
    (el) => !el.hasAttribute("data-ending-style"),
  );
const shown = () =>
  toasts().map((el) => `${el.getAttribute("data-type")}: ${el.textContent?.replace("Dismiss", "").trim()}`);

test("a promise toast awaited in an action shows its loading state while the action waits", async () => {
  const { getByRole, getByTestId, user } = mount(slow);
  await user.click(getByRole("button", { name: "Save draft" }));
  expect(waiting()).toEqual(["draft"]);
  expect(shown()).toEqual(["loading: Saving…"]);
  release("draft");
  await answered();
  expect(shown()).toEqual(["success: Saved"]);
  expect(getByTestId("saved").textContent).toBe("draft");
});

test("a promise toast awaited in an action turns into an error when the request fails", async () => {
  const { getByRole, getByTestId, user } = mount(slow);
  server.failing = ["draft"];
  await user.click(getByRole("button", { name: "Save draft" }));
  expect(shown()).toEqual(["loading: Saving…"]);
  release("draft");
  await answered();
  expect(shown()).toEqual(["error: Could not save"]);
  expect(getByTestId("save-error").textContent).toBe("Request failed: draft");
});

test("two requests whose answers arrive out of order: each toast ends in its own outcome", async () => {
  const { getByRole, user } = mount(slow);
  server.failing = ["b"];
  await user.click(getByRole("button", { name: "Send a" }));
  await user.click(getByRole("button", { name: "Send b" }));
  // Newest first.
  expect(shown()).toEqual(["loading: Sending b…", "loading: Sending a…"]);
  release("b");
  await answered();
  expect(shown()).toEqual(["error: Could not send b", "loading: Sending a…"]);
  release("a");
  await answered();
  expect(shown()).toEqual(["error: Could not send b", "success: Sent a"]);
});

test("a failed request's toast retries from its action button, and the same toast follows the retry", async () => {
  const { getByRole, user } = mount(slow);
  server.failing = ["upload"];
  await user.click(getByRole("button", { name: "Upload" }));
  expect(shown()).toEqual(["loading: Uploading…"]);
  release("upload");
  await answered();
  expect(shown()).toEqual(["error: Upload failedRetry"]);
  const toast = toasts()[0];
  await user.click(within(toast).getByRole("button", { name: "Retry" }));
  // Back to loading, in the same element, without its Retry button.
  expect(toasts()).toEqual([toast]);
  expect(shown()).toEqual(["loading: Uploading…"]);
  server.failing = [];
  release("upload");
  await answered();
  expect(toasts()).toEqual([toast]);
  expect(shown()).toEqual(["success: Uploaded"]);
});

test("a toast whose content loads shows its loading state, then the content; a failure retries in place", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(slow);
  server.failing = ["report"];
  await user.click(getByRole("button", { name: "Show report" }));
  expect(toasts()).toHaveLength(1);
  expect(getByTestId("detail-loading").textContent).toBe("Loading…");
  await held();
  release("report");
  await answered();
  expect(getByTestId("detail-error").textContent).toBe("Request failed: report");
  server.failing = [];
  await user.click(getByRole("button", { name: "Retry detail" }));
  release("report");
  await answered();
  expect(queryByTestId("detail-error")).toBeNull();
  expect(getByTestId("detail").textContent).toBe("Details of report");
  expect(toasts()).toHaveLength(1);
});

test("an onClose that awaits a request doesn't hold the toast's exit", async () => {
  const { getByRole, getByTestId, user } = mount(slow);
  await user.click(getByRole("button", { name: "Show notice" }));
  const toast = toasts()[0];
  await user.click(within(toast).getByText("Dismiss"));
  expect(waiting()).toEqual(["read"]);
  await expect.poll(() => toast.isConnected).toBe(false);
  release("read");
  await answered();
  expect(getByTestId("read").textContent).toBe("read");
});
