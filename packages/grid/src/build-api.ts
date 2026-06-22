// build-api handlers extracted from the controller. Imperative event handlers
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
  createPaginatedRowModel,
  createSvelteVirtualizer,
  createSortedRowModel,
  createSvGrid,
  filterFns,
  getGridCellA11yProps,
  getGridCellDomId,
  getGridHeaderA11yProps,
  getGridRootA11yProps,
  getGridRowA11yProps,
  parseEditorValue,
  normalizeEditorOptions,
  sortFns,
  tableFeatures,
  rowSortingFeature,
  columnFilteringFeature,
  columnGroupingFeature,
  type CellContext,
  type EditorContext,
  type CellEditorOption,
  type CellEditorType,
  type CellFormatter,
  type CellFormatConfig,
  type Column,
  type ColumnDef,
  type Row,
  type RowData,
  type SvGridApi,
  type TableFeatures,
} from "./index";
import "./sv-grid-scrollbar";
import type { Snippet } from "svelte";
import { getKeyboardIntent, getNextActiveCell } from "./keyboard";
import {
  formatNumericWithConfig,
  getDateFormatter,
  resolveDatePattern,
} from "./cell-formatting";
import {
  RenderSnippetConfig,
  RenderComponentConfig,
} from "./render-component";
import { buildFillPattern } from "./fill-patterns";
import { buildSparkline, toSparklineValues } from "./sparkline";
import {
  resolveCellFormat,
  computeColumnStat,
  formatsNeedingStats,
  type ColumnStat,
  type ResolvedCellFormat,
} from "./conditional-formatting";
import SvGridDropdown from "./SvGridDropdown.svelte";
import type {
  Props,
  SelectionPoint,
  SelectionRange,
  CellEditState,
  FilterOperator,
  FilterOption,
  MenuPosition,
} from "./SvGrid.types";
import {
  cfTextStyle,
  fmtStat,
  getCellKey,
  resolveClassList,
  toDateInputValue,
  toDateTimeLocalInputValue,
  getEditableInputValue,
  getEditorInputType,
  toValueArray,
  getOptionLabel,
  getOptionColor,
  colorfulChipStyle,
  getEditorClass,
  asDate,
  clampMenuX,
  cssEscape,
  rawToNumber,
  formatFacetNumber,
  formatFacetDate,
} from "./SvGrid.helpers";
import { createClipboard } from "./clipboard";
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

export function createGridApi<
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
>(ctx: any) {
  function buildApi(): SvGridApi<TFeatures, TData> {
    const findColumn = (columnId: string) =>
      ctx.grid.getAllColumns().find((column: any) => column.id === columnId);
    return {
      getCellValue(rowIndex, columnId) {
        const row = ctx.internalData[rowIndex];
        const column = findColumn(columnId);
        if (!row || !column) return undefined;
        if (column.columnDef.accessorFn)
          return column.columnDef.accessorFn(row);
        if (column.columnDef.field)
          return (row as Record<string, unknown>)[column.columnDef.field];
        return undefined;
      },
      setCellValue(rowIndex, columnId, value) {
        const row = ctx.internalData[rowIndex];
        const column = findColumn(columnId);
        if (!row || !column?.columnDef.field) return;
        const next = ctx.internalData.slice() as Array<TData>;
        next[rowIndex] = { ...row, [column.columnDef.field]: value } as TData;
        ctx.internalData = next;
      },
      selectCells(ranges) {
        // Engine supports a single anchor/focus rectangle today. Honour
        // the first entry; ignore the rest. Empty array clears.
        if (!ranges || ranges.length === 0) {
          ctx.selectionRange = { anchor: null, focus: null };
          return;
        }
        const [r1, c1, r2, c2] = ranges[0]!;
        const rowCount = ctx.internalData.length;
        const colCount = ctx.allColumns.length;
        if (rowCount === 0 || colCount === 0) return;
        // Clamp to the visible grid bounds so callers can pass open-ended
        // values like `[0, 0, Infinity, Infinity]` to mean "select all".
        const aRow = Math.max(0, Math.min(rowCount - 1, Math.min(r1, r2)));
        const fRow = Math.max(0, Math.min(rowCount - 1, Math.max(r1, r2)));
        const aCol = Math.max(0, Math.min(colCount - 1, Math.min(c1, c2)));
        const fCol = Math.max(0, Math.min(colCount - 1, Math.max(c1, c2)));
        ctx.selectionRange = {
          anchor: { rowIndex: aRow, colIndex: aCol },
          focus:  { rowIndex: fRow, colIndex: fCol },
        };
        // Move the active cell to the range's top-left so keyboard
        // navigation continues from there.
        ctx.setActiveCell(aRow, aCol);
      },
      getSelected() {
        const a = ctx.selectionRange.anchor;
        const f = ctx.selectionRange.focus;
        if (!a || !f) return [];
        const r1 = Math.min(a.rowIndex, f.rowIndex);
        const r2 = Math.max(a.rowIndex, f.rowIndex);
        const c1 = Math.min(a.colIndex, f.colIndex);
        const c2 = Math.max(a.colIndex, f.colIndex);
        return [[r1, c1, r2, c2]];
      },
      addRow(row, position = "bottom") {
        this.addRows([row], position);
      },
      addRows(rows, position = "bottom") {
        const next = ctx.internalData.slice() as Array<TData>;
        if (position === "top") next.unshift(...rows);
        else if (position === "bottom") next.push(...rows);
        else if (typeof position === "number")
          next.splice(Math.max(0, Math.min(position, next.length)), 0, ...rows);
        ctx.internalData = next;
      },
      removeRow(rowIndex) {
        this.removeRows([rowIndex]);
      },
      removeRows(rowIndices) {
        const drop = new Set(rowIndices);
        ctx.internalData = ctx.internalData.filter((_: any, i: any) => !drop.has(i));
      },
      applyTransaction(tx) {
        const getId = ctx.props.getRowId;
        let next = ctx.internalData.slice() as Array<TData>;
        let added = 0;
        let updated = 0;
        let removed = 0;

        if (tx.remove?.length) {
          const removeIds = new Set<string>();
          const removeRefs = new Set<TData>();
          for (const r of tx.remove) {
            if (typeof r === "string") removeIds.add(r);
            else removeRefs.add(r as TData);
          }
          next = next.filter((row, i) => {
            const hit =
              removeRefs.has(row) ||
              (getId ? removeIds.has(getId(row, i)) : false);
            if (hit) removed += 1;
            return !hit;
          });
        }

        if (tx.update?.length && getId) {
          const byId = new Map<string, TData>();
          for (const u of tx.update) byId.set(getId(u, 0), u);
          next = next.map((row, i) => {
            const u = byId.get(getId(row, i));
            if (u) {
              updated += 1;
              return u;
            }
            return row;
          });
        }

        if (tx.add?.length) {
          next.push(...(tx.add as Array<TData>));
          added += tx.add.length;
        }

        ctx.internalData = next;
        return { added, updated, removed };
      },
      addColumn(column, position = "right") {
        this.addColumns([column], position);
      },
      addColumns(columns, position = "right") {
        const next = ctx.internalColumns.slice();
        if (position === "left") next.unshift(...columns);
        else if (position === "right") next.push(...columns);
        else if (typeof position === "number")
          next.splice(
            Math.max(0, Math.min(position, next.length)),
            0,
            ...columns,
          );
        ctx.internalColumns = next;
      },
      removeColumn(columnId) {
        ctx.internalColumns = ctx.internalColumns.filter(
          (def: any) => !columnDefMatchesId(def, columnId),
        );
      },
      setColumnVisible(columnId, visible) {
        if (visible) {
          const next = { ...ctx.hiddenColumns };
          delete next[columnId];
          ctx.hiddenColumns = next;
        } else {
          ctx.hiddenColumns = { ...ctx.hiddenColumns, [columnId]: true };
        }
      },
      isColumnVisible(columnId) {
        return !ctx.hiddenColumns[columnId];
      },
      setSort(columnId, direction) {
        // Honour the column's `sortable` opt-out. Asking the engine
        // whether the column can sort folds in both the feature toggle
        // AND the per-column flag.
        const col = ctx.allColumns.find((c: any) => c.id === columnId);
        if (col && !col.getCanSort?.()) return;
        const clauses = direction
          ? [{ id: columnId, desc: direction === "desc" }]
          : (ctx.grid.getState().sorting ?? []).filter(
              (entry: { id: string }) => entry.id !== columnId,
            );
        ctx.grid.store.setState((prev: any) => ({ ...prev, sorting: clauses }));
      },
      clearSort() {
        ctx.grid.store.setState((prev: any) => ({ ...prev, sorting: [] }));
      },
      setGroupBy(columnIds) {
        ctx.grid.setGrouping([...columnIds]);
      },
      setFilter(columnId, filter) {
        // Honour the column's `filterable` opt-out. Same approach as
        // `setSort` - `getCanFilter()` already combines the feature flag
        // and the per-column field.
        const col = ctx.allColumns.find((c: any) => c.id === columnId);
        if (col && !col.getCanFilter?.()) return;
        if (!filter) {
          this.clearFilter(columnId);
          return;
        }
        ctx.filterMenuValues = {
          ...ctx.filterMenuValues,
          [columnId]: {
            operator: filter.operator,
            value: filter.value ?? "",
            ...(filter.operator === "between"
              ? { valueTo: filter.valueTo ?? "" }
              : {}),
          },
        };
      },
      setFacetFilter(columnId, values) {
        // Empty array OR null both mean "clear this column's facet" -
        // mirrors how the column menu treats unchecking the last value.
        if (!values || values.length === 0) {
          if (ctx.valueFilters[columnId]) {
            const next = { ...ctx.valueFilters };
            delete next[columnId];
            ctx.valueFilters = next;
          }
          return;
        }
        ctx.valueFilters = {
          ...ctx.valueFilters,
          [columnId]: new Set(values),
        };
      },
      clearFilter(columnId) {
        ctx.clearColumnFilter(columnId);
      },
      clearAllFilters() {
        // Wipe every filter surface in one go: column-menu, filter-row, set
        // filters, and the global search box.
        ctx.filterMenuValues = {};
        ctx.filterRowValues = {};
        ctx.valueFilters = {};
        if (ctx.globalFilter !== "") ctx.globalFilter = "";
      },
      getFilters() {
        // Return a defensive copy so callers can't mutate internal state.
        const out: Record<
          string,
          { operator: FilterOperator; value: string; valueTo?: string }
        > = {};
        for (const [columnId, filter] of Object.entries(ctx.filterMenuValues as Record<string, { operator: FilterOperator; value: string; valueTo?: string }>)) {
          out[columnId] = {
            operator: filter.operator,
            value: filter.value,
            ...(filter.operator === "between" && filter.valueTo
              ? { valueTo: filter.valueTo }
              : {}),
          };
        }
        return out;
      },
      getDisplayedRows() {
        // `allRows` is the final, post-filter, post-sort, post-group,
        // post-pagination list - exactly what the body renders. Skip group
        // header rows (they wrap an aggregate, not a TData row).
        const out: TData[] = [];
        for (const row of ctx.allRows) {
          if (row.subRows && row.subRows.length > 0) continue;
          out.push(row.original as TData);
        }
        return out;
      },
      getData() {
        return ctx.internalData;
      },
      getColumns() {
        // Snapshot every column in visual order with its human-readable
        // label and visibility flag. Used by external code (exporters,
        // column pickers) so they don't have to re-walk the columnDef
        // tree themselves.
        return ctx.allColumns.map((c: any) => ({
          id: c.id,
          field: (c.columnDef as { field?: string }).field,
          header:
            typeof c.columnDef.header === "string"
              ? c.columnDef.header
              : c.id,
          visible: !ctx.hiddenColumns[c.id],
        }));
      },
      clearRowSelection() {
        // Wipe the internal selection map AND emit the change so any
        // consumer holding a derived `selectedRows` resets too.
        ctx.grid.setRowSelection(() => ({}));
        ctx.props.onRowSelectionChange?.({}, []);
      },
      setColumnWidth(columnId: string, width: number) {
        const clamped = Math.max(ctx.MIN_COLUMN_WIDTH, Math.floor(width));
        ctx.columnWidths = { ...ctx.columnWidths, [columnId]: clamped };
      },
      getColumnWidths() {
        // Resolve every column's effective width by consulting both the
        // resize overrides (`columnWidths`) AND the columnDef defaults,
        // so the snapshot is round-trippable through setColumnWidth.
        const out: Record<string, number> = {};
        for (const c of ctx.allColumns) out[c.id] = ctx.getColumnWidth(c.id);
        return out;
      },
      setColumnPinning(pinning) {
        // Defensive copy + dedupe so callers can't mutate our state.
        const left = Array.from(new Set(pinning.left ?? []));
        const right = Array.from(new Set(pinning.right ?? []));
        ctx.columnPinning = { left, right };
      },
      getColumnPinning() {
        return {
          left: ctx.columnPinning.left.slice(),
          right: ctx.columnPinning.right.slice(),
        };
      },
      // ---- Column reorder
      setColumnOrder(order) {
        ctx.setColumnOrderInternal(order);
      },
      getColumnOrder() {
        return ctx.getCurrentColumnOrder();
      },
      setRowExpanded(id, expanded) {
        ctx.grid.setExpanded((prev: any) => ({ ...prev, [id]: !!expanded }));
      },
      expandAllGroups() {
        // Walk the current grouped row model and flip every group node on.
        const next: Record<string, boolean> = {};
        const walk = (rows: ReadonlyArray<{ id: string; getCanExpand?: () => boolean; subRows?: ReadonlyArray<unknown> }>) => {
          for (const row of rows) {
            if (row.getCanExpand?.()) next[row.id] = true;
            const sub = row.subRows as ReadonlyArray<{ id: string; getCanExpand?: () => boolean; subRows?: ReadonlyArray<unknown> }> | undefined;
            if (sub && sub.length > 0) walk(sub);
          }
        };
        walk(ctx.grid.getRowModel().rows as unknown as ReadonlyArray<{ id: string; getCanExpand?: () => boolean; subRows?: ReadonlyArray<unknown> }>);
        ctx.grid.setExpanded(() => next);
      },
      collapseAllGroups() {
        ctx.grid.setExpanded(() => ({}));
      },
      // ---- Undo / redo (history + pointer)
      undo() {
        if (ctx.historyPtr < 0) return false
        const step = ctx.history[ctx.historyPtr]
        if (!step) return false
        ctx.applyHistoryStep(step, 'undo')
        ctx.historyPtr -= 1
        ctx.historyVersion += 1
        return true
      },
      redo() {
        if (ctx.historyPtr >= ctx.history.length - 1) return false
        const step = ctx.history[ctx.historyPtr + 1]
        if (!step) return false
        ctx.applyHistoryStep(step, 'redo')
        ctx.historyPtr += 1
        ctx.historyVersion += 1
        return true
      },
      canUndo() { void ctx.historyVersion; return ctx.historyPtr >= 0 },
      canRedo() { void ctx.historyVersion; return ctx.historyPtr < ctx.history.length - 1 },
      clearHistory() { ctx.history = []; ctx.historyPtr = -1; ctx.historyVersion += 1 },
      // ---- Find
      openFind()  { ctx.findOpen = true },
      closeFind() { ctx.findOpen = false; ctx.findQuery = '' },
      setFindQuery(q: string) { ctx.findQuery = q; ctx.findHitIndex = 0 },
      getFindHits() { return ctx.findHits.slice() },
      // ---- Row selection (read + write)
      getSelectedRows() {
        const out: TData[] = [];
        for (const row of ctx.allRows) {
          if (isGroupRow(row)) continue;
          if (ctx.rowSelectionState[row.id]) out.push(row.original as TData);
        }
        return out;
      },
      getSelectedRowIds() {
        const out: string[] = [];
        for (const row of ctx.allRows) {
          if (!isGroupRow(row) && ctx.rowSelectionState[row.id]) out.push(row.id);
        }
        return out;
      },
      selectRows(ids, additive = false) {
        const set = new Set(ids);
        ctx.grid.setRowSelection((prev: any) => {
          const next: Record<string, boolean> = additive ? { ...prev } : {};
          for (const id of set) next[id] = true;
          return next;
        });
      },
      selectAllRows() {
        const next: Record<string, boolean> = {};
        for (const row of ctx.allRows) if (!isGroupRow(row)) next[row.id] = true;
        ctx.grid.setRowSelection(() => next);
      },
      toggleRowSelected(id) {
        ctx.toggleRowSelectionById(id);
      },
      // ---- Pagination
      getPageInfo() {
        const { pageIndex, pageSize } = ctx.paginationState;
        const total = ctx.allRowsBeforePagination.length;
        const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
        return { pageIndex, pageSize, pageCount, total };
      },
      setPage(pageIndex) {
        const total = ctx.allRowsBeforePagination.length;
        const pageCount = Math.max(
          1,
          Math.ceil(total / Math.max(1, ctx.paginationState.pageSize)),
        );
        ctx.goToPage(Math.max(0, Math.min(pageIndex, pageCount - 1)));
      },
      nextPage() {
        this.setPage(ctx.paginationState.pageIndex + 1);
      },
      prevPage() {
        this.setPage(ctx.paginationState.pageIndex - 1);
      },
      firstPage() {
        this.setPage(0);
      },
      lastPage() {
        const total = ctx.allRowsBeforePagination.length;
        const pageCount = Math.max(
          1,
          Math.ceil(total / Math.max(1, ctx.paginationState.pageSize)),
        );
        this.setPage(pageCount - 1);
      },
      setPageSize(size) {
        // Calls the component-level helper (lexical scope), not this method.
        ctx.setPageSize(Math.max(1, Math.floor(size)));
      },
      // ---- Navigation / scrolling
      scrollToRow(rowIndex) {
        if (!ctx.scrollContainer) return;
        const rh = ctx.props.rowHeight ?? 36;
        const maxIndex = Math.max(0, ctx.allRows.length - 1);
        const clamped = Math.max(0, Math.min(rowIndex, maxIndex));
        ctx.scrollContainer.scrollTop = clamped * rh;
        ctx.scheduleScrollSync(
          ctx.scrollContainer.scrollTop,
          ctx.scrollContainer.scrollLeft,
        );
      },
      getActiveCell() {
        const a = ctx.activeCell;
        if (!a || a.rowIndex < 0 || a.colIndex < 0) return null;
        const col = ctx.allColumns[a.colIndex];
        return {
          rowIndex: a.rowIndex,
          colIndex: a.colIndex,
          columnId: col?.id ?? "",
        };
      },
      setActiveCell(rowIndex, colIndex) {
        const r = Math.max(0, Math.min(rowIndex, Math.max(0, ctx.allRows.length - 1)));
        const c = Math.max(
          0,
          Math.min(colIndex, Math.max(0, ctx.allColumns.length - 1)),
        );
        // Calls the component-level helper (lexical scope), not this method.
        ctx.setActiveCell(r, c);
      },
      // ---- View state (save / restore)
      getState() {
        return {
          sorting: (ctx.grid.getState().sorting ?? []).map(
            (s: { id: string; desc: boolean }) => ({ id: s.id, desc: s.desc }),
          ),
          grouping: [...(ctx.grid.getState().grouping ?? [])],
          pagination: {
            pageIndex: ctx.paginationState.pageIndex,
            pageSize: ctx.paginationState.pageSize,
          },
          columnWidths: this.getColumnWidths(),
          columnPinning: this.getColumnPinning(),
          columnOrder: ctx.getCurrentColumnOrder(),
          hiddenColumns: Object.keys(ctx.hiddenColumns).filter(
            (k) => ctx.hiddenColumns[k],
          ),
          globalFilter: ctx.globalFilter,
          columnFilters: this.getFilters(),
          facetFilters: Object.fromEntries(
            Object.entries(ctx.valueFilters).map(([k, set]: [string, any]) => [
              k,
              Array.from(set),
            ]),
          ),
        };
      },
      setState(state) {
        if (state.sorting) {
          const sorting = state.sorting.map((s) => ({ id: s.id, desc: s.desc }));
          ctx.grid.store.setState((prev: any) => ({ ...prev, sorting }));
        }
        if (state.grouping) ctx.grid.setGrouping([...state.grouping]);
        if (state.pagination) {
          const p = state.pagination;
          ctx.grid.setPagination((prev: any) => ({ ...prev, ...p }));
        }
        if (state.columnWidths) ctx.columnWidths = { ...state.columnWidths };
        if (state.columnPinning)
          ctx.columnPinning = {
            left: [...(state.columnPinning.left ?? [])],
            right: [...(state.columnPinning.right ?? [])],
          };
        if (state.columnOrder) ctx.setColumnOrderInternal(state.columnOrder);
        if (state.hiddenColumns) {
          const next: Record<string, boolean> = {};
          for (const id of state.hiddenColumns) next[id] = true;
          ctx.hiddenColumns = next;
        }
        if (state.globalFilter !== undefined) ctx.globalFilter = state.globalFilter;
        if (state.columnFilters)
          ctx.filterMenuValues = { ...state.columnFilters };
        if (state.facetFilters) {
          const next: Record<string, Set<string>> = {};
          for (const [k, arr] of Object.entries(state.facetFilters))
            next[k] = new Set(arr);
          ctx.valueFilters = next;
        }
      },
      refresh() {
        ctx.grid.store.setState((prev: any) => ({ ...prev }));
      },
    };
  }

  return {
    buildApi,
  };
}
