# Form

A native form that validates its fields, waits for the server and shows the errors it returns.

Source after `bisque copy`: `<copy>/form/form.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { Form } from "./bisque/form/form.rx"
import { FieldRoot, FieldLabel, FieldControl, FieldError } from "./bisque/field/field.rx"

<Form>
  <FieldRoot>
    <FieldLabel />
    <FieldControl />
    <FieldError />
  </FieldRoot>
  <button type="submit" />
</Form>
```

## Form

Renders `<form>`. A native `<form>` with `novalidate`. On submit it validates every enabled Field inside, prevents the submit and focuses the first invalid field when one fails, then hands the values to `onFormSubmit`, waits for it, and shows the errors it returns on their fields. A reset returns it to before its first submit.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `validationMode` | `FormValidationMode` | `"onSubmit"` | When the Fields inside validate, unless a FieldRoot sets its own: `"onSubmit"` (on submit, then on every change), `"onBlur"` or `"onChange"`. A submit always validates every field. |
| `errors` | `FormErrors` |  | Errors to show that didn’t come from a submit (a page rendered with them), keyed by field name: a message or a list of messages each. An entry is hidden once its field’s value changes, until `errors` itself changes. |
| `onFormSubmit` | `(values: FormValues) => FormErrors \| void \| Promise<FormErrors \| void>` |  | Called on a valid submit with the values of the enabled, named Fields, keyed by name; the native submission is then prevented. It may return a promise or be an action that awaits: the form is `data-submitting` until it ends and ignores further submits. What it resolves to, if anything, is the server’s errors keyed by field name: they show on their fields and the first takes focus. An error for a field edited while the request was out is dropped. |
| `onFormError` | `(error: unknown) => void` |  | Called with the error when `onFormSubmit` throws or its promise rejects. The form can then be submitted again. Without it, the failure is reported to the page as an uncaught error. |
| `onSubmit` | `(event: SubmitEvent) => void` |  | Called with the submit event on a valid submit, before `onFormSubmit`. Without `onFormSubmit`, the native submission goes ahead unless this prevents it. |

| Data attribute | Meaning |
| --- | --- |
| `data-submitting` | Present while `onFormSubmit` is out. The form also has `aria-busy="true"` meanwhile. |
