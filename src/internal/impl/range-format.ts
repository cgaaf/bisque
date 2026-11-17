// Number work for progress and meter, which `.rx` can't do itself: it has no `Math`, `Number` or `Intl`.

export type RangeValue = {
  /** The value clamped to [min, max]; null when there is no finite value (an indeterminate progress bar). */
  clamped: number | null;
  /** Where the value sits in the range, 0 to 100; null when there is no finite value. */
  percent: number | null;
  /** The clamped value formatted with `format`, else as a percentage of the range; "" when there is none. */
  formatted: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function rangeValue(
  value: number | null | undefined,
  min: number,
  max: number,
  locale: string | string[] | undefined,
  format: Intl.NumberFormatOptions | undefined,
): RangeValue {
  if (value == null || !Number.isFinite(value)) return { clamped: null, percent: null, formatted: "" };
  const raw = ((value - min) * 100) / (max - min);
  const percent = clamp(Number.isNaN(raw) ? 0 : raw, 0, 100);
  const clamped = clamp(value, min, max);
  const formatted = format
    ? new Intl.NumberFormat(locale, format).format(clamped)
    : new Intl.NumberFormat(locale, { style: "percent" }).format(percent / 100);
  return { clamped, percent, formatted };
}
