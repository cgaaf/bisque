// Generated from time-picker.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/time-picker.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type TimeUnit = import("./impl/time-picker.ts").TimeUnit;
export type TimePickerOption = import("./impl/time-picker.ts").TimePickerOption;
export type ColumnSettings = import("./impl/time-picker.ts").ColumnSettings;
export type Checked = [
  Conforms<Implementation["openingTime"], (granularity: "hour" | "minute" | "second" | undefined, minuteStep: number | undefined, secondStep: number | undefined) => Temporal.PlainTime>,
  Conforms<Implementation["isTwelveHour"], (locale: string | string[] | undefined, hourCycle: 12 | 24 | undefined) => boolean>,
  Conforms<Implementation["columnOptions"], (unit: TimeUnit, basis: Temporal.PlainTime, settings: ColumnSettings) => TimePickerOption[]>,
  Conforms<Implementation["columnValue"], (time: Temporal.PlainTime, unit: TimeUnit) => string>,
  Conforms<Implementation["columnTarget"], (basis: Temporal.PlainTime, unit: TimeUnit, step: number | undefined) => string>,
  Conforms<Implementation["chooseInColumn"], (basis: Temporal.PlainTime, unit: TimeUnit, value: string, granularity: "hour" | "minute" | "second" | undefined, min: Temporal.PlainTime | undefined, max: Temporal.PlainTime | undefined) => Temporal.PlainTime | undefined>,
  Conforms<Implementation["intervalOptions"], (locale: string | string[] | undefined, interval: number | undefined, granularity: "hour" | "minute" | "second" | undefined, hourCycle: 12 | 24 | undefined, min: Temporal.PlainTime | undefined, max: Temporal.PlainTime | undefined) => TimePickerOption[]>,
  Conforms<Implementation["intervalTarget"], (basis: Temporal.PlainTime, interval: number | undefined, granularity: "hour" | "minute" | "second" | undefined) => string>,
  Conforms<Implementation["createTimeGridNavigation"], (popup: Accessor<HTMLElement | undefined>) => void>,
  Conforms<Implementation["focusColumns"], (popup: HTMLElement | undefined) => void>,
  Conforms<Implementation["focusAdjacentColumn"], (from: EventTarget | null, direction: number) => boolean>,
  Conforms<Implementation["focusLeft"], (popup: HTMLElement | undefined, trigger: HTMLElement | undefined, next: EventTarget | null) => boolean>,
  Conforms<Implementation["chosenOption"], (target: EventTarget | null) => string | undefined>,
  Conforms<Implementation["createLateFormReset"], (element: Accessor<HTMLElement | undefined>, formId: Accessor<string | undefined>, onReset: () => void) => void>,
  Conforms<Implementation["createTimeRangeValidity"], (start: Accessor<HTMLInputElement | undefined>, end: Accessor<HTMLInputElement | undefined>, startMessage: Accessor<string>, endMessage: Accessor<string>, key: Accessor<string>) => void>,
  Conforms<Implementation["rangeFieldValue"], (start: string, end: string) => { start: string; end: string } | null>,
];
