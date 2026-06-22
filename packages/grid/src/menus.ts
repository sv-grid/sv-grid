// menus handlers extracted from the controller. Imperative event handlers
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
import { createCellRender } from "./cell-render";
import { createEditing } from "./editing";
import { createSelection } from "./selection";
import { createColumns } from "./columns";
import { createGridApi } from "./build-api";
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

export function createMenus<
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
>(ctx: any) {
  function updateFilterRow(columnId: string, value: string) {
    ctx.filterRowValues = { ...ctx.filterRowValues, [columnId]: value };
    const current = ctx.filterMenuValues[columnId] ?? {
      operator: "contains" as const,
      value: "",
    };
    ctx.filterMenuValues = {
      ...ctx.filterMenuValues,
      [columnId]: { ...current, value },
    };
  }

  function updateFilterOperator(columnId: string, operator: FilterOperator) {
    const current = ctx.filterMenuValues[columnId] ?? {
      operator: "contains" as const,
      value: "",
    };
    ctx.filterMenuValues = {
      ...ctx.filterMenuValues,
      [columnId]: { ...current, operator },
    };
  }

  function updateFilterMenuValue(columnId: string, value: string) {
    const current = ctx.filterMenuValues[columnId] ?? {
      operator: "contains" as const,
      value: "",
    };
    ctx.filterMenuValues = {
      ...ctx.filterMenuValues,
      [columnId]: { ...current, value },
    };
    ctx.filterRowValues = { ...ctx.filterRowValues, [columnId]: value };
  }

  /** Upper-bound input for the `between` operator. Only relevant when
   *  the column's current operator is `between`; harmless to call
   *  otherwise. */
  function updateFilterMenuValueTo(columnId: string, valueTo: string) {
    const current = ctx.filterMenuValues[columnId] ?? {
      operator: "between" as const,
      value: "",
    };
    ctx.filterMenuValues = {
      ...ctx.filterMenuValues,
      [columnId]: { ...current, valueTo },
    };
  }

  function toggleCheckboxWithKeyboard(
    event: KeyboardEvent,
    toggle: () => void,
  ) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggle();
  }

  function isColumnFiltered(columnId: string) {
    if (ctx.valueFilters[columnId]) return true;
    const menuFilter = ctx.filterMenuValues[columnId];
    return Boolean(
      menuFilter &&
        (menuFilter.operator === "isBlank" || menuFilter.value.trim()),
    );
  }

  function closeMenus() {
    ctx.columnMenuFor = null;
    ctx.filterMenuFor = null;
    ctx.operatorMenuFor = null;
    ctx.chooseColumnsPos = null;
  }

  function openChooseColumns(event: MouseEvent) {
    event.stopPropagation();
    // Submenu behavior: keep the parent operations menu open and float the
    // Choose Columns panel out to the right of it (AG-Grid style). Falls
    // back to below the item if the popover would clip the viewport.
    const trigger = event.currentTarget as HTMLElement;
    const menuEl = trigger.closest(".sv-grid-menu") as HTMLElement | null;
    const anchor = (menuEl ?? trigger).getBoundingClientRect();
    const panelWidth = 240;
    const wantRight = anchor.right + 4;
    const x =
      wantRight + panelWidth + 8 > window.innerWidth
        ? clampMenuX(anchor.left - panelWidth - 4, panelWidth)
        : clampMenuX(wantRight, panelWidth);
    ctx.chooseColumnsPos = { x, y: anchor.top };
  }

  function openColumnMenu(event: MouseEvent, columnId: string) {
    event.stopPropagation();
    const wasOpen = ctx.columnMenuFor === columnId;
    closeMenus();
    if (wasOpen) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    ctx.columnMenuPos = {
      x: clampMenuX(rect.right - 240, 240),
      y: rect.bottom + 4,
    };
    ctx.columnMenuFor = columnId;
  }

  function openFilterMenu(event: MouseEvent, columnId: string) {
    event.stopPropagation();
    const wasOpen = ctx.filterMenuFor === columnId;
    closeMenus();
    if (wasOpen) return;

    // If the consumer is running in row-mode (or any mode where the
    // funnel popover wouldn't render), redirect the click to the
    // inline filter input for this column. Without this the funnel
    // would be a dead button - it visibly clicks but nothing happens
    // because the menu is gated behind `showColumnFiltersEffective`.
    if (!ctx.showColumnFiltersEffective && ctx.showFilterRowEffective) {
      // Find the row-mode filter input and focus it. The input is
      // tagged with `data-svgrid-filter-col` so we can target by id
      // without depending on column position.
      const input = (ctx.scrollContainer as HTMLElement | null)?.querySelector<HTMLInputElement>(
        `[data-svgrid-filter-col="${cssEscape(columnId)}"]`,
      );
      if (input) {
        input.focus();
        input.select();
        // Brief pulse so the user sees where focus landed.
        input.classList.add("sv-grid-filter-value-pulse");
        setTimeout(() => input.classList.remove("sv-grid-filter-value-pulse"), 700);
      }
      return;
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    ctx.filterMenuPos = {
      x: clampMenuX(rect.right - 260, 260),
      y: rect.bottom + 4,
    };
    ctx.columnMenuSearch = "";
    ctx.filterMenuFor = columnId;
  }

  function openOperatorMenu(event: MouseEvent, columnId: string) {
    event.stopPropagation();
    const wasOpen = ctx.operatorMenuFor === columnId;
    closeMenus();
    if (wasOpen) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    ctx.operatorMenuPos = { x: clampMenuX(rect.left, 184), y: rect.bottom + 4 };
    ctx.operatorMenuFor = columnId;
  }

  function sortColumnFromMenu(columnId: string, desc: boolean) {
    ctx.grid.store.setState((prev: any) => ({
      ...prev,
      sorting: [{ id: columnId, desc }],
    }));
    closeMenus();
  }

  function clearColumnSort(columnId: string) {
    ctx.grid.store.setState((prev: any) => ({
      ...prev,
      sorting: (prev.sorting ?? []).filter(
        (entry: { id: string }) => entry.id !== columnId,
      ),
    }));
    closeMenus();
  }

  function groupByColumnFromMenu(columnId: string) {
    const current = ctx.grid.getState().grouping ?? [];
    if (current.includes(columnId)) {
      closeMenus();
      return;
    }
    ctx.grid.setGrouping([...current, columnId]);
    closeMenus();
  }

  function clearGroupingFromMenu(columnId: string) {
    const current = ctx.grid.getState().grouping ?? [];
    ctx.grid.setGrouping(current.filter((id: string) => id !== columnId));
    closeMenus();
  }

  function isFacetChecked(columnId: string, value: string) {
    const selected = ctx.valueFilters[columnId];
    return selected ? selected.has(value) : true;
  }

  function toggleFacetValue(columnId: string, value: string) {
    const allValues = ctx.columnMenuFacetValues;
    const next = new Set(ctx.valueFilters[columnId] ?? allValues);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    if (next.size === allValues.length) {
      const copy = { ...ctx.valueFilters };
      delete copy[columnId];
      ctx.valueFilters = copy;
    } else {
      ctx.valueFilters = { ...ctx.valueFilters, [columnId]: next };
    }
  }

  function isAllFacetsChecked(columnId: string) {
    const selected = ctx.valueFilters[columnId];
    return !selected || selected.size >= ctx.columnMenuFacetValues.length;
  }

  function toggleAllFacets(columnId: string) {
    if (isAllFacetsChecked(columnId)) {
      ctx.valueFilters = { ...ctx.valueFilters, [columnId]: new Set<string>() };
    } else {
      const copy = { ...ctx.valueFilters };
      delete copy[columnId];
      ctx.valueFilters = copy;
    }
  }

  function clearColumnFilter(columnId: string) {
    if (ctx.valueFilters[columnId]) {
      const next = { ...ctx.valueFilters };
      delete next[columnId];
      ctx.valueFilters = next;
    }
    if (ctx.filterMenuValues[columnId]) {
      const next = { ...ctx.filterMenuValues };
      delete next[columnId];
      ctx.filterMenuValues = next;
    }
    if (ctx.filterRowValues[columnId]) {
      const next = { ...ctx.filterRowValues };
      delete next[columnId];
      ctx.filterRowValues = next;
    }
  }

  function changePage(delta: number) {
    ctx.grid.setPagination((prev: any) => ({
      ...prev,
      pageIndex: Math.max((prev?.pageIndex ?? 0) + delta, 0),
    }));
  }

  function goToPage(pageIndex: number) {
    ctx.grid.setPagination((prev: any) => ({
      ...prev,
      pageIndex: Math.max(0, pageIndex),
    }));
  }

  function setPageSize(pageSize: number) {
    ctx.grid.setPagination((prev: any) => {
      const oldSize = prev?.pageSize ?? 10;
      const oldIndex = prev?.pageIndex ?? 0;
      // Keep the first visible row in view when the page size changes.
      const firstVisibleRow = oldIndex * oldSize;
      return {
        ...prev,
        pageSize,
        pageIndex: Math.max(0, Math.floor(firstVisibleRow / pageSize)),
      };
    });
  }

  // ---- Right-click context menu --------------------------------------
  type CtxTarget = { rowIndex: number; colIndex: number; columnId: string; rowId: string; row: TData | null };
  type ResolvedItem = { key: string; label: string; separator?: boolean; disabled?: boolean; run?: () => void };

  function insertRowAt(t: CtxTarget, offset: number) {
    const data = ctx.internalData.slice() as TData[];
    const idx = t.row ? data.indexOf(t.row) : -1;
    const at = idx < 0 ? data.length : idx + offset;
    data.splice(at, 0, {} as TData);
    ctx.internalData = data;
  }
  function removeRowAt(t: CtxTarget) {
    if (!t.row) return;
    ctx.internalData = (ctx.internalData as TData[]).filter((r) => r !== t.row);
  }
  function removeColAt(t: CtxTarget) {
    ctx.internalColumns = ctx.internalColumns.filter(
      (d: any) => (d.id ?? d.field) !== t.columnId,
    );
  }

  // Built-in items, keyed. `run` reads the live target passed at click time.
  const builtins: Record<string, { label: string; run: (t: CtxTarget) => void }> = {
    copy: { label: "Copy", run: () => ctx.copySelectionToClipboard() },
    cut: { label: "Cut", run: () => ctx.cutSelectionToClipboard() },
    paste: { label: "Paste", run: () => void ctx.pasteFromClipboard() },
    clear: { label: "Clear", run: () => ctx.clearSelectedCells() },
    row_above: { label: "Insert row above", run: (t) => insertRowAt(t, 0) },
    row_below: { label: "Insert row below", run: (t) => insertRowAt(t, 1) },
    remove_row: { label: "Remove row", run: removeRowAt },
    remove_col: { label: "Remove column", run: removeColAt },
    comment: { label: "Edit comment", run: (t) => openCommentEditor(t) },
  };
  const DEFAULT_ITEMS = [
    "copy", "cut", "paste", "clear", "separator",
    "row_above", "row_below", "remove_row", "separator", "remove_col",
  ];

  function openContextMenu(
    event: MouseEvent,
    rowIndex: number,
    colIndex: number,
    columnId: string,
  ) {
    if (!ctx.props.contextMenu) return;
    event.preventDefault();
    closeMenus();
    ctx.contextMenuFor = null;
    const rowModel = ctx.allRows[rowIndex];
    const row = rowModel?.original ?? null;
    const rowId = rowModel?.id ?? String(rowIndex);
    ctx.contextMenuPos = {
      x: clampMenuX(event.clientX, 220),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 16)),
    };
    ctx.contextMenuFor = { rowIndex, colIndex, columnId, rowId, row };
  }

  function closeContextMenu() {
    ctx.contextMenuFor = null;
  }

  // ---- Editable comments ---------------------------------------------
  function openCommentEditor(t: CtxTarget) {
    const cur =
      ctx.noteOverrides?.[t.rowId]?.[t.columnId] ??
      ctx.props.notes?.[t.rowId]?.[t.columnId] ??
      "";
    ctx.commentDraft = cur;
    ctx.commentEditFor = { rowId: t.rowId, columnId: t.columnId, x: ctx.contextMenuPos.x, y: ctx.contextMenuPos.y };
    ctx.contextMenuFor = null;
  }
  function writeNote(rowId: string, columnId: string, note: string) {
    const next = { ...ctx.noteOverrides };
    next[rowId] = { ...(next[rowId] ?? {}), [columnId]: note };
    ctx.noteOverrides = next;
    ctx.props.onNoteChange?.({ rowId, columnId, note });
  }
  function saveComment() {
    const e = ctx.commentEditFor;
    if (!e) return;
    writeNote(e.rowId, e.columnId, ctx.commentDraft);
    ctx.commentEditFor = null;
  }
  function removeComment() {
    const e = ctx.commentEditFor;
    if (!e) return;
    writeNote(e.rowId, e.columnId, "");
    ctx.commentEditFor = null;
  }
  function closeCommentEditor() {
    ctx.commentEditFor = null;
  }

  /** Resolve the configured items against the current target for rendering. */
  function contextMenuItems(): ResolvedItem[] {
    const target = ctx.contextMenuFor as CtxTarget | null;
    if (!target) return [];
    const cfg = ctx.props.contextMenu;
    const entries: any[] = Array.isArray(cfg)
      ? cfg
      : [...DEFAULT_ITEMS, ...(ctx.props.editableComments ? ["separator", "comment"] : [])];
    const out: ResolvedItem[] = [];
    for (const entry of entries) {
      if (entry === "separator") { out.push({ key: "sep" + out.length, label: "", separator: true }); continue; }
      if (typeof entry === "string") {
        const b = builtins[entry];
        if (!b) continue;
        out.push({ key: entry, label: b.label, run: () => b.run(target) });
        continue;
      }
      if (entry.hidden?.(target)) continue;
      out.push({
        key: entry.key,
        label: entry.label,
        disabled: entry.disabled?.(target) ?? false,
        run: () => entry.action(target),
      });
    }
    // Drop leading/trailing/double separators.
    return out.filter((it, i, a) =>
      !it.separator || (i > 0 && i < a.length - 1 && !a[i - 1]?.separator),
    );
  }

  return {
    updateFilterRow,
    updateFilterOperator,
    updateFilterMenuValue,
    updateFilterMenuValueTo,
    toggleCheckboxWithKeyboard,
    isColumnFiltered,
    closeMenus,
    openChooseColumns,
    openColumnMenu,
    openFilterMenu,
    openOperatorMenu,
    sortColumnFromMenu,
    clearColumnSort,
    groupByColumnFromMenu,
    clearGroupingFromMenu,
    isFacetChecked,
    toggleFacetValue,
    isAllFacetsChecked,
    toggleAllFacets,
    clearColumnFilter,
    changePage,
    goToPage,
    setPageSize,
    openContextMenu,
    closeContextMenu,
    contextMenuItems,
    saveComment,
    removeComment,
    closeCommentEditor,
  };
}
