import { createSignal } from "solid-js";
// A library primitive: a plain Solid signal and its setter.
export const createFlag = (initial) => createSignal(initial);
