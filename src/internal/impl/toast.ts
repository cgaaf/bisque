// What the toast family needs from JavaScript: the manager that app code (in or out of `.rx`) calls to add,
// update, close and promise-wrap toasts; the record helpers its provider uses; and the DOM behaviour (pausable
// auto-dismiss timers, window focus, F6, measuring a toast). `../toast.d.rx` declares how `.rx` may call them,
// through the `../toast.js` facade.
import { createEffect, createSignal, onCleanup, untrack, type Accessor } from "solid-js";

type MaybeElement = HTMLElement | undefined;

/** What an app passes to `add` (and, without `id`, to `update`). */
export type ToastOptions = {
  /** Adding a toast with the id of one that is showing updates it in place and restarts its timer. */
  id?: string;
  title?: string;
  description?: string;
  /** Free-form: `"success"`, `"error"`, ... Shown as `data-type`. `"loading"` never auto-dismisses. */
  type?: string;
  /** Milliseconds before it closes by itself; `0` never. Default: the provider's `timeout`. */
  timeout?: number;
  /** `"high"` is announced at once (`role="alert"`); `"low"` politely. Default: `"low"`. */
  priority?: "low" | "high";
  /** Called when the toast starts closing. */
  onClose?: () => void;
  /** Called when it has finished animating out and left the list. */
  onRemove?: () => void;
  /** Spread on `ToastAction`; `children` is its label. */
  // oxlint-disable-next-line typescript/no-explicit-any
  actionProps?: Record<string, any>;
  /** Anything the app wants to read back when it renders the toast. */
  // oxlint-disable-next-line typescript/no-explicit-any
  data?: any;
};

export type ToastUpdate = Omit<ToastOptions, "id">;

/** A toast as the provider keeps it. */
export type ToastRecord = Omit<ToastOptions, "id"> & {
  id: string;
  /** True from `close` until it has animated out. */
  closing: boolean;
  /** Its measured height in px (0 while closing). */
  height: number;
  /** Changes whenever its auto-dismiss timer must start again from the full timeout. */
  timerKey: number;
};

export type ToastPromiseOptions<Value> = {
  /**
   * With an `id`, the loading toast is that toast: one still showing turns back to loading in place, so a retry
   * started from a failed toast's action button is followed by the same toast.
   */
  loading: string | ToastOptions;
  success: string | ToastUpdate | ((value: Value) => string | ToastUpdate);
  // oxlint-disable-next-line typescript/no-explicit-any
  error: string | ToastUpdate | ((error: any) => string | ToastUpdate);
};

export type ToastListener = {
  add: (options: ToastOptions) => void;
  update: (id: string, updates: ToastUpdate | ((previous: ToastRecord) => ToastUpdate)) => void;
  close: (id: string | undefined) => void;
};

/**
 * Adds, updates and closes toasts from anywhere: an event handler, a fetch wrapper, a plain `.ts` module. It
 * holds no toasts itself; every `ToastProvider` it is given to applies what it is told.
 */
export type ToastManager = {
  /** Returns the toast's id: the one given, or a new one. */
  add: (options: ToastOptions) => string;
  update: (id: string, updates: ToastUpdate | ((previous: ToastRecord) => ToastUpdate)) => void;
  /** Without an id, closes every toast. */
  close: (id?: string) => void;
  /**
   * Shows a `"loading"` toast until `promise` settles, then turns it into a `"success"` or `"error"` one. Returns
   * the promise, still rejecting if it rejects. Each call follows its own promise, so answers that arrive out of
   * order each end their own toast. Safe to await inside an action: the loading toast shows at once.
   */
  promise: <Value>(promise: Promise<Value>, options: ToastPromiseOptions<Value>) => Promise<Value>;
  subscribe: (listener: ToastListener) => () => void;
};

let nextToastId = 0;

function asUpdate<Value>(
  option: string | ToastOptions | ((value: Value) => string | ToastUpdate),
  value: Value,
): ToastOptions {
  const resolved = typeof option === "function" ? option(value) : option;
  return typeof resolved === "string" ? { description: resolved } : resolved;
}

export function createToastManager(): ToastManager {
  const listeners = new Set<ToastListener>();
  const manager: ToastManager = {
    add(options) {
      nextToastId += 1;
      const id = options.id ?? `bisque-toast-${nextToastId}`;
      for (const listener of listeners) listener.add({ ...options, id });
      return id;
    },
    update(id, updates) {
      for (const listener of listeners) listener.update(id, updates);
    },
    close(id) {
      for (const listener of listeners) listener.close(id);
    },
    promise(promise, options) {
      const id = manager.add({ ...asUpdate(options.loading, undefined), type: "loading" });
      return promise.then(
        (value) => {
          manager.update(id, { ...asUpdate(options.success, value), type: "success" });
          return value;
        },
        (error: unknown) => {
          manager.update(id, { ...asUpdate(options.error, error), type: "error" });
          throw error;
        },
      );
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return manager;
}

/** Calls the provider's handlers for whatever the manager is asked to do, for as long as the provider lives. */
export function subscribeToastManager(
  manager: Accessor<ToastManager>,
  onAdd: (options: ToastOptions) => void,
  onUpdate: (id: string, updates: ToastUpdate | ((previous: ToastRecord) => ToastUpdate)) => void,
  onClose: (id: string | undefined) => void,
): void {
  createEffect(
    () => manager(),
    (current) => current.subscribe({ add: onAdd, update: onUpdate, close: onClose }),
  );
}

/** A record for a toast that isn't showing yet. */
export function newToastRecord(options: ToastOptions): ToastRecord {
  return { ...options, id: options.id ?? "", closing: false, height: 0, timerKey: 0 };
}

/** `previous` with `updates` applied. Its timer starts again when `timeout` is given or when `restart` is true. */
export function updatedToastRecord(
  previous: ToastRecord,
  updates: ToastUpdate | ((previous: ToastRecord) => ToastUpdate),
  restart: boolean,
): ToastRecord {
  const changes = typeof updates === "function" ? updates(previous) : updates;
  const {
    id: _id,
    closing: _closing,
    height: _height,
    timerKey: _timerKey,
    ...rest
  } = changes as ToastRecord;
  return {
    ...previous,
    ...rest,
    timerKey: restart || Object.hasOwn(changes, "timeout") ? previous.timerKey + 1 : previous.timerKey,
  };
}

/** A toast as a part renders it: its record and where it stands in the stack. */
export type PlacedToast = ToastRecord & {
  /** Position in the list, newest first, counting toasts that are closing. */
  index: number;
  /** Position among the toasts that aren't closing; -1 while closing. */
  visibleIndex: number;
  /** The heights of the toasts in front of it, summed: where it sits when the stack is expanded. */
  offsetY: number;
  /** Beyond the provider's `limit`: kept in the list, but inert. */
  limited: boolean;
};

export function placeToasts(records: ToastRecord[], limit: number): PlacedToast[] {
  let visible = 0;
  let offset = 0;
  return records.map((record, index) => {
    const placed = {
      ...record,
      index,
      visibleIndex: record.closing ? -1 : visible,
      offsetY: offset,
      limited: !record.closing && visible >= limit,
    };
    offset += record.height || 0;
    if (!record.closing) visible += 1;
    return placed;
  });
}

/**
 * The `onClose` (or `onRemove`) callbacks of the toasts in `records` with id `id` (every one, without an id), leaving
 * out toasts already closing when it is `onClose`. Collected now, called later (`callToasts`): the provider calls
 * them in a change of their own, by which time its records already say the toasts are closing.
 */
export function toastCallbacks(
  records: ToastRecord[],
  id: string | undefined,
  which: "onClose" | "onRemove",
): (() => void)[] {
  const callbacks: (() => void)[] = [];
  for (const record of records) {
    if (id !== undefined && record.id !== id) continue;
    if (which === "onClose" && record.closing) continue;
    const callback = record[which];
    if (callback) callbacks.push(callback);
  }
  return callbacks;
}

/** Calls each of `callbacks`. */
export function callToasts(callbacks: (() => void)[]): void {
  for (const callback of callbacks) callback();
}

/**
 * Calls `onElapsed` after `duration` ms of time while `running` and not `paused`. Pausing keeps the time left;
 * a change of `duration` or `restartKey`, or `running` turning on, starts again from the full duration.
 */
export function createPausableTimeout(
  running: Accessor<boolean>,
  paused: Accessor<boolean>,
  duration: Accessor<number>,
  restartKey: Accessor<number>,
  onElapsed: () => void,
): void {
  let remaining = 0;
  let startedAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const stop = () => {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    remaining = Math.max(0, remaining - (Date.now() - startedAt));
  };
  const start = () => {
    if (timer !== undefined || remaining <= 0) return;
    startedAt = Date.now();
    timer = setTimeout(() => {
      timer = undefined;
      remaining = 0;
      onElapsed();
    }, remaining);
  };

  createEffect(
    () => [running(), duration(), restartKey()] as const,
    ([isRunning, ms]) => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      remaining = isRunning && ms > 0 ? ms : 0;
      if (!untrack(paused)) start();
    },
  );
  createEffect(
    () => paused(),
    (isPaused) => {
      if (isPaused) stop();
      else start();
    },
  );
  onCleanup(() => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  });
}

/** Whether the browser window has focus: toasts don't time out while the user is in another window. */
export function createWindowFocus(): Accessor<boolean> {
  const [focused, setFocused] = createSignal(true);
  // Element focus events reach these capture listeners too; the window's own have a target that isn't a node.
  // (Comparing the target with `window` fails under jsdom, whose global is a proxy of the event's target.)
  const onBlur = (event: FocusEvent) => {
    if (!(event.target instanceof Node)) setFocused(false);
  };
  const onFocus = (event: FocusEvent) => {
    if (!(event.target instanceof Node)) setFocused(true);
  };
  window.addEventListener("blur", onBlur, true);
  window.addEventListener("focus", onFocus, true);
  onCleanup(() => {
    window.removeEventListener("blur", onBlur, true);
    window.removeEventListener("focus", onFocus, true);
  });
  return focused;
}

// Where focus was before F6 moved it into a viewport, so it can go back.
const focusOrigins = new WeakMap<HTMLElement, HTMLElement>();

/** Puts focus back where F6 found it. Returns whether focus left the viewport. */
function restoreFocus(viewport: HTMLElement): boolean {
  const origin = focusOrigins.get(viewport);
  if (!origin?.isConnected) return false;
  focusOrigins.delete(viewport);
  if (origin === document.body) (document.activeElement as HTMLElement | null)?.blur();
  else origin.focus({ preventScroll: true });
  return !viewport.contains(document.activeElement);
}

/**
 * While `active` (there are toasts), F6 anywhere moves focus to `viewport`; inside it, F6 or Shift+Tab on the
 * viewport itself sends focus back where it came from.
 */
export function createToastHotkey(active: Accessor<boolean>, viewport: Accessor<MaybeElement>): void {
  createEffect(
    () => (active() ? viewport() : undefined),
    (el) => {
      if (!el) return;
      const onWindowKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "F6" || event.defaultPrevented) return;
        event.preventDefault();
        const origin = document.activeElement as HTMLElement | null;
        if (origin && !el.contains(origin)) focusOrigins.set(el, origin);
        el.focus({ preventScroll: true });
      };
      const onViewportKeyDown = (event: KeyboardEvent) => {
        if (event.defaultPrevented) return;
        const f6 = event.key === "F6";
        // F6 inside the viewport must not reach the window listener, which would pull focus back in.
        if (f6) event.stopPropagation();
        const backFromViewport = event.key === "Tab" && event.shiftKey && event.target === el;
        if ((f6 || backFromViewport) && restoreFocus(el)) event.preventDefault();
      };
      window.addEventListener("keydown", onWindowKeyDown);
      el.addEventListener("keydown", onViewportKeyDown);
      return () => {
        window.removeEventListener("keydown", onWindowKeyDown);
        el.removeEventListener("keydown", onViewportKeyDown);
      };
    },
  );
}

/**
 * Called as a toast starts closing: if focus is inside it, moves focus to the next toast (else the previous one),
 * and when there is none, back to where F6 found it.
 */
export function handOffToastFocus(toast: MaybeElement): void {
  if (!toast?.contains(document.activeElement)) return;
  const viewport = toast.closest<HTMLElement>("[data-bisque-toast-viewport]");
  const toasts = viewport
    ? [...viewport.querySelectorAll<HTMLElement>("[data-bisque-toast]")].filter(
        (el) => el === toast || (!el.inert && !el.hasAttribute("data-ending-style")),
      )
    : [];
  const index = toasts.indexOf(toast);
  const next = toasts[index + 1] ?? toasts[index - 1];
  if (next && next !== toast) next.focus();
  else if (!viewport || !restoreFocus(viewport)) (document.activeElement as HTMLElement | null)?.blur();
}

/** Whether focus arrived from the keyboard: a click inside the viewport doesn't keep the stack expanded. */
export function isFocusVisible(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  try {
    return target.matches(":focus-visible");
  } catch {
    return true;
  }
}

export function containsTarget(
  container: EventTarget | null | undefined,
  target: EventTarget | null,
): boolean {
  return container instanceof Node && target instanceof Node && container.contains(target);
}

/** The element's natural height (with any `height` the stylesheet gives it set aside), kept up to date. */
export function createElementHeight(element: Accessor<MaybeElement>): Accessor<number> {
  const [height, setHeight] = createSignal(0);
  createEffect(
    () => element(),
    (el) => {
      if (!el) return;
      const measure = () => {
        const before = el.style.height;
        el.style.height = "auto";
        setHeight(el.offsetHeight);
        el.style.height = before;
      };
      measure();
      const resize = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : undefined;
      const mutation = typeof MutationObserver === "function" ? new MutationObserver(measure) : undefined;
      resize?.observe(el);
      mutation?.observe(el, { childList: true, subtree: true, characterData: true });
      return () => {
        resize?.disconnect();
        mutation?.disconnect();
      };
    },
  );
  return height;
}

/** `swipeDirection` as a list: one direction, several, or none (an empty list turns swiping off). */
export function swipeDirections(
  value: "up" | "down" | "left" | "right" | ("up" | "down" | "left" | "right")[] | undefined,
  fallback: ("up" | "down" | "left" | "right")[],
): ("up" | "down" | "left" | "right")[] {
  if (value === undefined) return fallback;
  return Array.isArray(value) ? value : [value];
}

/**
 * Keeps the viewport, a `popover="manual"` element, shown for as long as it is mounted: that puts it in the top
 * layer, above the page, with no portal. It stays shown while empty, so its live region exists before the first
 * toast does. The top layer is ordered by when each element entered it, so a modal `<dialog>` opened later would
 * cover it: when one opens, the viewport is hidden and shown again to move it back on top. (The page outside a
 * modal dialog is still inert, toasts included, until the dialog closes.)
 */
export function createToastLayer(viewport: Accessor<MaybeElement>): void {
  createEffect(
    () => viewport(),
    (el) => {
      if (!el) return;
      if (!el.matches(":popover-open")) el.showPopover();
      // `toggle` doesn't bubble; a capture listener on the document still sees every dialog's.
      const onToggle = (event: Event) => {
        const dialog = event.target as HTMLElement;
        if ((event as ToggleEvent).newState !== "open" || dialog === el || dialog.tagName !== "DIALOG")
          return;
        if (!dialog.matches(":modal") || dialog.contains(el) || !el.matches(":popover-open")) return;
        // Hiding a popover that holds focus would drop it.
        if (el.contains(document.activeElement)) return;
        el.hidePopover();
        el.showPopover();
      };
      document.addEventListener("toggle", onToggle, true);
      return () => {
        document.removeEventListener("toggle", onToggle, true);
        if (el.isConnected && el.matches(":popover-open")) el.hidePopover();
      };
    },
  );
}

/**
 * Once `active` turns on (the element has just been given its ending style), waits for the element's
 * animations and transitions to finish, then calls `onDone`: a closing toast leaves the list only when it has
 * animated out. The ending style stays on until then.
 */
export function createExitWait(
  active: Accessor<boolean>,
  element: Accessor<MaybeElement>,
  onDone: () => void,
): void {
  createEffect(
    () => active(),
    (isActive) => {
      if (!isActive) return;
      const el = untrack(element);
      let cancelled = false;
      const finish = () => {
        if (!cancelled) onDone();
      };
      // The ending style has to be applied before the animations it starts can be found.
      const id = requestAnimationFrame(() => {
        const running = el?.getAnimations({ subtree: true }) ?? [];
        if (running.length === 0) finish();
        else void Promise.allSettled(running.map((animation) => animation.finished)).then(finish);
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(id);
      };
    },
  );
}
