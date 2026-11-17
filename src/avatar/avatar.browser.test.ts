// Avatars in a list that comes from a server (fixtures/people.rx), in real browsers: pictures that load and fail,
// rows that a new answer removes or replaces.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, resetServer, server } from "../test/slow-server.ts";
import people from "./fixtures/people.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
  server.lists = { team: ["ok-ana", "broken-bo", "none-cy"], other: ["ok-di"] };
});

const avatar = (container: HTMLElement, name: string) =>
  container.querySelector<HTMLElement>(`[data-testid="avatar-${name}"]`);

test("a picture that loads replaces the fallback; a broken or missing one keeps it", async () => {
  const { container } = mount(people);
  release("team");
  await answered();
  await expect.poll(() => avatar(container, "ok-ana")?.querySelector("img")).not.toBeNull();
  expect(avatar(container, "ok-ana")!.textContent).toBe("");
  await answered();
  expect(avatar(container, "broken-bo")!.querySelector("img")).toBeNull();
  expect(avatar(container, "broken-bo")!.textContent).toBe("br");
  expect(avatar(container, "none-cy")!.textContent).toBe("no");
});

test("a new answer that removes the rows removes their avatars without an error", async () => {
  const { container, getByRole, queryByTestId, user } = mount(people);
  release("team");
  await answered();
  await expect.poll(() => avatar(container, "ok-ana")?.querySelector("img")).not.toBeNull();
  await user.click(getByRole("button", { name: "Other group" }));
  release("other");
  await answered();
  expect(queryByTestId("error")).toBeNull();
  expect(avatar(container, "ok-ana")).toBeNull();
  await expect.poll(() => avatar(container, "ok-di")?.querySelector("img")).not.toBeNull();
  // The same rows again, as new objects: the avatars are kept or rebuilt, never an error.
  await user.click(getByRole("button", { name: "Reload" }));
  release("other");
  await answered();
  expect(queryByTestId("error")).toBeNull();
  await expect.poll(() => avatar(container, "ok-di")?.querySelector("img")).not.toBeNull();
});

test("a new picture is loaded before it replaces the old one, and its status is reported", async () => {
  const { container, getByRole, getByTestId, user } = mount(people);
  release("team");
  await answered();
  await expect.poll(() => avatar(container, "ok-ana")?.querySelector("img")).not.toBeNull();
  await user.click(getByRole("button", { name: "New pictures" }));
  await expect
    .poll(() => avatar(container, "ok-ana")?.querySelector("img")?.getAttribute("src"))
    .toContain("ok-ana 2");
  expect(getByTestId("statuses").textContent).toContain("loading,loaded");
});
