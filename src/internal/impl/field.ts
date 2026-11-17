// The validation engine behind Field and Form: what needs the DOM's constraint validation, or has to answer
// synchronously while a submit event is still cancelable. `.rx` keeps the field's own state (touched, dirty,
// focused, filled) and decides when to validate; this module reads `input.validity`, runs the consumer's
// `validate`, and keeps the form's registry of fields. `../field.d.rx` declares how `.rx` may call it.
import { createEffect, createSignal, onCleanup, untrack, type Accessor } from "solid-js";
import { tabbables } from "./dom.ts";

export type ValidityFlags = {
  badInput: boolean;
  customError: boolean;
  patternMismatch: boolean;
  rangeOverflow: boolean;
  rangeUnderflow: boolean;
  stepMismatch: boolean;
  tooLong: boolean;
  tooShort: boolean;
  typeMismatch: boolean;
  valueMissing: boolean;
  /** `null` until the field has been validated, and while it is disabled. */
  valid: boolean | null;
};

/** A field's validity as of its last validation: the flags, its error messages, and the value validated. */
export type FieldValidity = {
  state: ValidityFlags;
  errors: string[];
  /** The first of `errors`, or `""`. */
  error: string;
  value: unknown;
};

/** What a `validate` function may return: one or more messages for an invalid value, nothing for a valid one. */
export type ValidateResult = string | string[] | null | undefined | void;
export type Validate = (value: unknown, formValues: FormValues) => ValidateResult;
export type FormValues = Record<string, unknown>;
/** Errors keyed by field name, typically from a server. */
export type FormErrors = Record<string, string | string[] | undefined>;

export type FieldValidationOptions = {
  name: string | undefined;
  /** The native input whose constraint validation (`required`, `pattern`, `type`…) counts. */
  input: HTMLInputElement | undefined;
  /** What a submit focuses while the field is invalid. */
  control: HTMLElement | undefined;
  validate: Validate | undefined;
  /** The field's current value, for the form's values. */
  value: unknown;
  disabled: boolean;
  /** Invalid from outside: the `invalid` prop, or an error the form holds for this field's name. */
  invalid: boolean;
};

type FieldEntry = {
  name: () => string | undefined;
  value: () => unknown;
  control: () => HTMLElement | undefined;
  enabled: () => boolean;
  /** Validates now, as a submit does, and answers whether the field is valid. */
  validate: () => boolean;
  /** Whether the field is valid as last validated, external errors included. */
  valid: () => boolean;
};

/** The fields of one form. A plain object: it is read and written only while handling events. */
export type FormRegistry = { fields: Set<FieldEntry> };

const VALIDITY_KEYS = [
  "badInput",
  "customError",
  "patternMismatch",
  "rangeOverflow",
  "rangeUnderflow",
  "stepMismatch",
  "tooLong",
  "tooShort",
  "typeMismatch",
  "valueMissing",
] as const;

const NEUTRAL: ValidityFlags = {
  badInput: false,
  customError: false,
  patternMismatch: false,
  rangeOverflow: false,
  rangeUnderflow: false,
  stepMismatch: false,
  tooLong: false,
  tooShort: false,
  typeMismatch: false,
  valueMissing: false,
  valid: null,
};

export const UNVALIDATED: FieldValidity = { state: NEUTRAL, errors: [], error: "", value: undefined };

export function createFormRegistry(): FormRegistry {
  return { fields: new Set() };
}

/** The current value of every enabled, named field of a form. */
export function formValues(registry: FormRegistry | undefined): FormValues {
  const values: FormValues = {};
  if (!registry) return values;
  for (const field of registry.fields) {
    const name = field.name();
    if (name && field.enabled()) values[name] = field.value();
  }
  return values;
}

function comesBefore(a: Node, b: Node): boolean {
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

/**
 * Focuses a field's control. A control that can't take focus itself (a radio group, a checkbox group) passes it to
 * its checked radio or current item, else its first tabbable element. An input's text is selected.
 */
export function focusControl(control: HTMLElement | undefined): void {
  if (!control) return;
  const focusable = control.tabIndex >= 0 || control.matches("input, select, textarea, button");
  const target = focusable
    ? control
    : (control.querySelector<HTMLElement>(
        'input[type="radio"]:checked:not(:disabled), [data-rs-ui-current]:not([data-disabled])',
      ) ??
      tabbables(control)[0] ??
      control);
  target.focus();
  if (target instanceof HTMLInputElement) target.select();
}

function firstInvalidControl(registry: FormRegistry, invalid: FieldEntry[]): HTMLElement | undefined {
  void registry;
  let first: HTMLElement | undefined;
  for (const field of invalid) {
    const control = field.control();
    if (control?.isConnected && (!first || comesBefore(control, first))) first = control;
  }
  return first;
}

/**
 * What a form does on submit: validates every enabled field, focuses the first invalid one in document order, and
 * answers whether the form may submit, with its values.
 */
export function submitForm(registry: FormRegistry | undefined): { valid: boolean; values: FormValues } {
  if (!registry) return { valid: true, values: {} };
  const invalid: FieldEntry[] = [];
  for (const field of registry.fields) {
    if (field.enabled() && !field.validate()) invalid.push(field);
  }
  focusControl(firstInvalidControl(registry, invalid));
  return { valid: invalid.length === 0, values: formValues(registry) };
}

/**
 * Focuses the first field that `errors` (a form's new errors, from a server) holds an entry for, or that is invalid
 * as last validated. `errors` is passed in rather than read through the fields: in the effect that sees it change,
 * what the fields derive from it isn't updated yet.
 */
export function focusFirstInvalid(registry: FormRegistry | undefined, errors: FormErrors | undefined): void {
  if (!registry) return;
  const invalid = [...registry.fields].filter(
    (field) => field.enabled() && (formErrorsFor(errors, field.name()).length > 0 || !field.valid()),
  );
  focusControl(firstInvalidControl(registry, invalid));
}

/** What a form's last submit came back with: `id` numbers the submits, so a field can tell one answer from the next. */
export type FormAnswer = { id: number; errors: FormErrors; values: FormValues };
export type FormSubmission = { pending: boolean; answer: FormAnswer };
type SubmitHandler = (values: FormValues) => FormErrors | void | Promise<FormErrors | void>;

/**
 * Sends a form's values to its handler and holds what happens: `pending` while the handler is out, then the
 * errors it resolved to, with the values they are about.
 *
 * This is plain signals and a promise, not a ReactiveScript action, on purpose. An action is one change, held
 * until it ends, and a submit validates every field inside it: the fields would join the change, and typing in
 * one while the request was out would not register until the server answered. The handler is started in a
 * microtask for the same reason: an action started inside a handler's run takes that run's writes with it. The
 * handler itself may well be an action that awaits; its hold is then its own.
 *
 * `send` does nothing while a request is out. `onDone` runs once the answer is on screen, `onError` if the
 * handler threw or its promise rejected.
 */
export function createSubmission(): [
  Accessor<FormSubmission>,
  (
    handler: SubmitHandler,
    values: FormValues,
    id: number,
    onDone: () => void,
    onError: (error: unknown) => void,
  ) => void,
] {
  const [state, setState] = createSignal<FormSubmission>({
    pending: false,
    answer: { id: 0, errors: {}, values: {} },
  });
  let live = true;
  onCleanup(() => {
    live = false;
  });
  const send = (
    handler: SubmitHandler,
    values: FormValues,
    id: number,
    onDone: () => void,
    onError: (error: unknown) => void,
  ) => {
    if (untrack(state).pending) return;
    setState((before) => ({ ...before, pending: true }));
    void Promise.resolve()
      .then(() => handler(values))
      .then(
        (found) => {
          if (!live) return;
          setState({ pending: false, answer: { id, errors: found ?? {}, values } });
          // After the fields have taken the answer in.
          setTimeout(() => {
            if (live) onDone();
          }, 0);
        },
        (error: unknown) => {
          if (!live) return;
          setState((before) => ({ ...before, pending: false }));
          onError(error);
        },
      );
  };
  return [state, send];
}

/** Hands a failure nobody handled to the page, as an uncaught error is: the console, `window.onerror`, monitoring. */
export function reportFailure(error: unknown): void {
  reportError(error);
}

/** The messages `errors` holds for `name`, as a list. */
export function formErrorsFor(errors: FormErrors | undefined, name: string | undefined): string[] {
  if (!errors || name === undefined || !Object.hasOwn(errors, name)) return [];
  const entry = errors[name];
  return (Array.isArray(entry) ? entry : [entry]).filter((message): message is string => !!message);
}

/** `errors` without the entries for the names in `cleared`. */
export function withoutErrors(errors: FormErrors | undefined, cleared: string[]): FormErrors {
  const out: FormErrors = { ...errors };
  for (const name of cleared) delete out[name];
  return out;
}

/** Whether two values are the same, comparing arrays (a checkbox group's value) element by element. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => Object.is(item, b[index]));
  }
  return Object.is(a, b);
}

/** Whether a field's value counts as filled in: not empty, not `false`, not an empty list. */
export function isFilled(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && value !== "" && value !== false;
}

function messages(result: ValidateResult): string[] {
  if (!result) return [];
  return (Array.isArray(result) ? result : [result]).filter((message) => !!message);
}

/**
 * A field's validation. Returns the field's validity (`UNVALIDATED` until first validated) and `run`, which
 * validates `value` now:
 * - `"commit"` checks the native constraints of `options.input`, then, if they pass, `options.validate`. A missing
 *   value (`required`) counts only once the field was changed (`markDirty`) or a submit validated it, so a field
 *   isn't marked invalid before the user has done anything.
 * - `"revalidate"` retires the field's error, whatever it was, unless the input is still missing its value; it
 *   doesn't look for new errors, which wait for the next commit. It is what a change does when the field doesn't
 *   validate on change.
 * - `"reset"` returns the field to unvalidated, as it was before the user did anything: what a form reset does.
 *
 * While `form` is a registry, the field is in it, so a submit validates it. The input's `invalid` event (the
 * browser checked it: a native submit, `reportValidity()`) commits, so a field in a plain `<form>` shows its error
 * while the browser blocks the submit. With no registry, Enter in the input also commits first, so a `validate`
 * message is installed on the input before the browser's implicit submission checks it.
 */
export function createFieldValidation(
  form: Accessor<FormRegistry | undefined>,
  options: Accessor<FieldValidationOptions>,
): [
  Accessor<FieldValidity>,
  (value: unknown, how: "commit" | "revalidate" | "reset", markDirty: boolean) => void,
] {
  const [validity, setValidity] = createSignal<FieldValidity>(UNVALIDATED);
  // What was last published, for a submit: the signal only shows a write once it is flushed.
  let published = UNVALIDATED;
  let markedDirty = false;
  // The custom message this field installed on its input, so it isn't read back as a native error.
  let installed: [HTMLInputElement, string] | undefined;
  const current = () => untrack(options);

  const publish = (state: ValidityFlags, errors: string[], value: unknown) => {
    const shown = state.valid === false ? errors : [];
    published = { state, errors: shown, error: shown[0] ?? "", value };
    setValidity(published);
  };

  const clearInstalled = () => {
    if (installed && installed[0].validationMessage === installed[1]) installed[0].setCustomValidity("");
    installed = undefined;
  };

  const nativeState = (input: HTMLInputElement | undefined): ValidityFlags => {
    if (!input?.willValidate) return { ...NEUTRAL, valid: true };
    const state: ValidityFlags = { ...NEUTRAL, valid: input.validity.valid };
    for (const key of VALIDITY_KEYS) state[key] = input.validity[key];
    const onlyMissing =
      state.valueMissing && VALIDITY_KEYS.every((key) => key === "valueMissing" || !state[key]);
    if (onlyMissing && !markedDirty) return { ...state, valueMissing: false, valid: true };
    return state;
  };

  const run = (value: unknown, how: "commit" | "revalidate" | "reset", markDirty: boolean): void => {
    if (how === "reset") {
      markedDirty = false;
      clearInstalled();
      published = { ...UNVALIDATED, value };
      setValidity(published);
      return;
    }
    if (markDirty) markedDirty = true;
    const { input, validate } = current();
    if (how === "revalidate") {
      if (published.state.valid !== false || !input) return;
      clearInstalled();
      if (!input.validity.valueMissing) publish({ ...NEUTRAL, valid: true }, [], value);
      return;
    }
    clearInstalled();
    let state = nativeState(input);
    let errors = state.valid === false && input ? [input.validationMessage] : [];
    if (errors.length === 0 && validate) {
      const custom = messages(untrack(() => validate(value, formValues(untrack(form)))));
      if (custom.length > 0) {
        state = { ...state, valid: false, customError: true };
        errors = custom;
        if (input?.willValidate) {
          const message = custom.join("\n");
          input.setCustomValidity(message);
          installed = [input, message];
        }
      }
    }
    publish(state, errors, value);
  };

  const entry: FieldEntry = {
    name: () => current().name,
    value: () => current().value,
    control: () => current().control,
    enabled: () => !current().disabled,
    validate: () => {
      markedDirty = true;
      run(current().value, "commit", true);
      return entry.valid();
    },
    valid: () => !current().invalid && published.state.valid !== false,
  };

  createEffect(
    () => form(),
    (registry) => {
      if (!registry) return;
      registry.fields.add(entry);
      return () => {
        registry.fields.delete(entry);
      };
    },
  );

  // The browser checked the input and found it invalid: a submit attempt, so a missing value counts.
  const invalid = () => {
    if (!current().disabled) run(current().value, "commit", true);
  };
  createEffect(
    () => options().input,
    (input) => {
      if (!input) return;
      // Implicit submission is Enter's default action, so it comes after this listener.
      const keydown = (event: KeyboardEvent) => {
        if (event.key !== "Enter" || untrack(form) || current().disabled) return;
        if (input.type === "checkbox" || input.type === "radio") return;
        run(current().value, "commit", false);
      };
      input.addEventListener("invalid", invalid);
      input.addEventListener("keydown", keydown);
      return () => {
        input.removeEventListener("invalid", invalid);
        input.removeEventListener("keydown", keydown);
      };
    },
  );

  return [validity, run];
}

/** Whether a part was given no children: a fixture's component passes `[]` when it has none. */
export function isEmptyView(view: unknown): boolean {
  return view === undefined || view === null || view === false || (Array.isArray(view) && view.length === 0);
}

/**
 * Keeps a native checkbox or radio showing the component's state. The browser toggles `checked` (and clears
 * `indeterminate`) itself on a click, before any handler runs, and an owner of a controlled value may refuse the
 * change; Solid writes a property only when its value changes, so both are written again after every change
 * (`revision`). `indeterminate` is a property with no attribute, so it can only be set this way. What a form reset
 * restores is the element's `defaultChecked`, which the component passes as a prop; after a reset the component
 * decides what the box shows (`createFormReset`) and counts a revision.
 */
export function createCheckedInput(
  element: Accessor<HTMLInputElement | undefined>,
  checked: Accessor<boolean>,
  indeterminate: Accessor<boolean>,
  revision: Accessor<number>,
): void {
  createEffect(
    () => [element(), checked(), indeterminate(), revision()] as const,
    ([input, isChecked, isIndeterminate]) => {
      if (!input) return;
      input.checked = isChecked;
      input.indeterminate = isIndeterminate;
    },
  );
}

/** The form a control or a part inside one belongs to: the input's own `form` (which follows a `form` attribute). */
function formOf(element: Element): HTMLFormElement | null {
  if (element instanceof HTMLFormElement) return element;
  if (element instanceof HTMLInputElement) return element.form;
  return element.closest("form");
}

/**
 * Calls `onReset` once the form `element` belongs to has been reset, and not for a reset that was cancelled. The
 * `reset` event fires before the browser puts the controls back to their defaults (`defaultChecked`, the `value`
 * attribute), and a microtask queued from it still runs first, so this waits for a task: by then the browser's
 * reset is done, and the component makes its state agree with it (uncontrolled) or writes its value back over it
 * (controlled). One listener per owner of a value: a radio group or a checkbox group listens, its inputs don't, so
 * a reset is reported once.
 */
export function createFormReset(element: Accessor<Element | undefined>, onReset: () => void): void {
  createEffect(
    () => element(),
    (target) => {
      const form = target ? formOf(target) : null;
      if (!form) return;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const reset = (event: Event) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (!event.defaultPrevented) onReset();
        }, 0);
      };
      form.addEventListener("reset", reset);
      return () => {
        clearTimeout(timer);
        form.removeEventListener("reset", reset);
      };
    },
  );
}

/**
 * Writes a controlled text input's value back after a form reset put its default there. Solid writes `value` only
 * when the bound value changes, and the owner's value didn't.
 */
export function setInputValue(input: HTMLInputElement | undefined, value: string): void {
  if (input && input.value !== value) input.value = value;
}
