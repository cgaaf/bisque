// Apps that upload each file as soon as it is chosen, to a slow and sometimes failing server (fixtures/async.rx).
// The family only hands over File objects; what is tested is that the list stays live while uploads are out: more
// files can be chosen, a file can be removed while its upload waits, and a failure leaves the list usable.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import fixture from "./fixtures/async.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const png = (name: string) => new File([new Uint8Array(4)], name, { type: "image/png" });
const names = (input: HTMLInputElement) => [...(input.files ?? [])].map((file) => file.name);
/** Each row's file name and upload state, "name:state". */
const rows = (list: HTMLElement) =>
  [...list.querySelectorAll("li")].map(
    (row) => `${row.querySelector("span")!.textContent}:${row.querySelector("output")!.textContent}`,
  );

for (const [which, label, key] of [
  ["uncontrolled", "Uploads", (name: string) => name],
  ["controlled", "Chosen", (name: string) => `chosen-${name}`],
] as const) {
  const id = label.toLowerCase();

  test(`${which}: choosing more files while uploads are out adds them at once`, async () => {
    const { getByLabelText, getByTestId, user } = mount(fixture);
    const input = getByLabelText(label) as HTMLInputElement;
    await user.upload(input, png("a.png"));
    await answered();
    expect(rows(getByTestId(id))).toEqual(["a.png:uploading"]);
    await user.upload(input, [png("b.png"), png("c.png")]);
    await answered();
    expect(rows(getByTestId(id))).toEqual(["a.png:uploading", "b.png:uploading", "c.png:uploading"]);
    expect(names(input)).toEqual(["a.png", "b.png", "c.png"]);
    expect(waiting()).toEqual([key("a.png"), key("b.png"), key("c.png")]);
    release(key("b.png"));
    await answered();
    expect(rows(getByTestId(id))).toEqual(["a.png:uploading", "b.png:done", "c.png:uploading"]);
  });

  test(`${which}: a file can be removed while its upload waits, and its answer doesn't bring it back`, async () => {
    const { getByLabelText, getByRole, getByTestId, user } = mount(fixture);
    const input = getByLabelText(label) as HTMLInputElement;
    await user.upload(input, [png("a.png"), png("b.png")]);
    await answered();
    await user.click(getByRole("button", { name: "Remove a.png" }));
    await answered();
    expect(rows(getByTestId(id))).toEqual(["b.png:uploading"]);
    expect(names(input)).toEqual(["b.png"]);
    // Four changes in a row while both uploads wait.
    await user.upload(input, png("c.png"));
    await user.click(getByRole("button", { name: "Remove b.png" }));
    await user.upload(input, png("d.png"));
    await answered();
    expect(rows(getByTestId(id)).map((row) => row.split(":")[0])).toEqual(["c.png", "d.png"]);
    release(key("a.png"));
    await answered();
    expect(rows(getByTestId(id)).map((row) => row.split(":")[0])).toEqual(["c.png", "d.png"]);
    expect(names(input)).toEqual(["c.png", "d.png"]);
  });

  test(`${which}: a failed upload leaves the list usable`, async () => {
    const { getByLabelText, getByRole, getByTestId, user } = mount(fixture);
    const input = getByLabelText(label) as HTMLInputElement;
    server.failing = [key("a.png")];
    await user.upload(input, png("a.png"));
    await answered();
    release(key("a.png"));
    await answered();
    expect(rows(getByTestId(id))).toEqual(["a.png:failed"]);
    await user.upload(input, png("b.png"));
    await answered();
    expect(rows(getByTestId(id))).toEqual(["a.png:failed", "b.png:uploading"]);
    await user.click(getByRole("button", { name: "Remove a.png" }));
    await answered();
    expect(rows(getByTestId(id))).toEqual(["b.png:uploading"]);
  });
}

test("a handler that awaits its request doesn't hold the list: picks and removals show while it waits", async () => {
  const { getByLabelText, getByRole, getByTestId, user } = mount(fixture);
  const input = getByLabelText("Batch") as HTMLInputElement;
  const list = () => rows(getByTestId("batch")).map((row) => row.split(":")[0]);
  await user.upload(input, [png("a.png"), png("b.png")]);
  await answered();
  expect(list()).toEqual(["a.png", "b.png"]);
  expect(waiting()).toEqual(["batch-2"]);
  await user.click(getByRole("button", { name: "Remove a.png" }));
  await answered();
  expect(list()).toEqual(["b.png"]);
  await user.upload(input, png("c.png"));
  await answered();
  await user.click(getByRole("button", { name: "Remove b.png" }));
  await answered();
  expect(list()).toEqual(["c.png"]);
  expect(names(input)).toEqual(["c.png"]);
  expect(waiting()).toEqual(["batch-2", "batch-1", "batch-2", "batch-1"]);
  for (const key of ["batch-2", "batch-1", "batch-2", "batch-1"]) release(key);
  await answered();
  expect(list()).toEqual(["c.png"]);
  expect(getByTestId("batch-state").textContent).toBe("saved 1");
});
