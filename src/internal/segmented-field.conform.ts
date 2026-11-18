// Generated from segmented-field.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/segmented-field.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type KeyedSegment = import("./impl/segmented-field.ts").KeyedSegment;
export type SegmentDraft = import("./impl/segmented-field.ts").SegmentDraft;
export type Checked = [
  Conforms<Implementation["segmentList"], (values: import("./impl/date.ts").SegmentValues, options: import("./impl/date.ts").FieldOptions) => KeyedSegment[]>,
  Conforms<Implementation["segmentsOfText"], (text: string, options: import("./impl/date.ts").FieldOptions) => import("./impl/date.ts").SegmentValues>,
  Conforms<Implementation["textOfSegments"], (values: import("./impl/date.ts").SegmentValues, options: import("./impl/date.ts").FieldOptions) => string>,
  Conforms<Implementation["isTextOutOfRange"], (text: string, min: string | undefined, max: string | undefined, options: import("./impl/date.ts").FieldOptions) => boolean>,
  Conforms<Implementation["boundText"], (bound: Temporal.PlainDate | Temporal.PlainTime | undefined, options: import("./impl/date.ts").FieldOptions) => string | undefined>,
  Conforms<Implementation["shownDigits"], (values: import("./impl/date.ts").SegmentValues, kind: import("./impl/date.ts").SegmentKind, options: import("./impl/date.ts").FieldOptions) => string>,
  Conforms<Implementation["createDraft"], (current: Accessor<string>) => [Accessor<SegmentDraft | undefined>, (draft: SegmentDraft | undefined) => void]>,
  Conforms<Implementation["hasAnySegment"], (values: import("./impl/date.ts").SegmentValues, options: import("./impl/date.ts").FieldOptions) => boolean>,
  Conforms<Implementation["textOfPaste"], (text: string | null | undefined, options: import("./impl/date.ts").FieldOptions) => string | undefined>,
  Conforms<Implementation["pastedText"], (event: ClipboardEvent) => string | null>,
  Conforms<Implementation["focusSegment"], (input: HTMLElement | undefined, from: HTMLElement | undefined, step: number) => boolean>,
  Conforms<Implementation["focusEntry"], (input: HTMLElement | undefined) => void>,
  Conforms<Implementation["focusFirst"], (input: HTMLElement | undefined) => void>,
  Conforms<Implementation["isRightToLeft"], (element: HTMLElement) => boolean>,
  Conforms<Implementation["isSegment"], (target: EventTarget | null) => boolean>,
  Conforms<Implementation["restoreText"], (element: HTMLElement, text: string) => void>,
  Conforms<Implementation["createIncompleteValidity"], (input: Accessor<HTMLInputElement | undefined>, message: Accessor<string>) => void>,
];
