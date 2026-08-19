// features handlers extracted from the controller. Imperative event handlers
// reading/writing controller state via the `ctx` handle; the reactive core
// ($state/$derived/$effect) stays in the controller.
import {
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    columnGroupingFeature,
    type RowData,
    type TableFeatures,
  } from "./index";
import "./sv-grid-scrollbar";

export function createFeatures<
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
>(ctx: any) {
  // Merge the consumer's `features` set with whatever the boolean shortcuts
  // imply. A shortcut set to `true` injects its feature; set to `false` it
  // removes it (so `sortable={false}` wins even if `rowSortingFeature` was
  // passed in `features`); left undefined it defers to `features`.
  function resolveEffectiveFeatures(): TableFeatures {
    const merged: Record<string, unknown> = { ...(ctx.props.features ?? {}) };
    if (ctx.props.sortable === true) merged.rowSortingFeature = rowSortingFeature;
    else if (ctx.props.sortable === false) delete merged.rowSortingFeature;
    if (ctx.props.filterable === true)
      merged.columnFilteringFeature = columnFilteringFeature;
    else if (ctx.props.filterable === false) delete merged.columnFilteringFeature;
    if (ctx.props.groupable === true)
      merged.columnGroupingFeature = columnGroupingFeature;
    else if (ctx.props.groupable === false) delete merged.columnGroupingFeature;
    return tableFeatures(merged);
  }

  return {
    resolveEffectiveFeatures,
  };
}
