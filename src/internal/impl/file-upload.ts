// The DOM work of the File Upload family (src/file-upload/file-upload.rx): checking chosen files against the
// root's rules, keeping a native <input type="file"> holding exactly the root's list, and a drop zone's drag state.
// `../file-upload.d.rx` declares how `.rx` may call it.
//
// What each engine does, measured (src/file-upload/file-upload.platform.browser.test.ts):
// - `input.files = dataTransfer.files` works in Chromium, Firefox and WebKit, fires no `change` or `input`, and the
//   files then submit with the form; a form reset empties the input.
// - An input without `multiple` keeps (and submits) two files set from script, so a list is cut to one before it is
//   written to such an input.
// - `accept` limits only what the picker offers: a file dropped on the input, or assigned from script, is taken
//   whatever its type. The library checks dropped files itself.
import { createEffect, createSignal, untrack, type Accessor } from "solid-js";

type MaybeInput = HTMLInputElement | undefined;
type MaybeElement = HTMLElement | undefined;

/** Why a file was not taken. A string returned by the root's `validate` is passed through as it is. */
export type FileRejectionReason =
  | "too-large"
  | "too-small"
  | "wrong-type"
  | "too-many"
  | "directory"
  | (string & {});

/** A file that was chosen or dropped and not taken, with every reason it failed. */
export type FileRejection = { file: File; reasons: FileRejectionReason[] };

/** What `validate` returns for a file: a reason or reasons it fails; nothing, "" or [] when it passes. */
export type FileValidateResult = string | string[] | null | undefined;

/** The root's rules for a file. */
export type FileRules = {
  accept: string | undefined;
  multiple: boolean;
  maxFiles: number | undefined;
  maxFileSize: number | undefined;
  minFileSize: number | undefined;
  validate: ((file: File) => FileValidateResult) | undefined;
};

/** The list after a pick or a drop, the files it took, and what was refused. */
export type FileCheck = { files: File[]; added: File[]; rejected: FileRejection[] };

/** What a drop zone shows while something is dragged over it. */
export type DropZoneState = { dragging: boolean; invalid: boolean };

/** What a drop zone needs to judge a drag: whether it takes drops, the root's `accept`, and how many more fit. */
export type DropZoneOptions = { disabled: boolean; accept: string | undefined; room: number };

/**
 * The entries of a drop that are folders. A dropped folder still arrives in `dataTransfer.files`, as a File named
 * after it whose bytes can't be read; only its item's `webkitGetAsEntry()` tells it apart. The zone marks them
 * here and `checkFiles` refuses them as "directory".
 */
const directories = new WeakSet<File>();

type AcceptToken = { kind: "extension" | "mime" | "wildcard"; value: string };

/** The `accept` attribute's tokens, as the HTML spec reads them: extensions, MIME types and `type/*`. */
function acceptTokens(accept: string | undefined): AcceptToken[] {
  if (!accept) return [];
  const tokens: AcceptToken[] = [];
  for (const raw of accept.split(",")) {
    const value = raw.trim().toLowerCase();
    if (value.startsWith(".") && value.length > 1) tokens.push({ kind: "extension", value });
    else if (/^[^/\s]+\/\*$/.test(value)) tokens.push({ kind: "wildcard", value: value.slice(0, -1) });
    else if (/^[^/\s]+\/[^/\s]+$/.test(value)) tokens.push({ kind: "mime", value });
  }
  return tokens;
}

function typeMatches(token: AcceptToken, type: string): boolean {
  if (token.kind === "mime") return type === token.value;
  if (token.kind === "wildcard") return type.startsWith(token.value);
  return false;
}

/** Whether `file` is one `accept` allows: by extension, MIME type or `type/*`. An empty `accept` allows any. */
export function acceptsFile(file: File, accept: string | undefined): boolean {
  const tokens = acceptTokens(accept);
  if (tokens.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return tokens.some((token) =>
    token.kind === "extension" ? name.endsWith(token.value) : typeMatches(token, type),
  );
}

/**
 * Whether a dragged item can be judged unacceptable before it is dropped. During a drag a page sees only each
 * item's kind and MIME type, not its name or size, so only a MIME-typed `accept` can refuse it: an `accept` with an
 * extension in it, or an item whose type the browser doesn't know (""), is given the benefit of the doubt.
 */
function refusesDraggedType(type: string, tokens: AcceptToken[]): boolean {
  if (tokens.length === 0 || type === "") return false;
  if (tokens.some((token) => token.kind === "extension")) return false;
  return !tokens.some((token) => typeMatches(token, type.toLowerCase()));
}

function reasonsFrom(result: FileValidateResult): string[] {
  if (!result) return [];
  return (Array.isArray(result) ? result : [result]).filter((reason) => !!reason);
}

/** How many files the list holds at most: `maxFiles` with `multiple`, one without. */
export function fileLimit(rules: Pick<FileRules, "multiple" | "maxFiles">): number {
  return rules.multiple ? (rules.maxFiles ?? Number.POSITIVE_INFINITY) : 1;
}

/**
 * The list after `incoming` files were chosen or dropped onto `current`. With `multiple` they are added to the
 * list; without it they replace it. Each file is checked against `accept`, the size limits and `validate`, and a
 * file that passes is still refused (`too-many`) once the list is full. A file that fails takes no room. A pick
 * or drop that takes nothing leaves the list as it was, with or without `multiple`.
 */
export function checkFiles(current: readonly File[], incoming: readonly File[], rules: FileRules): FileCheck {
  const kept = rules.multiple ? [...current] : [];
  const limit = fileLimit(rules);
  const rejected: FileRejection[] = [];
  const added: File[] = [];
  for (const file of incoming) {
    if (directories.has(file)) {
      rejected.push({ file, reasons: ["directory"] });
      continue;
    }
    const reasons: FileRejectionReason[] = [];
    if (!acceptsFile(file, rules.accept)) reasons.push("wrong-type");
    if (rules.maxFileSize !== undefined && file.size > rules.maxFileSize) reasons.push("too-large");
    if (rules.minFileSize !== undefined && file.size < rules.minFileSize) reasons.push("too-small");
    if (rules.validate) reasons.push(...reasonsFrom(rules.validate(file)));
    if (reasons.length === 0 && kept.length >= limit) reasons.push("too-many");
    if (reasons.length > 0) rejected.push({ file, reasons });
    else {
      kept.push(file);
      added.push(file);
    }
  }
  return { files: added.length > 0 ? kept : [...current], added, rejected };
}

/** The list without `file`. */
export function withoutFile(files: readonly File[], file: File): File[] {
  return files.filter((other) => other !== file);
}

/**
 * Moves focus on from a remove button that is about to leave the document with its item: to the next item's
 * remove button, else the previous one's, else the root's trigger, else its input. Does nothing unless the button
 * has focus. The move happens once the item is gone (the next frame), and only if focus fell to the body.
 */
export function handOffFocus(button: HTMLElement): void {
  const doc = button.ownerDocument;
  if (doc.activeElement !== button) return;
  const root = button.closest("[data-bisque-file-upload]");
  if (!root) return;
  const buttons = [...root.querySelectorAll<HTMLElement>("[data-bisque-file-remove]")];
  const index = buttons.indexOf(button);
  const target =
    buttons[index + 1] ??
    buttons[index - 1] ??
    root.querySelector<HTMLElement>("[data-bisque-file-trigger]") ??
    root.querySelector<HTMLElement>("input[type=file]") ??
    undefined;
  requestAnimationFrame(() => {
    if (!target || button.isConnected || !target.isConnected) return;
    if (doc.activeElement === null || doc.activeElement === doc.body) target.focus();
  });
}

/** The files an input holds, as an array. */
export function filesOf(input: HTMLInputElement): File[] {
  return input.files ? [...input.files] : [];
}

function sameFiles(list: FileList | null, files: readonly File[]): boolean {
  const held = list ? [...list] : [];
  return held.length === files.length && held.every((file, index) => file === files[index]);
}

/** Puts `files` in the input, cut to one where it doesn't take `multiple`. Fires no event. */
function show(input: HTMLInputElement, files: readonly File[]): void {
  const wanted = input.multiple ? files : files.slice(0, 1);
  if (sameFiles(input.files, wanted)) return;
  const transfer = new DataTransfer();
  for (const file of wanted) transfer.items.add(file);
  input.files = transfer.files;
}

/**
 * Keeps a native file input holding exactly `files`, so the list is what the form submits and what `required`
 * checks. The list changes three ways the input doesn't: a drop, a removal, and a controlled owner's state; each
 * is written into the input. The browser changes the input itself when the picker closes (it replaces the
 * selection, where the root may add to it, refuse a file, or wait for its owner): the input is set back once the
 * pick's changes have all run, a microtask after `change`, as `createCheckedInput` does for a checkbox.
 * `revision` writes the list again when it changes: after a form reset, which empties the input.
 */
export function createFileInput(
  element: Accessor<MaybeInput>,
  files: Accessor<File[]>,
  revision: Accessor<number>,
): void {
  createEffect(
    // Copied here: the list is a store, and reading it in the callback below would be an untracked read.
    () => [element(), [...files()], revision()] as const,
    ([input, list]) => {
      if (input) show(input, list);
    },
  );
  createEffect(
    () => element(),
    (input) => {
      if (!input) return;
      let queued = false;
      const changed = () => {
        if (queued) return;
        queued = true;
        queueMicrotask(() => {
          queued = false;
          show(
            input,
            untrack(() => [...files()]),
          );
        });
      };
      input.addEventListener("change", changed);
      return () => input.removeEventListener("change", changed);
    },
  );
}

/** The files of a drop, with the folders among them marked (see `directories`). */
function droppedFiles(transfer: DataTransfer | null): File[] {
  if (!transfer) return [];
  const files: File[] = [];
  for (const item of transfer.items) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (!file) continue;
    if (item.webkitGetAsEntry()?.isDirectory) directories.add(file);
    files.push(file);
  }
  return files;
}

function carriesFiles(event: DragEvent): boolean {
  return !!event.dataTransfer && [...event.dataTransfer.types].includes("Files");
}

/** Whether a drag can be seen to be refused before the drop: too many files, or a type `accept` rules out. */
function refusesDrag(event: DragEvent, options: DropZoneOptions): boolean {
  const items = event.dataTransfer
    ? [...event.dataTransfer.items].filter((item) => item.kind === "file")
    : [];
  if (items.length > options.room) return true;
  const tokens = acceptTokens(options.accept);
  return items.some((item) => refusesDraggedType(item.type, tokens));
}

/**
 * A drop zone for files: `dragging` while files are dragged over the element, `invalid` with it when the drag can
 * already be seen to be refused (see `refusesDrag`), and `onDrop` with the dropped files.
 *
 * - Only a drag that carries files is the zone's. Text, links and elements dragged over it are left alone, so they
 *   still reach an input inside it, and its default is not prevented.
 * - `dragover` and `drop` are prevented only while the zone takes drops (not `disabled`): that is what makes it a
 *   drop target, and what stops the browser opening the dropped file in place of the page. A disabled zone is not
 *   a target, so the browser does with the drop what it would without the zone.
 * - A file input inside the zone would take a drop itself; the zone's prevented `drop` cancels that, so a drop is
 *   handled once, here, by the root's rules.
 * - `dragenter` and `dragleave` fire for every child the pointer crosses, in an order that differs between
 *   engines. The zone counts as dragged over while any element it has been entered through hasn't been left; an
 *   element removed during the drag never fires `dragleave`, so entries no longer inside the zone are dropped.
 */
export function createDropZone(
  element: Accessor<MaybeElement>,
  options: Accessor<DropZoneOptions>,
  onDrop: (files: File[]) => void,
): Accessor<DropZoneState> {
  const idle: DropZoneState = { dragging: false, invalid: false };
  const [state, setState] = createSignal<DropZoneState>(idle);
  // What was last written: a signal's new value isn't readable until the next flush, and a drop follows its
  // dragenter within one task.
  let shown = idle;
  const display = (next: DropZoneState) => {
    if (next.dragging === shown.dragging && next.invalid === shown.invalid) return;
    shown = next;
    setState(next);
  };
  const entered = new Set<EventTarget>();
  const clear = () => {
    entered.clear();
    display(idle);
  };
  // Whether the zone takes this drag: it carries files, and the zone isn't disabled.
  const takes = (event: DragEvent) => carriesFiles(event) && !untrack(options).disabled;
  const enter = (event: DragEvent) => {
    if (!takes(event)) return;
    event.preventDefault();
    if (event.target) entered.add(event.target);
    display({ dragging: true, invalid: refusesDrag(event, untrack(options)) });
  };
  const over = (event: DragEvent) => {
    if (!takes(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  };
  const drop = (event: DragEvent) => {
    if (!takes(event)) return;
    event.preventDefault();
    clear();
    onDrop(droppedFiles(event.dataTransfer));
  };
  createEffect(
    () => options().disabled,
    (disabled) => {
      if (disabled) clear();
    },
  );
  createEffect(
    () => element(),
    (zone) => {
      if (!zone) return;
      const prune = () => {
        for (const target of entered)
          if (!(target instanceof Node) || !zone.contains(target)) entered.delete(target);
      };
      const leave = (event: DragEvent) => {
        if (event.target) entered.delete(event.target);
        prune();
        if (entered.size === 0) clear();
      };
      // A drag that ends anywhere (dropped elsewhere, or cancelled with Escape) ends the zone's drag state too.
      const doc = zone.ownerDocument;
      zone.addEventListener("dragenter", enter);
      zone.addEventListener("dragover", over);
      zone.addEventListener("dragleave", leave);
      zone.addEventListener("drop", drop);
      doc.addEventListener("dragend", clear, true);
      doc.addEventListener("drop", clear, true);
      return () => {
        zone.removeEventListener("dragenter", enter);
        zone.removeEventListener("dragover", over);
        zone.removeEventListener("dragleave", leave);
        zone.removeEventListener("drop", drop);
        doc.removeEventListener("dragend", clear, true);
        doc.removeEventListener("drop", clear, true);
        clear();
      };
    },
  );
  return state;
}

/**
 * An object URL for `file` while it is an image (`image/*`), revoked when the file changes or the caller is
 * disposed; undefined otherwise.
 */
export function createObjectUrl(file: Accessor<File | undefined>): Accessor<string | undefined> {
  const [url, setUrl] = createSignal<string | undefined>(undefined);
  createEffect(
    () => file(),
    (current) => {
      if (!current || !current.type.startsWith("image/")) {
        setUrl(undefined);
        return;
      }
      const made = URL.createObjectURL(current);
      setUrl(made);
      return () => URL.revokeObjectURL(made);
    },
  );
  return url;
}

const UNITS = ["byte", "kilobyte", "megabyte", "gigabyte", "terabyte"] as const;

/** A file size for people: "512 bytes", "1.5 kB", "20 MB" in the page's language, in powers of 1000. */
export function formatFileSize(bytes: number, locale?: string): string {
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: UNITS[unit],
    unitDisplay: unit === 0 ? "long" : "short",
    maximumFractionDigits: unit === 0 ? 0 : 1,
  }).format(value);
}
