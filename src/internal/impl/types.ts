// Types the `.rx` parts share. They live in TypeScript because `.rx` has no generic type aliases; `.rx` reads
// them through the aliases in ../types.rx.
import type { JSX } from "@solidjs/web";

/** What a native element takes: `class`, `id`, `data-*`, `aria-*`, handlers, `ref`, `children`. */
export type HTMLProps<E extends HTMLElement = HTMLElement> = JSX.HTMLAttributes<E>;
/** The attributes of one tag, including its own (`href` on `"a"`, `src` on `"img"`). */
export type ElementProps<Tag extends keyof JSX.IntrinsicElements> = JSX.IntrinsicElements[Tag];

/**
 * What a part's props function returns (`collapsibleTrigger(c)`): attributes, handlers and a `ref` to spread on
 * the element that plays the part, whatever its tag. It is loosely typed so it spreads on any element.
 */
// oxlint-disable-next-line typescript/no-explicit-any
export type PartProps = Record<string, any>;
