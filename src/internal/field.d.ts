// Generated from field.d.rx by scripts/gen-dts.mjs. Do not edit.
export declare function createFormRegistry(): import("./impl/field.ts").FormRegistry;
export declare function createFieldValidation(form: import("./impl/field.ts").FormRegistry | undefined, options: import("./impl/field.ts").FieldValidationOptions): [import("./impl/field.ts").FieldValidity, (value: unknown, how: "commit" | "revalidate" | "reset", markDirty: boolean) => void];
export declare function submitForm(registry: import("./impl/field.ts").FormRegistry | undefined): { valid: boolean; values: Record<string, unknown> };
export declare function focusFirstInvalid(registry: import("./impl/field.ts").FormRegistry | undefined, errors: import("./impl/field.ts").FormErrors | undefined): void;
export declare function focusControl(control: HTMLElement | undefined): void;
export declare function formErrorsFor(errors: import("./impl/field.ts").FormErrors | undefined, name: string | undefined): string[];
export declare function withoutErrors(errors: import("./impl/field.ts").FormErrors | undefined, cleared: string[]): import("./impl/field.ts").FormErrors;
export declare function createFormErrors(errors: import("./impl/field.ts").FormErrors | undefined): [import("./impl/field.ts").FormErrors, (name: string) => void];
export declare function sameValue(a: unknown, b: unknown): boolean;
export declare function isFilled(value: unknown): boolean;
export declare function isEmptyView(view: unknown): boolean;
export declare function createCheckedInput(element: HTMLInputElement | undefined, checked: boolean, indeterminate: boolean, revision: number): void;
export declare function createFormReset(element: Element | undefined, onReset: () => void): void;
export declare function setInputValue(input: HTMLInputElement | undefined, value: string): void;
export declare function reportFailure(error: unknown): void;
export declare function createSubmission(): [import("./impl/field.ts").FormSubmission, (handler: (values: any) => any, values: import("./impl/field.ts").FormValues, id: number, onDone: () => void, onError: (error: unknown) => void) => void];
