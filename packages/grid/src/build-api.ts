// build-api handlers extracted from the controller. Imperative event handlers
// reading/writing controller state via the `ctx` handle; the reactive core
// ($state/$derived/$effect) stays in the controller.
import {
  type RowData,
  type SvGridApi,
  type TableFeatures,
} from "./index";
import "./sv-grid-scrollbar";
import { untrack } from "svelte";
// The export serializers load lazily (their own chunk) so export-format.ts stays
// out of the base bundle - it is fetched only when an export/copy method is
// actually invoked (an explicit, already-async user action).
import type {
  GridExportColumn,
  GridExportScope,
  GridExportOptions,
  GridClipboardOptions,
} from "./export-format";
import type {
  FilterOperator,
} from "./SvGrid.types";
import {
  isGroupRow,
  getColumnAlign,
  columnDefMatchesId,
} from "./cell-values";
import { hasAdvancedFilterEngine } from "./advanced-filter.svelte";

export function createGridApi<
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
>(ctx: any) {
  function buildApi(): SvGridApi<TFeatures, TData> {
    const findColumn = (columnId: string) =>
      ctx.grid.getAllColumns().find((column: any) => column.id === columnId);

    // --- Free data export (CSV / TSV / JSON + clipboard) helpers ----------
    // Snapshot the VISIBLE columns (field + label + format + align) so the
    // exporter reproduces on-screen values. Mirrors getColumns()'s visible set.
    const exportColumns = (): GridExportColumn[] =>
      ctx.allColumns
        .map((c: any) => ({
          field: (c.columnDef as { field?: string }).field as string,
          header:
            typeof c.columnDef.header === "string" ? c.columnDef.header : c.id,
          format: c.columnDef.format,
          align: getColumnAlign(c),
        }))
        .filter((c: GridExportColumn) => !!c.field);
    // Rows for the requested scope: current view / checked / full dataset.
    const exportScopeRows = (scope: GridExportScope): TData[] => {
      if (scope === "all") return ctx.internalData as TData[];
      const out: TData[] = [];
      for (const row of ctx.allRows) {
        if (isGroupRow(row)) continue;
        if (scope === "selected" && !ctx.rowSelectionState[row.id]) continue;
        out.push(row.original as TData);
      }
      return out;
    };
    const projectForExport = async (
      scope: GridExportScope,
      columns: ReadonlyArray<string> | undefined,
      rawValues: boolean | undefined,
    ) => {
      const { projectGridRows } = await import("./export-format");
      return projectGridRows(
        exportScopeRows(scope) as ReadonlyArray<Record<string, unknown>>,
        exportColumns(),
        { columns, rawValues },
      );
    };

    return {
      getCellValue(rowIndex, columnId) {
        const row = ctx.internalData[rowIndex];
        const column = findColumn(columnId);
        if (!row || !column) return undefined;
        if (column.columnDef.fieldFn)
          return column.columnDef.fieldFn(row);
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
      startEditing(rowIndex, columnId) {
        return ctx.startEditing(rowIndex, columnId);
      },
      stopEditing(cancel) {
        return ctx.stopEditing(cancel ?? false);
      },
      selectCells(ranges) {
        // Multiple rectangles are supported. Empty array clears everything.
        if (!ranges || ranges.length === 0) {
          ctx.selectionRange = { anchor: null, focus: null };
          ctx.selectionRanges = [];
          return;
        }
        const rowCount = ctx.internalData.length;
        const colCount = ctx.allColumns.length;
        if (rowCount === 0 || colCount === 0) return;
        // Clamp to the visible grid bounds so callers can pass open-ended
        // values like `[0, 0, Infinity, Infinity]` to mean "select all".
        const toRange = ([r1, c1, r2, c2]: readonly [number, number, number, number]) => ({
          anchor: {
            rowIndex: Math.max(0, Math.min(rowCount - 1, Math.min(r1, r2))),
            colIndex: Math.max(0, Math.min(colCount - 1, Math.min(c1, c2))),
          },
          focus: {
            rowIndex: Math.max(0, Math.min(rowCount - 1, Math.max(r1, r2))),
            colIndex: Math.max(0, Math.min(colCount - 1, Math.max(c1, c2))),
          },
        });
        const built = ranges.map(toRange);
        // Last range is the active one; the rest are committed extras.
        ctx.selectionRanges = built.slice(0, -1);
        const active = built[built.length - 1]!;
        ctx.selectionRange = active;
        // Move the active cell to the last range's top-left so keyboard
        // navigation continues from there.
        ctx.setActiveCell(active.anchor.rowIndex, active.anchor.colIndex);
      },
      getSelected() {
        return ctx
          .getSelectionRects()
          .map((r: { minRow: number; minCol: number; maxRow: number; maxCol: number }) =>
            [r.minRow, r.minCol, r.maxRow, r.maxCol] as [number, number, number, number],
          );
      },
      openChart() {
        ctx.chartPanelOpen = true;
      },
      closeChart() {
        ctx.chartPanelOpen = false;
      },
      getChartSpec() {
        return ctx.chartSpec;
      },
      chartRange(ranges) {
        if (ranges && ranges.length) this.selectCells(ranges);
        ctx.chartPanelOpen = true;
      },
      configureChart(config) {
        if (ctx.chartingEnabled) ctx.applyChartConfig(config);
      },
      setChartAiHandler(handler) {
        ctx.chartAiHandler = handler ?? null;
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
      setOption(key, value) {
        // Runtime prop override. Writes into the controller's `optionOverrides`
        // store, which the effective-props proxy merges over the incoming prop, so
        // the grid re-renders exactly as if the parent had changed that prop.
        // `undefined` clears the override (falls back to the prop). Reassign the
        // whole object for reliable reactivity; `untrack` per the `setFilter` note.
        untrack(() => {
          const next: Record<string, unknown> = { ...ctx.optionOverrides };
          if (value === undefined) delete next[key as string];
          else next[key as string] = value;
          ctx.optionOverrides = next;
        });
      },
      getOption(key) {
        // The effective value: the override if set, otherwise the incoming prop.
        return (ctx.props as Record<string, unknown>)[key as string] as never;
      },
      resetOptions() {
        untrack(() => {
          ctx.optionOverrides = {};
        });
      },
      setFilter(columnId, filter) {
        // `untrack`: these imperative mutators read the same filter state they
        // write (read-modify-write on `filterMenuValues`). When a consumer
        // calls them from inside a reactive `$effect`, that internal read would
        // otherwise be captured as a dependency of the caller's effect, and the
        // write would re-dirty it - an infinite update loop. Untracking the
        // body keeps the API safe to drive from an effect.
        untrack(() => {
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
              // Optional second condition + join (multi-condition filtering).
              ...(filter.operator2
                ? {
                    operator2: filter.operator2,
                    value2: filter.value2 ?? "",
                    join: filter.join ?? "AND",
                    ...(filter.operator2 === "between"
                      ? { valueTo2: filter.valueTo2 ?? "" }
                      : {}),
                  }
                : {}),
            },
          };
        });
      },
      setFacetFilter(columnId, values) {
        // See `setFilter` for why the read-modify-write is untracked.
        untrack(() => {
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
        });
      },
      clearFilter(columnId) {
        ctx.clearColumnFilter(columnId);
      },
      refreshEditorOptions(columnId) {
        // Async `editorOptions` are cached per column (or per column+row for a
        // per-row source) so opening an editor twice does not refetch. This
        // drops those entries, so the next render re-runs the source - use it
        // when the underlying list changed server-side.
        if (columnId == null) {
          ctx.asyncEditorOptions = {};
          return;
        }
        const next = { ...ctx.asyncEditorOptions };
        for (const key of Object.keys(next)) {
          if (key === columnId || key.startsWith(`${columnId}::`)) delete next[key];
        }
        ctx.asyncEditorOptions = next;
      },
      clearAllFilters() {
        // See `setFilter` for why the read-modify-write is untracked.
        untrack(() => {
          // Wipe every filter surface in one go: column-menu, filter-row, set
          // filters, the global search box, and the advanced filter. This
          // promises "every filter surface", so leaving the advanced one set
          // would strand rows nobody can see a cause for.
          ctx.filterMenuValues = {};
          ctx.filterRowValues = {};
          ctx.valueFilters = {};
          if (ctx.globalFilter !== "") ctx.globalFilter = "";
          if (ctx.advancedFilter !== null) ctx.advancedFilter = null;
        });
      },
      setAdvancedFilter(expr) {
        // See `setFilter` for why the write is untracked.
        untrack(() => {
          ctx.advancedFilter = expr ?? null;
        });
      },
      getAdvancedFilter() {
        return ctx.advancedFilter ?? null;
      },
      clearAdvancedFilter() {
        untrack(() => {
          ctx.advancedFilter = null;
        });
      },
      isAdvancedFilterActive() {
        return ctx.advancedFilter != null && hasAdvancedFilterEngine();
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
        //
        // `isGroupRow` rather than a `subRows.length` test: a TREE parent also
        // has subRows, but it is a real data row that renders its own cells, so
        // dropping it here silently truncated every tree read - including the
        // enterprise export, whose default row source is this method.
        const out: TData[] = [];
        for (const row of ctx.allRows) {
          if (isGroupRow(row)) continue;
          out.push(row.original as TData);
        }
        return out;
      },
      getData() {
        return ctx.internalData;
      },
      getColumns() {
        // Snapshot every column with its human-readable label and
        // visibility flag. Used by external code (exporters, column
        // pickers) so they don't have to re-walk the columnDef tree.
        // Hidden columns ARE included (with `visible: false`) so a column
        // picker can re-enable them - callers that only want what's
        // rendered filter by `.visible` (e.g. the exporter does).
        const describe = (c: any, visible: boolean) => ({
          id: c.id,
          field: (c.columnDef as { field?: string }).field,
          header:
            typeof c.columnDef.header === "string"
              ? c.columnDef.header
              : c.id,
          visible,
          // Surface the format + alignment so exporters can reproduce the
          // on-screen display value (currency symbol, date pattern, etc.)
          // instead of dumping raw values. `getColumnAlign` applies the same
          // editorType-based default the body uses.
          format: c.columnDef.format,
          align: getColumnAlign(c),
          // The column's declared value type. Lets a filter or expression UI
          // offer the right operators (numeric ranges vs text matching) without
          // re-walking the columnDef tree.
          editorType: (c.columnDef as { editorType?: string }).editorType,
        });
        // Visible columns first, in their current visual order...
        const out = ctx.allColumns.map((c: any) => describe(c, true));
        // ...then any column hidden via `visible: false` / setColumnVisible.
        // Those aren't in `allColumns` (that list is visible-only), so pull
        // them straight from the engine's leaf set.
        const visibleIds = new Set(out.map((c: { id: string }) => c.id));
        for (const c of ctx.grid.getAllColumns() as any[]) {
          if (!visibleIds.has(c.id)) out.push(describe(c, false));
        }
        return out;
      },
      // ---- Free data export (CSV / TSV / JSON + clipboard) -----------------
      async exportCsv(options: GridExportOptions = {}) {
        const { serializeDelimited, downloadTextFile } = await import("./export-format");
        const { records, fields } = await projectForExport(
          options.rows ?? "displayed",
          options.columns,
          options.rawValues,
        );
        const text = await serializeDelimited(records, fields, {
          csv: { delimiter: ",", bom: options.bom ?? true },
          signal: options.signal,
          onProgress: options.onProgress,
        });
        if (options.download !== false)
          downloadTextFile(text, `${options.filename ?? "grid"}.csv`, "text/csv;charset=utf-8");
        return text;
      },
      async exportTsv(options: GridExportOptions = {}) {
        const { serializeDelimited, downloadTextFile } = await import("./export-format");
        const { records, fields } = await projectForExport(
          options.rows ?? "displayed",
          options.columns,
          options.rawValues,
        );
        const text = await serializeDelimited(records, fields, {
          csv: { delimiter: "\t", bom: options.bom ?? true },
          signal: options.signal,
          onProgress: options.onProgress,
        });
        if (options.download !== false)
          downloadTextFile(text, `${options.filename ?? "grid"}.tsv`, "text/tab-separated-values;charset=utf-8");
        return text;
      },
      async exportJson(options: GridExportOptions = {}) {
        const { serializeJson, downloadTextFile } = await import("./export-format");
        const { records, fields } = await projectForExport(
          options.rows ?? "displayed",
          options.columns,
          options.rawValues,
        );
        const text = await serializeJson(records, fields, {
          signal: options.signal,
          onProgress: options.onProgress,
        });
        if (options.download !== false)
          downloadTextFile(text, `${options.filename ?? "grid"}.json`, "application/json");
        return text;
      },
      async copyToClipboard(options: GridClipboardOptions = {}) {
        const { serializeDelimited, serializeMarkdown, copyTextToClipboard } = await import("./export-format");
        const { records, fields, align } = await projectForExport(
          options.rows ?? "displayed",
          options.columns,
          options.rawValues,
        );
        const format = options.format ?? "tsv";
        const text =
          format === "markdown"
            ? await serializeMarkdown(records, fields, { align })
            : await serializeDelimited(records, fields, {
                csv: { delimiter: format === "csv" ? "," : "\t", bom: false },
              });
        await copyTextToClipboard(text);
        return text;
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
      autosizeColumn(columnId: string) {
        ctx.autosizeColumn(columnId);
      },
      autosizeAllColumns() {
        ctx.autosizeAllColumns();
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
        const maxIndex = Math.max(0, ctx.allRows.length - 1);
        const clamped = Math.max(0, Math.min(rowIndex, maxIndex));
        // Logical offset from the virtualizer (honors uniform OR per-row
        // sizing), then mapped into the capped DOM scroll space so it lands
        // correctly on huge grids where the DOM height is scaled down.
        const logical = ctx.virtualizer.getOffsetForIndex(clamped);
        ctx.scrollContainer.scrollTop = ctx.logicalToDomRowOffset(logical);
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
          // Emitted only when set. `attachAutoSavedView` diffs
          // JSON.stringify(getState()) on a timer, so adding an always-present
          // key would change every existing snapshot and force one spurious
          // save in every app on upgrade.
          ...(ctx.advancedFilter ? { advancedFilter: ctx.advancedFilter } : {}),
          ...(ctx.chartingEnabled
            ? {
                chart: {
                  open: ctx.chartPanelOpen,
                  type: ctx.chartType,
                  dimension: ctx.chartDimensionId,
                  series: ctx.chartSeriesId,
                  measure: ctx.chartMeasureId,
                  reduce: ctx.chartReduce,
                  stacked: ctx.chartStacked,
                },
                charts: ctx.getChartsState(),
                chartActive: ctx.activeChartIndex,
              }
            : {}),
        };
      },
      setState(state) {
        if (state.sorting) {
          const sorting = state.sorting.map((s) => ({ id: s.id, desc: s.desc }));
          ctx.grid.store.setState((prev: any) => ({ ...prev, sorting }));
        }
        if (state.grouping) {
          // Drop grouping by columns that no longer exist (#53) - otherwise a
          // saved view collapses every row into a group named 'undefined'.
          const existing = new Set((ctx.grid.getAllColumns() as any[]).map((c) => c.id));
          ctx.grid.setGrouping(state.grouping.filter((id: string) => existing.has(id)));
        }
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
          // Seed from columns declared `visible: false` so a partial/empty saved
          // state never un-hides an app-declared-hidden column (#54); then layer
          // the saved user-driven hides on top.
          const next: Record<string, boolean> = { ...ctx.declaredHiddenColumns };
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
        // `in` rather than a truthiness check, so an explicit null clears while
        // an absent key leaves the current filter alone (the documented
        // "only the keys present are applied" contract).
        if ("advancedFilter" in state) {
          ctx.advancedFilter = state.advancedFilter ?? null;
        }
        if ((state.chart || state.charts) && ctx.chartingEnabled) {
          if (Array.isArray(state.charts) && state.charts.length) {
            ctx.applyChartsState(state.charts, state.chartActive);
          }
          if (state.chart) {
            const c = state.chart;
            ctx.chartPanelOpen = c.open;
            ctx.chartType = c.type;
            ctx.chartDimensionId = c.dimension;
            ctx.chartSeriesId = c.series;
            ctx.chartMeasureId = c.measure;
            ctx.chartReduce = c.reduce;
            ctx.chartStacked = c.stacked;
          }
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
