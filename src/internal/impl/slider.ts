// Number work and pointer dragging for the slider, which `.rx` can't do itself: it has no `Math`, `Number`,
// `Intl`, `Array.isArray`, loops or layout. `../slider.d.rx` declares how `.rx` may call it.
import { createEffect, untrack, type Accessor } from "solid-js";

type MaybeElement = HTMLElement | undefined;

export type SliderOrientation = "horizontal" | "vertical";
export type SliderPointerReason = "track-press" | "drag";

/** What the pointer gesture reads from the slider, live. */
export type SliderPointerOptions = {
  values: number[];
  min: number;
  max: number;
  step: number;
  minStepsBetweenValues: number;
  orientation: SliderOrientation;
  disabled: boolean;
};

/** The attribute a thumb carries so the control can find it, and its index among the thumbs. */
const THUMB = "[data-bisque-slider-thumb]";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Whether a slider's value is a range (an array, one entry per thumb) rather than a single number. */
export function isRangeValue(value: number | readonly number[] | undefined): boolean {
  return Array.isArray(value);
}

/** The thumbs' values: clamped to [min, max] and, for a range, sorted ascending. */
export function sliderValues(
  value: number | readonly number[] | undefined,
  min: number,
  max: number,
): number[] {
  if (Array.isArray(value)) return value.map((v) => clamp(v, min, max)).toSorted((a, b) => a - b);
  return [clamp(typeof value === "number" && !Number.isNaN(value) ? value : min, min, max)];
}

/** `value` formatted with `Intl.NumberFormat(locale, format)`. */
export function formatSliderValue(
  value: number,
  locale: string | string[] | undefined,
  format: Intl.NumberFormatOptions | undefined,
): string {
  return new Intl.NumberFormat(locale, format).format(value);
}

/** Where `value` sits in [min, max], 0 to 100. */
export function valueToPercent(value: number, min: number, max: number): number {
  const percent = ((value - min) * 100) / (max - min);
  return Number.isFinite(percent) ? clamp(percent, 0, 100) : 0;
}

export function decimalPrecision(num: number): number {
  if (num === 0 || !Number.isFinite(num)) return 0;
  if (Math.abs(num) < 1) {
    const [mantissa, exponent] = num.toExponential().split("e-");
    const fraction = mantissa.split(".")[1];
    return (fraction ? fraction.length : 0) + Number.parseInt(exponent ?? "0", 10);
  }
  const fraction = num.toString().split(".")[1];
  return fraction ? fraction.length : 0;
}

/** The multiple of `step` from `min` nearest `value`, without floating-point noise. */
export function roundToStep(value: number, step: number, min: number): number {
  const nearest = Math.round((value - min) / step) * step + min;
  return Number(nearest.toFixed(Math.max(decimalPrecision(step), decimalPrecision(min))));
}

/** Two values arrays hold the same numbers. */
export function sameValues(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Every pair of neighbouring thumbs is at least `step * minStepsBetweenValues` apart. */
export function hasMinDistance(
  values: readonly number[],
  step: number,
  minStepsBetweenValues: number,
): boolean {
  const distance = step * minStepsBetweenValues;
  for (let i = 0; i < values.length - 1; i += 1) {
    if (!(Math.abs(values[i] - values[i + 1]) >= distance)) return false;
  }
  return true;
}

/** The values with thumb `index` moved to `value`, kept between its neighbours (keyboard and input changes). */
export function moveThumb(
  values: readonly number[],
  index: number,
  value: number,
  min: number,
  max: number,
): number[] {
  const next = values.slice();
  next[index] = clamp(clamp(value, min, max), values[index - 1] ?? -Infinity, values[index + 1] ?? Infinity);
  return next.toSorted((a, b) => a - b);
}

/**
 * The value a key gives thumb `index`, or null for a key the slider doesn't handle. Arrows move one step (Shift:
 * the large step), Page Up/Down the large step, Home/End to the bounds (or to the neighbouring thumb, less the
 * minimum distance).
 */
export function thumbKeyValue(
  key: string,
  shift: boolean,
  values: readonly number[],
  index: number,
  min: number,
  max: number,
  step: number,
  largeStep: number,
  minStepsBetweenValues: number,
): number | null {
  const value = values[index];
  if (value === undefined) return null;
  let direction = 0;
  let increment = shift ? largeStep : step;
  switch (key) {
    case "ArrowUp":
    case "ArrowRight":
      direction = 1;
      break;
    case "ArrowDown":
    case "ArrowLeft":
      direction = -1;
      break;
    case "PageUp":
      increment = largeStep;
      direction = 1;
      break;
    case "PageDown":
      increment = largeStep;
      direction = -1;
      break;
    case "End": {
      const next = values[index + 1];
      return values.length > 1 && next !== undefined ? next - step * minStepsBetweenValues : max;
    }
    case "Home": {
      const previous = values[index - 1];
      return values.length > 1 && previous !== undefined ? previous + step * minStepsBetweenValues : min;
    }
    default:
      return null;
  }
  const rounded = roundToStep(value, step, min);
  const raw = rounded + increment * direction;
  const precision = Math.max(decimalPrecision(rounded), decimalPrecision(increment), decimalPrecision(min));
  return clamp(Number(raw.toFixed(precision)), min, max);
}

/**
 * Thumb `index` moved to `next` by a pointer, pushing its neighbours ahead of it so they stay
 * `step * minStepsBetweenValues` apart. A pushed thumb returns towards where it started (`initial`) when the
 * pressed one moves back.
 */
export function pushThumbs(
  values: readonly number[],
  index: number,
  next: number,
  min: number,
  max: number,
  step: number,
  minStepsBetweenValues: number,
  initial: readonly number[] = values,
): number[] {
  const out = values.slice();
  const gap = step * minStepsBetweenValues;
  const last = out.length - 1;
  out[index] = clamp(next, min + index * gap, max - (last - index) * gap);
  for (let i = index + 1; i <= last; i += 1) {
    const low = out[i - 1] + gap;
    const high = max - (last - i) * gap;
    let candidate = Math.max(out[i], low);
    if (initial[i] < candidate) candidate = Math.max(initial[i], low);
    out[i] = clamp(candidate, low, high);
  }
  for (let i = index - 1; i >= 0; i -= 1) {
    const high = out[i + 1] - gap;
    const low = min + i * gap;
    let candidate = Math.min(out[i], high);
    if (initial[i] > candidate) candidate = Math.min(initial[i], high);
    out[i] = clamp(candidate, low, high);
  }
  return out.map((value) => Number(value.toFixed(12)));
}

function thumbsOf(control: HTMLElement): HTMLElement[] {
  return [...control.querySelectorAll<HTMLElement>(THUMB)];
}

function thumbIndex(thumb: HTMLElement): number {
  return Number(thumb.getAttribute("data-index") ?? "0");
}

function thumbDisabled(thumb: HTMLElement): boolean {
  return thumb.querySelector<HTMLInputElement>('input[type="range"]')?.disabled === true;
}

function midpoint(element: HTMLElement, vertical: boolean): number {
  const rect = element.getBoundingClientRect();
  return vertical ? (rect.top + rect.bottom) / 2 : (rect.left + rect.right) / 2;
}

function cssPixels(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function noop(): void {}

function edges(control: HTMLElement, vertical: boolean): { start: number; end: number } {
  const styles = getComputedStyle(control);
  return vertical
    ? {
        start: cssPixels(styles.borderTopWidth) + cssPixels(styles.paddingTop),
        end: cssPixels(styles.borderBottomWidth) + cssPixels(styles.paddingBottom),
      }
    : {
        start: cssPixels(styles.borderLeftWidth) + cssPixels(styles.paddingLeft),
        end: cssPixels(styles.borderRightWidth) + cssPixels(styles.paddingRight),
      };
}

/** The value under a pointer at (x, y) over `control`, rounded to the step. Exported for tests. */
export function pointerValue(
  control: HTMLElement,
  x: number,
  y: number,
  vertical: boolean,
  min: number,
  max: number,
  step: number,
): number {
  const rect = control.getBoundingClientRect();
  const edge = edges(control, vertical);
  const size = (vertical ? rect.height : rect.width) - edge.start - edge.end;
  const along = vertical ? rect.bottom - y - edge.end : x - rect.left - edge.start;
  const ratio = size > 0 ? clamp(along / size, 0, 1) : 0;
  return clamp(roundToStep((max - min) * ratio + min, step, min), min, max);
}

function focusThumbInput(control: HTMLElement, index: number): void {
  const thumb = thumbsOf(control).find((el) => thumbIndex(el) === index);
  thumb?.querySelector<HTMLInputElement>('input[type="range"]')?.focus({ preventScroll: true });
}

/**
 * Pointer dragging on a slider's control: a press on the track moves the nearest thumb there, a press on a thumb
 * grabs it where it was pressed, and moving the pointer drags it until release. `onChange` gets the new values
 * (a range thumb pushes its neighbours), `onCommit` the final ones on release if anything changed, and
 * `onDragging` brackets the gesture. Thumbs are found in the DOM by `data-bisque-slider-thumb` and `data-index`.
 */
export function createSliderPointer(
  control: Accessor<MaybeElement>,
  options: Accessor<SliderPointerOptions>,
  onChange: (values: number[], thumb: number, reason: SliderPointerReason) => void,
  onCommit: (values: number[], reason: SliderPointerReason) => void,
  onDragging: (dragging: boolean) => void,
): void {
  createEffect(
    () => control(),
    (element) => {
      if (!element) return;
      let pressed = -1;
      let offset = 0;
      let initial: number[] = [];
      let latest: number[] = [];
      let changed = false;
      let reason: SliderPointerReason = "track-press";
      let focusFrame = 0;
      let stop: () => void = noop;

      const valueAt = (x: number, y: number): number[] | null => {
        const o = untrack(options);
        if (pressed < 0 || pressed >= latest.length) return null;
        const vertical = o.orientation === "vertical";
        const value = pointerValue(element, x - offset, y - offset, vertical, o.min, o.max, o.step);
        if (latest.length === 1) return [value];
        return pushThumbs(latest, pressed, value, o.min, o.max, o.step, o.minStepsBetweenValues, initial);
      };

      const apply = (next: number[] | null, why: SliderPointerReason) => {
        const o = untrack(options);
        if (!next || sameValues(next, latest) || !hasMinDistance(next, o.step, o.minStepsBetweenValues))
          return;
        latest = next;
        changed = true;
        reason = why;
        onChange(next, pressed, why);
      };

      const end = () => {
        stop();
        onDragging(false);
        if (changed) onCommit(latest, reason);
        pressed = -1;
        offset = 0;
        changed = false;
      };

      const move = (event: PointerEvent) => {
        // A release another element swallowed: end the drag rather than follow a pointer that isn't pressed.
        if (event.buttons === 0) {
          end();
          return;
        }
        apply(valueAt(event.clientX, event.clientY), "drag");
      };

      const down = (event: PointerEvent) => {
        const o = untrack(options);
        if (o.disabled || event.defaultPrevented || event.button !== 0) return;
        const vertical = o.orientation === "vertical";
        const coord = vertical ? event.clientY : event.clientX;
        const target = event.target instanceof Element ? event.target : null;
        const thumb = target?.closest<HTMLElement>(THUMB);
        latest = o.values.slice();
        initial = o.values.slice();
        changed = false;
        offset = 0;
        let onThumb = false;
        if (thumb && element.contains(thumb)) {
          if (thumbDisabled(thumb)) return;
          onThumb = true;
          pressed = thumbIndex(thumb);
          offset = coord - midpoint(thumb, vertical);
          // Thumbs stacked at the maximum: take the lowest, the only one that can move.
          if (latest[pressed] === o.max) {
            while (pressed > 0 && latest[pressed - 1] === o.max) pressed -= 1;
          }
        } else {
          let best = Infinity;
          pressed = -1;
          for (const el of thumbsOf(element)) {
            if (thumbDisabled(el)) continue;
            const distance = Math.abs(coord - midpoint(el, vertical));
            if (distance <= best) {
              best = distance;
              pressed = thumbIndex(el);
            }
          }
          if (pressed < 0) pressed = 0;
        }
        if (pressed >= latest.length) return;

        const focusedThumb = thumbsOf(element).find((el) => thumbIndex(el) === pressed);
        if (focusedThumb?.contains(document.activeElement)) event.preventDefault();
        else {
          const index = pressed;
          cancelAnimationFrame(focusFrame);
          focusFrame = requestAnimationFrame(() => focusThumbInput(element, index));
        }

        onDragging(true);
        if (!onThumb) apply(valueAt(event.clientX, event.clientY), "track-press");
        try {
          element.setPointerCapture?.(event.pointerId);
        } catch {
          // Not an active pointer (a synthetic event): the document listeners still follow it.
        }
        stop();
        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", end);
        document.addEventListener("pointercancel", end);
        stop = () => {
          document.removeEventListener("pointermove", move);
          document.removeEventListener("pointerup", end);
          document.removeEventListener("pointercancel", end);
          stop = noop;
        };
      };

      element.addEventListener("pointerdown", down);
      return () => {
        element.removeEventListener("pointerdown", down);
        cancelAnimationFrame(focusFrame);
        stop();
      };
    },
  );
}
