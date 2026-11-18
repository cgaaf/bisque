// Generated from calendar.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/calendar.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type CalendarMonth = import("./impl/calendar.ts").CalendarMonth;
export type DayFocusRequest = import("./impl/calendar.ts").DayFocusRequest;
export type Checked = [
  Conforms<Implementation["visibleMonths"], (first: Temporal.PlainYearMonth, count: number, locale: string | string[] | undefined) => CalendarMonth[]>,
  Conforms<Implementation["isVisible"], (date: Temporal.PlainDate | undefined, first: Temporal.PlainYearMonth, count: number) => boolean>,
  Conforms<Implementation["pageFor"], (date: Temporal.PlainDate, first: Temporal.PlainYearMonth, count: number) => Temporal.PlainYearMonth>,
  Conforms<Implementation["tabStopDate"], (first: Temporal.PlainYearMonth, count: number, focused: Temporal.PlainDate | undefined, selected: Temporal.PlainDate | undefined, todayDate: Temporal.PlainDate | undefined, constraints: import("./impl/date.ts").DateConstraints | undefined) => Temporal.PlainDate>,
  Conforms<Implementation["isRtl"], (element: Element | null | undefined) => boolean>,
  Conforms<Implementation["createDayFocus"], (root: Accessor<HTMLElement | undefined>, request: Accessor<DayFocusRequest>) => void>,
];
