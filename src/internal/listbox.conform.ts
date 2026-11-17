// Generated from listbox.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/listbox.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type ItemLabel = { value: string; label: string };
export type Checked = [
  Conforms<Implementation["createTypeahead"], () => [(container: HTMLElement | undefined, key: string, current: string | undefined) => HTMLElement | undefined, () => void]>,
  Conforms<Implementation["elementText"], (element: HTMLElement | undefined) => string>,
  Conforms<Implementation["itemValue"], (element: EventTarget | null | undefined) => string | undefined>,
  Conforms<Implementation["adjacentItemId"], (list: HTMLElement | undefined, currentId: string | undefined, direction: "next" | "previous" | "first" | "last", loop: boolean) => string | undefined>,
  Conforms<Implementation["scrollItemIntoView"], (list: HTMLElement | undefined, id: string | undefined) => void>,
  Conforms<Implementation["itemLabel"], (list: HTMLElement | undefined, id: string | undefined) => string | undefined>,
  Conforms<Implementation["clickItem"], (list: HTMLElement | undefined, id: string | undefined) => void>,
  Conforms<Implementation["itemValueById"], (list: HTMLElement | undefined, id: string | undefined) => string | undefined>,
  Conforms<Implementation["itemIdByValue"], (list: HTMLElement | undefined, value: string | undefined) => string | undefined>,
  Conforms<Implementation["matchesFilter"], (filter: ((label: string, query: string) => boolean) | undefined, label: string, query: string) => boolean>,
  Conforms<Implementation["createOnShow"], (popup: Accessor<HTMLElement | undefined>, onShown: () => void) => void>,
  Conforms<Implementation["createOutsidePress"], (active: Accessor<boolean>, inside: Accessor<(HTMLElement | undefined)[]>, onOutside: () => void) => void>,
  Conforms<Implementation["createLabels"], () => [Accessor<ItemLabel[]>, (value: string, label: string) => void]>,
  Conforms<Implementation["createItemLabels"], (container: Accessor<HTMLElement | undefined>) => [Accessor<ItemLabel[]>, (value: string, label: string) => void]>,
  Conforms<Implementation["createItemObserver"], (container: Accessor<HTMLElement | undefined>, onChange: (count: number) => void) => void>,
  Conforms<Implementation["createInputValue"], (input: Accessor<HTMLElement | undefined>, value: Accessor<string>) => void>,
  Conforms<Implementation["hasFocus"], (element: HTMLElement | undefined) => boolean>,
];
