// Generated from calendar.d.rx by scripts/gen-dts.mjs. Do not edit.
export type CalendarMonth = import("./impl/calendar.ts").CalendarMonth;
export type DayFocusRequest = import("./impl/calendar.ts").DayFocusRequest;
export declare function visibleMonths(first: Temporal.PlainYearMonth, count: number, locale: string | string[] | undefined): CalendarMonth[];
export declare function isVisible(date: Temporal.PlainDate | undefined, first: Temporal.PlainYearMonth, count: number): boolean;
export declare function pageFor(date: Temporal.PlainDate, first: Temporal.PlainYearMonth, count: number): Temporal.PlainYearMonth;
export declare function tabStopDate(first: Temporal.PlainYearMonth, count: number, focused: Temporal.PlainDate | undefined, selected: Temporal.PlainDate | undefined, todayDate: Temporal.PlainDate | undefined, constraints: import("./impl/date.ts").DateConstraints | undefined): Temporal.PlainDate;
export declare function isRtl(element: Element | null | undefined): boolean;
export declare function createDayFocus(root: HTMLElement | undefined, request: DayFocusRequest): void;
