// A `features` set of an app's own: sorting only. TanStack Table bundles just the features it is given.
import { createSortedRowModel, rowSortingFeature, sortFns, tableFeatures } from "@tanstack/table-core";

export function sortingFeatures(): unknown {
  return tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns });
}
