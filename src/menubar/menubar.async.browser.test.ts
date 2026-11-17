// A menubar used as an app would against a slow server (fixtures/async.rx): a menu whose items load when it opens,
// and a menu whose `onOpenChange` is an action.
import { beforeEach, expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import { answered, held, release, resetServer, server, waiting } from "../test/slow-server.ts";
import slow from "./fixtures/async.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const shown = (popup: HTMLElement) => popup.matches(":popover-open");
const focused = () => document.activeElement?.textContent;

test("a menu whose items load opens from the keyboard at once, and its first item takes focus when they arrive", async () => {
  const { getByRole, getByTestId, user } = mount(slow);
  const file = getByRole("menuitem", { name: "File" });
  const popup = getByTestId("file-popup");
  file.focus();
  await user.keyboard("{ArrowDown}");
  await expect.poll(() => shown(popup)).toBe(true);
  expect(file.getAttribute("aria-expanded")).toBe("true");
  expect(waiting()).toEqual(["files"]);
  await held();
  release("files");
  await answered();
  await expect.poll(focused).toBe("files one");
});

test("moving to a menu whose onOpenChange awaits opens it at once, and closing it doesn't wait either", async () => {
  const { getByRole, getByTestId, user } = mount(slow);
  const file = getByRole("menuitem", { name: "File" });
  const edit = getByRole("menuitem", { name: "Edit" });
  const filePopup = getByTestId("file-popup");
  const editPopup = getByTestId("edit-popup");
  file.focus();
  await user.keyboard("{ArrowDown}");
  await held();
  release("files");
  await answered();
  await user.keyboard("{ArrowRight}");
  await frame();
  expect(shown(filePopup)).toBe(false);
  expect(shown(editPopup)).toBe(true);
  expect(edit.getAttribute("aria-expanded")).toBe("true");
  await expect.poll(focused).toBe("Undo");
  await user.keyboard("{Escape}");
  await frame();
  expect(shown(editPopup)).toBe(false);
  expect(edit.getAttribute("aria-expanded")).toBe("false");
  expect(waiting()).toEqual(["edit opened", "edit closed"]);
});
