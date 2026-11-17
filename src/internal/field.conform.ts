// Generated from field.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/field.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["createFormRegistry"], () => import("./impl/field.ts").FormRegistry>,
  Conforms<Implementation["createFieldValidation"], (form: Accessor<import("./impl/field.ts").FormRegistry | undefined>, options: Accessor<import("./impl/field.ts").FieldValidationOptions>) => [Accessor<import("./impl/field.ts").FieldValidity>, (value: unknown, how: "commit" | "revalidate" | "reset", markDirty: boolean) => void]>,
  Conforms<Implementation["submitForm"], (registry: import("./impl/field.ts").FormRegistry | undefined) => { valid: boolean; values: Record<string, unknown> }>,
  Conforms<Implementation["focusFirstInvalid"], (registry: import("./impl/field.ts").FormRegistry | undefined, errors: import("./impl/field.ts").FormErrors | undefined) => void>,
  Conforms<Implementation["focusControl"], (control: HTMLElement | undefined) => void>,
  Conforms<Implementation["formErrorsFor"], (errors: import("./impl/field.ts").FormErrors | undefined, name: string | undefined) => string[]>,
  Conforms<Implementation["withoutErrors"], (errors: import("./impl/field.ts").FormErrors | undefined, cleared: string[]) => import("./impl/field.ts").FormErrors>,
  Conforms<Implementation["createFormErrors"], (errors: Accessor<import("./impl/field.ts").FormErrors | undefined>) => [Accessor<import("./impl/field.ts").FormErrors>, (name: string) => void]>,
  Conforms<Implementation["sameValue"], (a: unknown, b: unknown) => boolean>,
  Conforms<Implementation["isFilled"], (value: unknown) => boolean>,
  Conforms<Implementation["isEmptyView"], (view: unknown) => boolean>,
  Conforms<Implementation["createFormReset"], (element: Accessor<Element | undefined>, onReset: () => void) => void>,
  Conforms<Implementation["setInputValue"], (input: HTMLInputElement | undefined, value: string) => void>,
  Conforms<Implementation["reportFailure"], (error: unknown) => void>,
  Conforms<Implementation["createSubmission"], () => [Accessor<import("./impl/field.ts").FormSubmission>, (handler: (values: any) => any, values: import("./impl/field.ts").FormValues, id: number, onDone: () => void, onError: (error: unknown) => void) => void]>,
];
