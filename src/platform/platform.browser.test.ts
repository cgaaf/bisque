// The native behaviour the components are built on, checked in each engine. If one of these fails after a
// browser upgrade, the design assumption behind it needs another look (`pnpm baseline`).
import { afterEach, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

function render(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.append(host);
  return host;
}

afterEach(() => {
  document.body.replaceChildren();
});

test("a popover opens from popovertarget and closes on Escape and on a press outside", async () => {
  const host = render(
    `<button id="t" popovertarget="p">Open</button><div id="p" popover>Content</div><p id="out">Outside</p>`,
  );
  const popup = host.querySelector<HTMLElement>("#p")!;
  await userEvent.click(host.querySelector("#t")!);
  expect(popup.matches(":popover-open")).toBe(true);
  await userEvent.keyboard("{Escape}");
  expect(popup.matches(":popover-open")).toBe(false);

  await userEvent.click(host.querySelector("#t")!);
  expect(popup.matches(":popover-open")).toBe(true);
  await userEvent.click(host.querySelector("#out")!);
  expect(popup.matches(":popover-open")).toBe(false);
});

test("a popover reports its state through beforetoggle and toggle", async () => {
  const host = render(`<div id="p" popover>Content</div>`);
  const popup = host.querySelector<HTMLElement>("#p")!;
  const seen: string[] = [];
  popup.addEventListener("beforetoggle", (event) => seen.push(`before:${(event as ToggleEvent).newState}`));
  popup.addEventListener("toggle", (event) => seen.push(`after:${(event as ToggleEvent).newState}`));
  popup.showPopover();
  await frame();
  await frame();
  expect(seen).toEqual(["before:open", "after:open"]);
});

test("a popover is anchored to the button that invoked it, with no JavaScript", async () => {
  const host = render(`
    <style>
      #p { position-area: bottom span-right; margin: 4px 0 0; inset: auto; }
    </style>
    <button id="t" popovertarget="p" style="margin: 100px 0 0 150px">Open</button>
    <div id="p" popover style="width: 80px; height: 40px">Content</div>`);
  const trigger = host.querySelector<HTMLElement>("#t")!;
  const popup = host.querySelector<HTMLElement>("#p")!;
  await userEvent.click(trigger);
  await frame();
  const anchor = trigger.getBoundingClientRect();
  const placed = popup.getBoundingClientRect();
  expect(Math.round(placed.top - anchor.bottom)).toBe(4);
  expect(Math.round(placed.left - anchor.left)).toBe(0);
});

test("an anchored popover flips to the other side when there is no room", async () => {
  const host = render(`
    <style>
      #p { position-area: bottom; position-try-fallbacks: flip-block; inset: auto; margin: 0; }
    </style>
    <button id="t" popovertarget="p" style="position: fixed; bottom: 4px; left: 100px">Open</button>
    <div id="p" popover style="width: 80px; height: 120px">Content</div>`);
  const trigger = host.querySelector<HTMLElement>("#t")!;
  const popup = host.querySelector<HTMLElement>("#p")!;
  await userEvent.click(trigger);
  await frame();
  expect(popup.getBoundingClientRect().bottom).toBeLessThanOrEqual(trigger.getBoundingClientRect().top + 1);
});

test("a modal dialog contains focus, closes on Escape and returns focus", async () => {
  const host = render(
    `<button id="t">Open</button><dialog id="d"><button id="a">A</button><button id="b">B</button></dialog>`,
  );
  const trigger = host.querySelector<HTMLElement>("#t")!;
  const dialog = host.querySelector<HTMLDialogElement>("#d")!;
  trigger.focus();
  dialog.showModal();
  expect(document.activeElement?.id).toBe("a");
  expect(dialog.matches(":modal")).toBe(true);
  let cancelled = false;
  dialog.addEventListener("cancel", () => {
    cancelled = true;
  });
  await userEvent.keyboard("{Escape}");
  expect(cancelled).toBe(true);
  expect(dialog.open).toBe(false);
  expect(document.activeElement).toBe(trigger);
});

test("details with one name keep a single one open", async () => {
  const host = render(`
    <details name="g" id="one" open><summary>One</summary>1</details>
    <details name="g" id="two"><summary>Two</summary>2</details>`);
  const one = host.querySelector<HTMLDetailsElement>("#one")!;
  const two = host.querySelector<HTMLDetailsElement>("#two")!;
  await userEvent.click(two.querySelector("summary")!);
  expect(two.open).toBe(true);
  expect(one.open).toBe(false);
});

test("a command button opens and closes a dialog", async () => {
  const host = render(`
    <button id="open" commandfor="d" command="show-modal">Open</button>
    <dialog id="d"><button id="close" commandfor="d" command="close">Close</button></dialog>`);
  const dialog = host.querySelector<HTMLDialogElement>("#d")!;
  await userEvent.click(host.querySelector("#open")!);
  expect(dialog.open).toBe(true);
  await userEvent.click(host.querySelector("#close")!);
  expect(dialog.open).toBe(false);
});

test("native radios that share a name move and select with the arrow keys", async () => {
  const host = render(`
    <input type="radio" name="r" id="a" checked><input type="radio" name="r" id="b"><input type="radio" name="r" id="c">`);
  host.querySelector<HTMLElement>("#a")!.focus();
  await userEvent.keyboard("{ArrowDown}");
  expect(document.activeElement?.id).toBe("b");
  expect(host.querySelector<HTMLInputElement>("#b")!.checked).toBe(true);
});
