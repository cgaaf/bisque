// Generated from field.d.rx by scripts/gen-dts.mjs. Do not edit.
export declare function createFormRegistry(): import("./impl/field.ts").FormRegistry;
export declare function createFieldValidation(form: import("./impl/field.ts").FormRegistry | undefined, options: import("./impl/field.ts").FieldValidationOptions): [import("./impl/field.ts").FieldValidity, (value: unknown, how: "commit" | "revalidate", markDirty: boolean) => void];
export declare function submitForm(registry: import("./impl/field.ts").FormRegistry | undefined): { valid: boolean; values: Record<string, unknown> };
export declare function focusFirstInvalid(registry: import("./impl/field.ts").FormRegistry | undefined, errors: import("./impl/field.ts").FormErrors | undefined): void;
export declare function focusControl(control: HTMLElement | undefined): void;
export declare function formErrorsFor(errors: import("./impl/field.ts").FormErrors | undefined, name: string | undefined): string[];
export declare function withoutErrors(errors: import("./impl/field.ts").FormErrors | undefined, cleared: string[]): import("./impl/field.ts").FormErrors;
export declare function sameValue(a: unknown, b: unknown): boolean;
export declare function isFilled(value: unknown): boolean;
export declare function isEmptyView(view: unknown): boolean;
export declare function createCheckedInput(element: HTMLInputElement | undefined, checked: boolean, indeterminate: boolean, revision: number): void;
