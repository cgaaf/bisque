// Prop helpers for parts. `.rx` spreads are last-wins, so a consumer's `onClick` or `ref` would replace a part's
// own: `mergeProps` is what lets both run.

import type { PartProps } from "./types.ts";

type Props = Record<string, unknown>;
/** Any props object: a part's own, or the typed attributes a consumer passed. */
type Source = object | undefined;
type Handler = (...args: unknown[]) => unknown;

const PREVENTED = Symbol("bisque.prevented");

/**
 * Called from a consumer's handler to stop the part's own handler for the same event, e.g. keep a menu open on an
 * item click. The consumer's handlers always run first.
 */
export function preventDefaultBehavior(event: Event): void {
  (event as unknown as Record<symbol, boolean>)[PREVENTED] = true;
}

function isHandler(key: string): boolean {
  return key.length > 2 && key.startsWith("on") && key[2] === key[2].toUpperCase();
}

function chain(internal: Handler, external: Handler): Handler {
  return (...args) => {
    external(...args);
    const event = args[0] as Record<symbol, boolean> | undefined;
    if (event && typeof event === "object" && event[PREVENTED]) return;
    internal(...args);
  };
}

/**
 * Merges a part's own props (`internal`) with the ones the consumer passed (`external`):
 * - event handlers both run, the consumer's first (it can call `preventDefaultBehavior(event)`);
 * - `ref` callbacks both run;
 * - `class` values are joined, `style` declarations are merged (objects or strings);
 * - for anything else the consumer wins, unless it passed `undefined`.
 *
 * It reads every field when called, so an equation `p = mergeProps(own, rest)` re-runs when any of them changes.
 */
export function mergeProps(internal: Source, external: Source): PartProps {
  const out: Props = { ...internal };
  if (!external) return out;
  const given = external as Props;
  for (const key of Object.keys(given)) {
    const theirs = given[key];
    if (theirs === undefined) continue;
    const ours = out[key];
    if (ours === undefined) out[key] = theirs;
    else if (key === "ref") out[key] = composeRefs(ours as Handler, theirs as Handler);
    else if (isHandler(key) && typeof ours === "function" && typeof theirs === "function") {
      out[key] = chain(ours as Handler, theirs as Handler);
    } else if (key === "class") out[key] = [ours, theirs];
    else if (key === "style") out[key] = mergeStyles(ours, theirs);
    else out[key] = theirs;
  }
  return out;
}

/**
 * The consumer's props without their event handlers while `disabled` is true. A consumer's handler runs before the
 * part's own, so a disabled part that is not a native control drops them instead: `onClick` on a disabled menu
 * item must not fire.
 */
export function withoutHandlers(external: Source, disabled: boolean): Source {
  if (!disabled || !external) return external;
  const out: Props = {};
  for (const [key, value] of Object.entries(external)) if (!isHandler(key)) out[key] = value;
  return out;
}

const cssText = (style: unknown): string =>
  typeof style === "string"
    ? style
    : Object.entries(style as Record<string, unknown>)
        .filter(([, value]) => value !== undefined && value !== null && value !== false)
        .map(([property, value]) => `${property}: ${String(value)}`)
        .join("; ");

/** The part's declarations, then the consumer's, which win. A style may be an object or a string. */
function mergeStyles(ours: unknown, theirs: unknown): unknown {
  if (typeof ours === "object" && typeof theirs === "object") return { ...ours, ...theirs };
  return `${cssText(ours)}; ${cssText(theirs)}`;
}

function composeRefs(a: Handler, b: Handler): Handler {
  return (element) => {
    a(element);
    b(element);
  };
}

/**
 * Wraps a part's element setter so it runs once per element.
 *
 * A `ref` that sits in a props object is applied again whenever that object is recomputed (another attribute
 * changed). Only the first application counts as a ref callback; a later one runs inside a computation, where
 * calling an action is an error (`ACTION_CALLED_IN_OWNED_SCOPE`). The same element again is therefore ignored.
 */
export function createRef<E extends Element>(set: (element: E) => void): (element: E) => void {
  let current: E | undefined;
  return (element) => {
    if (element === current) return;
    current = element;
    set(element);
  };
}

let nextId = 0;

/** A document-unique id for wiring ARIA relationships (`aria-controls`, `aria-labelledby`). */
export function createId(prefix: string): string {
  nextId += 1;
  return `bisque-${prefix}-${nextId}`;
}
