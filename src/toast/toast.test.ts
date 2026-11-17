// The toast logic that needs no browser: the manager, the provider's records and the pausable timer. Everything
// rendered (the viewport, focus, swipe, measuring, exit animation) is in toast.browser.test.ts.
import { afterEach, expect, test, vi } from "vitest";
import { createRoot, createSignal, flush } from "solid-js";
import {
  createPausableTimeout,
  createToastManager,
  newToastRecord,
  notifyToasts,
  placeToasts,
  swipeDirections,
  updatedToastRecord,
  type ToastListener,
  type ToastRecord,
} from "../internal/impl/toast.ts";

afterEach(() => {
  vi.useRealTimers();
});

function listen() {
  const manager = createToastManager();
  const calls: unknown[][] = [];
  const listener: ToastListener = {
    add: (options) => calls.push(["add", options]),
    update: (id, updates) => calls.push(["update", id, updates]),
    close: (id) => calls.push(["close", id]),
  };
  const unsubscribe = manager.subscribe(listener);
  return { manager, calls, unsubscribe };
}

test("the manager hands every call to its listeners, and gives each toast an id", () => {
  const { manager, calls, unsubscribe } = listen();
  const id = manager.add({ title: "One" });
  expect(id).toMatch(/^rs-ui-toast-\d+$/);
  expect(manager.add({ id: "mine", title: "Two" })).toBe("mine");
  manager.update(id, { title: "Changed" });
  manager.close(id);
  manager.close();
  expect(calls).toEqual([
    ["add", { title: "One", id }],
    ["add", { id: "mine", title: "Two" }],
    ["update", id, { title: "Changed" }],
    ["close", id],
    ["close", undefined],
  ]);
  unsubscribe();
  manager.add({ title: "Unheard" });
  expect(calls).toHaveLength(5);
});

test("a promise toast is loading, then success or error, and the promise still settles", async () => {
  const { manager, calls } = listen();
  const { promise, resolve } = Promise.withResolvers<string>();
  const result = manager.promise(promise, {
    loading: "Saving…",
    success: (value: string) => ({ title: "Saved", description: value }),
    error: "Failed",
  });
  const id = (calls[0][1] as { id: string }).id;
  expect(calls[0]).toEqual(["add", { description: "Saving…", type: "loading", id }]);
  resolve("report.pdf");
  await expect(result).resolves.toBe("report.pdf");
  expect(calls[1]).toEqual(["update", id, { title: "Saved", description: "report.pdf", type: "success" }]);

  const failing = manager.promise(Promise.reject(new Error("nope")), {
    loading: "Trying",
    success: "Done",
    error: "Failed",
  });
  await expect(failing).rejects.toThrow("nope");
  expect(calls[3][2]).toEqual({ description: "Failed", type: "error" });
});

test("an update restarts the timer only when it changes the timeout or is told to", () => {
  const record = newToastRecord({ id: "a", title: "Saving", type: "loading" });
  expect(record).toMatchObject({ id: "a", closing: false, height: 0, timerKey: 0 });
  expect(updatedToastRecord(record, { title: "Saved" }, false).timerKey).toBe(0);
  expect(updatedToastRecord(record, { title: "Saved" }, true).timerKey).toBe(1);
  expect(updatedToastRecord(record, { timeout: 100 }, false).timerKey).toBe(1);
  // What the provider keeps for itself can't be overwritten.
  const updated = updatedToastRecord(record, { id: "b", closing: true, title: "New" } as never, false);
  expect(updated).toMatchObject({ id: "a", closing: false, title: "New" });
  expect(updatedToastRecord(record, (previous) => ({ title: `${previous.title}!` }), false).title).toBe(
    "Saving!",
  );
});

const placedRecord = (id: string, height: number, closing = false): ToastRecord => ({
  ...newToastRecord({ id }),
  height,
  closing,
});

test("placing toasts: index, visible index, offset and the limit", () => {
  const placed = placeToasts(
    [placedRecord("a", 40), placedRecord("b", 0, true), placedRecord("c", 30), placedRecord("d", 20)],
    2,
  );
  expect(placed.map((t) => [t.id, t.index, t.visibleIndex, t.offsetY, t.limited])).toEqual([
    ["a", 0, 0, 0, false],
    ["b", 1, -1, 40, false],
    ["c", 2, 1, 40, false],
    ["d", 3, 2, 70, true],
  ]);
});

test("onClose skips toasts already closing; onRemove doesn't", () => {
  const calls: string[] = [];
  const make = (id: string, closing: boolean): ToastRecord => ({
    ...newToastRecord({
      id,
      onClose: () => calls.push(`close ${id}`),
      onRemove: () => calls.push(`remove ${id}`),
    }),
    closing,
  });
  const records = [make("a", false), make("b", true)];
  notifyToasts(records, undefined, "onClose");
  notifyToasts(records, "b", "onRemove");
  expect(calls).toEqual(["close a", "remove b"]);
});

test("swipeDirection as a list", () => {
  expect(swipeDirections(undefined, ["down", "right"])).toEqual(["down", "right"]);
  expect(swipeDirections("up", ["down"])).toEqual(["up"]);
  expect(swipeDirections([], ["down"])).toEqual([]);
});

test("the pausable timeout keeps the time left across a pause and restarts on a new key", () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  let elapsed = 0;
  const [paused, setPaused] = createSignal(false);
  const [key, setKey] = createSignal(0);
  const dispose = createRoot((disposeRoot) => {
    createPausableTimeout(
      () => true,
      paused,
      () => 1000,
      key,
      () => (elapsed += 1),
    );
    return disposeRoot;
  });
  flush();
  vi.advanceTimersByTime(600);
  setPaused(true);
  flush();
  vi.advanceTimersByTime(5000);
  expect(elapsed).toBe(0);
  setPaused(false);
  flush();
  vi.advanceTimersByTime(399);
  expect(elapsed).toBe(0);
  vi.advanceTimersByTime(1);
  expect(elapsed).toBe(1);

  setKey(1);
  flush();
  vi.advanceTimersByTime(999);
  expect(elapsed).toBe(1);
  vi.advanceTimersByTime(1);
  expect(elapsed).toBe(2);
  dispose();
});
