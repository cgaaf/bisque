// Number work and DOM behaviour for the number field, which `.rx` can't do itself: locale-aware parsing and
// formatting, step snapping without float noise, press-and-hold on the stepper buttons, and scrubbing.
// `../number-field.d.rx` declares how `.rx` may call it.
import { createEffect, createSignal, onCleanup, untrack, type Accessor } from "solid-js";

type MaybeElement = HTMLElement | undefined;
type Locale = string | string[] | undefined;
type Format = Intl.NumberFormatOptions | undefined;

const MINUS_RE = /[-−－‒–—﹣]/gu;
const PLUS_RE = /[+＋﹢]/gu;
const MINUS_ONE_RE = /[-−－‒–—﹣]/u;
const PERCENT_RE = /[%٪％﹪]/u;
const PERMILLE_RE = /[‰؉]/u;
const SPACE_RE = /\p{Zs}/u;
const FORMAT_CONTROL_RE = /\p{Cf}/gu;
const ASCII_DIGIT_RE = /[0-9]/u;
// Digits of other numbering systems: Arabic-Indic, Persian and fullwidth. Each block starts at a multiple of 16.
const OTHER_DIGIT_RE = /[٠-٩۰-۹０-９]/u;
const SAMPLES = [1111111.1, 11111.1, 0, 1, 2, 5, 1.5];

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(locale: Locale, format: Format): Intl.NumberFormat {
  const key = JSON.stringify([locale, format]);
  let found = formatters.get(key);
  if (!found) {
    found = new Intl.NumberFormat(locale, format);
    formatters.set(key, found);
  }
  return found;
}

/** `value` formatted for display, "" for no value. */
export function formatNumberValue(value: number | null | undefined, locale: Locale, format: Format): string {
  if (value == null || Number.isNaN(value)) return "";
  return formatter(locale, format).format(value);
}

type LocaleSymbols = { group: string; decimal: string; digits: string[]; labels: string[] };

function symbols(locale: Locale, format: Format): LocaleSymbols {
  const parts = SAMPLES.flatMap((value) => formatter(locale, format).formatToParts(value));
  const decimal =
    formatter(locale, { useGrouping: false, numberingSystem: format?.numberingSystem })
      .formatToParts(0.1)
      .find((part) => part.type === "decimal")?.value ?? ".";
  const group = parts.find((part) => part.type === "group")?.value ?? "";
  const digits = Array.from(
    formatter(locale, { useGrouping: false, numberingSystem: format?.numberingSystem }).format(9876543210),
  ).toReversed();
  const labels = [
    ...new Set(
      parts
        .filter((part) => part.type === "currency" || part.type === "unit" || part.type === "literal")
        .map((part) => part.value.replace(FORMAT_CONTROL_RE, "").trim())
        .filter((label) => label !== ""),
    ),
  ].toSorted((a, b) => b.length - a.length);
  return { group, decimal, digits, labels };
}

function toAsciiDigits(text: string, digits: string[]): string {
  return Array.from(text, (ch) => {
    const index = digits.indexOf(ch);
    if (index !== -1) return String(index);
    return OTHER_DIGIT_RE.test(ch) ? String(ch.charCodeAt(0) % 16) : ch;
  }).join("");
}

/**
 * The number typed in `text`, read with `locale`'s separators and digits and `format`'s labels (currency, unit,
 * percent). Null when there is no finite number in it.
 */
export function parseNumberText(text: string, locale: Locale, format: Format): number | null {
  const { group, decimal, digits, labels } = symbols(locale, format);
  let input = text.replace(FORMAT_CONTROL_RE, "").trim();
  const percent = PERCENT_RE.test(input);
  const permille = PERMILLE_RE.test(input);
  for (const label of labels) input = input.replaceAll(label, "");
  input = toAsciiDigits(input, digits).replace(PLUS_RE, "");
  const negative = MINUS_ONE_RE.test(input);
  input = input.replace(MINUS_RE, "");
  if (group) input = SPACE_RE.test(group) ? input.replace(/\p{Zs}/gu, "") : input.replaceAll(group, "");
  input = input
    .replaceAll(decimal, ".")
    .replace(/[．٫]/gu, ".")
    .replace(/[，٬%٪％﹪‰؉\s]/gu, "");
  // Mixed separators: only the last dot is the decimal point.
  input = input.replace(/\.(?=[^.]*\.)/g, "");
  if (!/^\d*\.?\d*$/.test(input) || !/\d/.test(input)) return null;
  let value = Number.parseFloat((negative ? "-" : "") + input);
  if (permille) value /= 1000;
  else if (
    format?.style === "percent" ||
    (percent && !(format?.style === "unit" && format.unit === "percent"))
  ) {
    value /= 100;
  }
  value = Number(value.toPrecision(15));
  return Number.isFinite(value) ? value : null;
}

/**
 * Whether every character of `text` may appear in a number typed for this locale and format: digits, the
 * separators, signs (minus only when `allowNegative`), percent signs and the format's labels.
 */
export function isNumberText(text: string, locale: Locale, format: Format, allowNegative: boolean): boolean {
  const { group, decimal, digits, labels } = symbols(locale, format);
  const allowed = new Set<string>([
    ".",
    ",",
    "．",
    "，",
    "٫",
    "٬",
    "+",
    "＋",
    "﹢",
    " ",
    group,
    decimal,
    ...digits,
  ]);
  for (const label of labels) for (const ch of label) allowed.add(ch);
  if (format?.style === "percent" || format?.unit === "percent") for (const ch of "%٪％﹪") allowed.add(ch);
  return Array.from(text.replace(FORMAT_CONTROL_RE, "")).every(
    (ch) =>
      ASCII_DIGIT_RE.test(ch) ||
      OTHER_DIGIT_RE.test(ch) ||
      allowed.has(ch) ||
      SPACE_RE.test(ch) ||
      (allowNegative && MINUS_ONE_RE.test(ch)),
  );
}

function hasRoundingOptions(format: Format): boolean {
  return (
    format?.maximumFractionDigits != null ||
    format?.minimumFractionDigits != null ||
    format?.maximumSignificantDigits != null ||
    format?.minimumSignificantDigits != null
  );
}

/** `value` without binary noise (`0.1 + 0.2`), and rounded as `format` rounds it when it says how. */
export function removeFloatNoise(value: number, format: Format): number {
  if (!Number.isFinite(value)) return value;
  if (hasRoundingOptions(format)) {
    const rounded = new Intl.NumberFormat("en-US", {
      maximumFractionDigits: format?.maximumFractionDigits,
      minimumFractionDigits: format?.minimumFractionDigits,
      maximumSignificantDigits: format?.maximumSignificantDigits,
      minimumSignificantDigits: format?.minimumSignificantDigits,
      useGrouping: false,
    }).format(format?.style === "percent" ? value * 100 : value);
    const parsed = Number.parseFloat(rounded);
    if (Number.isFinite(parsed))
      return format?.style === "percent" ? Number((parsed / 100).toPrecision(15)) : parsed;
  }
  const cleaned = Number.parseFloat(value.toPrecision(15));
  return Math.abs(cleaned - value) <= Math.min(Number.EPSILON * Math.max(1, Math.abs(value)), 1e-10)
    ? cleaned
    : value;
}

/**
 * The value a change leads to. A step (`step` is the signed amount moved) snaps to a multiple of the step from
 * `min` (or 0) when `snapOnStep`: directionally, or to the nearest for a small step. Then it is clamped to
 * [min, max] when `clamp`, and cleaned of float noise.
 */
export function validateNumber(
  value: number | null,
  step: number | undefined,
  min: number | undefined,
  max: number | undefined,
  format: Format,
  snapOnStep: boolean,
  small: boolean,
  clamp: boolean,
): number | null {
  if (value === null || Number.isNaN(value)) return null;
  let next = value;
  if (step !== undefined && step !== 0 && snapOnStep) {
    const base = small || min === undefined ? 0 : min;
    const size = Math.abs(step);
    const steps = (next - base + size * 1e-10 * Math.sign(step)) / size;
    next = base + (small ? Math.round(steps) : step > 0 ? Math.floor(steps) : Math.ceil(steps)) * size;
  }
  const low = min ?? Number.MIN_SAFE_INTEGER;
  const high = max ?? Number.MAX_SAFE_INTEGER;
  if (clamp) next = Math.min(Math.max(next, low), high);
  if (step === undefined && !hasRoundingOptions(format)) return next;
  next = removeFloatNoise(next, format);
  return clamp ? Math.min(Math.max(next, low), high) : next;
}

/** Whether `element` has focus. */
export function isFocused(element: MaybeElement): boolean {
  return element !== undefined && element.ownerDocument.activeElement === element;
}

/** Focuses the input with the caret at the end of its text. */
export function focusInputEnd(element: HTMLInputElement | undefined): void {
  if (!element) return;
  const length = element.value.length;
  element.setSelectionRange(length, length);
  element.focus();
}

/** Puts `text` back in the input after a change the field rejected (Solid writes `value` only when it changes). */
export function restoreInputText(element: HTMLInputElement, text: string): void {
  if (element.value !== text) element.value = text;
}

/** Ms before a held stepper starts repeating, and between repeats. */
const START_DELAY = 400;
const TICK_DELAY = 60;
/** A touch is a press, not a scroll, if it hasn't moved more than this many px after this many ms. */
const TOUCH_DELAY = 50;
const TOUCH_SLOP = 8;

export type PressAndHold = {
  /** On pointerdown. A mouse press has already stepped once: holding repeats it. A touch steps once confirmed. */
  press: (event: PointerEvent) => void;
  release: (event: PointerEvent) => void;
  move: (event: PointerEvent) => void;
  enter: (event: MouseEvent) => void;
  leave: () => void;
  /** Whether a click follows a press that already stepped (keyboard and assistive clicks have `detail` 0). */
  skipClick: (event: MouseEvent) => boolean;
};

function noop(): void {}

function preventDefault(event: Event): void {
  event.preventDefault();
}

/** A virtual cursor coordinate wrapped to the other side once its centre leaves [low, high]. */
function wrapCoord(coord: number, half: number, low: number, high: number): number {
  if (coord + half < low) return high - half;
  if (coord + half > high) return low - half;
  return coord;
}

function isTouchLike(pointerType: string): boolean {
  return pointerType === "touch" || pointerType === "pen";
}

/**
 * Repeats `tick` while a stepper button is held: after 400ms, every 60ms, until release or until `disabled`
 * (a stepper is disabled at its bound). `onStop` runs on every release that followed a press.
 */
export function createPressAndHold(
  disabled: Accessor<boolean>,
  tick: (event: MouseEvent) => void,
  onStop: (event: PointerEvent) => void,
): PressAndHold {
  let pressed = false;
  let pointerType = "";
  let ignoreClick = false;
  let down = { x: 0, y: 0 };
  let timers: ReturnType<typeof setTimeout>[] = [];
  let interval: ReturnType<typeof setInterval> | undefined;
  let removeRelease = noop;

  const stopRepeating = () => {
    for (const timer of timers) clearTimeout(timer);
    timers = [];
    if (interval !== undefined) clearInterval(interval);
    interval = undefined;
  };

  const listenForRelease = () => {
    removeRelease();
    const onRelease = (event: PointerEvent) => {
      pressed = false;
      stopRepeating();
      removeRelease();
      onStop(event);
    };
    window.addEventListener("pointerup", onRelease);
    window.addEventListener("contextmenu", preventDefault);
    removeRelease = () => {
      window.removeEventListener("pointerup", onRelease);
      window.removeEventListener("contextmenu", preventDefault);
      removeRelease = noop;
    };
  };

  const repeat = (event: MouseEvent) => {
    stopRepeating();
    timers.push(
      setTimeout(() => {
        interval = setInterval(() => {
          if (untrack(disabled)) stopRepeating();
          else tick(event);
        }, TICK_DELAY);
      }, START_DELAY),
    );
  };

  createEffect(
    () => disabled(),
    (isDisabled) => {
      if (isDisabled) stopRepeating();
    },
  );
  onCleanup(() => {
    stopRepeating();
    removeRelease();
  });

  return {
    press(event) {
      if (untrack(disabled)) return;
      pressed = true;
      pointerType = event.pointerType;
      ignoreClick = false;
      down = { x: event.clientX, y: event.clientY };
      listenForRelease();
      if (!isTouchLike(event.pointerType)) {
        repeat(event);
        return;
      }
      timers.push(
        setTimeout(() => {
          if (!pressed) return;
          ignoreClick = true;
          tick(event);
          repeat(event);
        }, TOUCH_DELAY),
      );
    },
    release(event) {
      if (isTouchLike(event.pointerType)) pressed = false;
    },
    move(event) {
      if (!pressed || !isTouchLike(event.pointerType)) return;
      const dx = event.clientX - down.x;
      const dy = event.clientY - down.y;
      if (dx * dx + dy * dy > TOUCH_SLOP * TOUCH_SLOP) stopRepeating();
    },
    enter(event) {
      if (!pressed || isTouchLike(pointerType) || untrack(disabled)) return;
      tick(event);
      repeat(event);
    },
    leave() {
      if (!isTouchLike(pointerType)) stopRepeating();
    },
    skipClick(event) {
      if (isTouchLike(pointerType)) return ignoreClick;
      return event.detail !== 0;
    },
  };
}

export type ScrubOptions = {
  enabled: boolean;
  direction: "horizontal" | "vertical";
  pixelSensitivity: number;
  teleportDistance: number | undefined;
};

export type ScrubState = {
  scrubbing: boolean;
  /** The virtual cursor's position, in px from the viewport's top left (its top-left corner). */
  x: number;
  y: number;
  /** Whether a virtual cursor should show: not for touch, and not when the browser refused the pointer lock. */
  cursor: boolean;
};

/**
 * Scrubbing: press `area` and move the pointer to change the value. The pointer is locked (hidden) while
 * scrubbing, and a virtual cursor (`cursor`) wraps around the viewport (shrunk to `teleportDistance` px around
 * the area, if given). `onStep(delta)` gets the distance moved, in px, each time it passes `pixelSensitivity`;
 * `onEnd` runs on release.
 */
export function createScrub(
  area: Accessor<MaybeElement>,
  cursor: Accessor<MaybeElement>,
  options: Accessor<ScrubOptions>,
  onScrubbing: (scrubbing: boolean) => void,
  onStep: (delta: number, event: PointerEvent) => void,
  onEnd: (event: PointerEvent) => void,
): ScrubState {
  const [scrubbing, setScrubbing] = createSignal(false);
  const [position, setPosition] = createSignal({ x: 0, y: 0 });
  const [showCursor, setShowCursor] = createSignal(true);

  // Touch scrubbing shouldn't scroll the page.
  const touchStart = (event: TouchEvent) => {
    if (untrack(options).enabled && event.touches.length === 1) event.preventDefault();
  };

  createEffect(
    () => area(),
    (element) => {
      if (!element) return;
      let total = 0;
      let stop = noop;

      const bounds = () => {
        const distance = untrack(options).teleportDistance;
        const viewport = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
        if (distance === undefined) return viewport;
        const rect = element.getBoundingClientRect();
        return {
          left: Math.max(viewport.left, rect.left - distance),
          top: Math.max(viewport.top, rect.top - distance),
          right: Math.min(viewport.right, rect.right + distance),
          bottom: Math.min(viewport.bottom, rect.bottom + distance),
        };
      };

      const end = (event: PointerEvent) => {
        stop();
        try {
          if (document.pointerLockElement === element) document.exitPointerLock();
        } catch {
          // No pointer lock to release.
        }
        setScrubbing(false);
        onScrubbing(false);
        onEnd(event);
      };

      const move = (event: PointerEvent) => {
        event.preventDefault();
        const vertical = untrack(options).direction === "vertical";
        const el = untrack(cursor);
        const half = { x: (el?.offsetWidth ?? 0) / 2, y: (el?.offsetHeight ?? 0) / 2 };
        const box = bounds();
        const at = untrack(position);
        setPosition({
          x: wrapCoord(Math.round(at.x + event.movementX), half.x, box.left, box.right),
          y: wrapCoord(Math.round(at.y + event.movementY), half.y, box.top, box.bottom),
        });
        total += vertical ? event.movementY : event.movementX;
        if (Math.abs(total) < untrack(options).pixelSensitivity) return;
        total = 0;
        const delta = vertical ? -event.movementY : event.movementX;
        if (delta !== 0) onStep(delta, event);
      };

      const down = (event: PointerEvent) => {
        if (!untrack(options).enabled || event.button !== 0) return;
        event.preventDefault();
        total = 0;
        const touch = event.pointerType === "touch";
        const el = untrack(cursor);
        setShowCursor(!touch);
        setPosition({
          x: event.clientX - (el?.offsetWidth ?? 0) / 2,
          y: event.clientY - (el?.offsetHeight ?? 0) / 2,
        });
        setScrubbing(true);
        onScrubbing(true);
        if (!touch && typeof element.requestPointerLock === "function") {
          try {
            const locked = element.requestPointerLock() as unknown;
            if (locked instanceof Promise) locked.catch(() => setShowCursor(false));
          } catch {
            setShowCursor(false);
          }
        }
        window.addEventListener("pointermove", move, true);
        window.addEventListener("pointerup", end, true);
        stop = () => {
          window.removeEventListener("pointermove", move, true);
          window.removeEventListener("pointerup", end, true);
          stop = noop;
        };
      };

      element.addEventListener("pointerdown", down);
      element.addEventListener("touchstart", touchStart, { passive: false });
      return () => {
        element.removeEventListener("pointerdown", down);
        element.removeEventListener("touchstart", touchStart);
        if (untrack(scrubbing)) {
          setScrubbing(false);
          onScrubbing(false);
        }
        stop();
      };
    },
  );

  return {
    get scrubbing() {
      return scrubbing();
    },
    get x() {
      return position().x;
    },
    get y() {
      return position().y;
    },
    get cursor() {
      return showCursor();
    },
  };
}
