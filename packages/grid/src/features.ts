// features handlers extracted from the controller. Imperative event handlers
// reading/writing controller state via the `ctx` handle; the reactive core
// ($state/$derived/$effect) stays in the controller.
import {
    applyExcelFilter,
    normalizeForFilter,
    createColumnVirtualizer,
    createCoreRowModel,
    createExpandedRowModel,
    createFilteredRowModel,
    createGroupedRowModel,
    createSvelteVirtualizer,
    createSortedRowModel,
    createSvGrid,
    getGridCellDomId,
    sortFns,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    columnGroupingFeature,
    type CellEditorOption,
    type Column,
    type ColumnDef,
    type Row,
    type RowData,
    type TableFeatures,
  } from "./index";
import "./sv-grid-scrollbar";
import {
    computeColumnStat,
    formatsNeedingStats,
    type ColumnStat,
  } from "./conditional-formatting";
import SvGridDropdown from "./SvGridDropdown.svelte";
import type {
    Props,
    SelectionRange,
    CellEditState,
    FilterOperator,
    MenuPosition,
  } from "./SvGrid.types";
import {
    rawToNumber,
  } from "./SvGrid.helpers";
import {
    createScrollSync,
  } from "./scroll-sync";
import {
    createKeyboard,
  } from "./keyboard-handlers";
import {
    createSummaries,
  } from "./summaries";
import {
    createMenus,
  } from "./menus";
import {
    createCellRender,
  } from "./cell-render";
import {
    createEditing,
  } from "./editing";
import {
    createSelection,
  } from "./selection";
import {
    createColumns,
  } from "./columns";
import {
    createGridApi,
  } from "./build-api";
import {
    createClipboard,
  } from "./clipboard";
import {
    filterOperatorOptions,
    fallbackOperatorOption,
    TEXT_OPERATORS,
    NUMBER_OPERATORS,
    DATE_OPERATORS,
    CHECKBOX_OPERATORS,
    operatorOption,
    operatorsForColumn,
    defaultOperatorFor,
    operatorLabelFor,
  } from "./filter-operators";
import {
    type FacetBucket,
    isBucketableColumn,
    buildBuckets,
    isInBucket,
  } from "./facet-buckets";
import {
    getColumnBaseValue,
    isGroupRow,
    toolPanelHeaderLabel,
    formatSummaryNumeric,
    getColumnAlign,
    getPinnedCellValue,
    getColumnAccessorValue,
    columnDefMatchesId,
  } from "./cell-values";

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
