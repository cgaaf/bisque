// Generated from table-of-contents.d.rx by scripts/gen-dts.mjs. Do not edit.
export declare function targetId(href: string | undefined): string | undefined;
export declare function createScrollSpy(ids: string[], container: HTMLElement | undefined, offset: number, onChange: (id: string | undefined) => void): [string | undefined, (id: string) => void];
export declare function createTableOfContents(nav: HTMLElement | undefined, container: HTMLElement | undefined, offset: number, onChange: (id: string | undefined) => void): string | undefined;
export declare function createActiveLinkRect(nav: HTMLElement | undefined, activeId: string | undefined): { top: number; left: number; width: number; height: number } | undefined;
