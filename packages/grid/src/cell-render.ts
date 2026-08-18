// cell-render handlers extracted from the controller. Imperative event handlers
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

export function createCellRender<
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
>(ctx: any) {
  function cellConditionalFormat(
    row: Row<TData>,
    column: Column<TData>,
    value: unknown,
  ): ResolvedCellFormat | null {
    const formats = ctx.props.conditionalFormats;
    if (!formats?.length) return null;
    return resolveCellFormat(
      value,
      row.original,
      column.id,
      formats,
      ctx.conditionalColumnStats.get(column.id) ?? null,
    );
  }

  /** Compute the consumer-supplied row class for one rendered row. */
  function computeRowClass(row: Row<TData>, rowIndex: number): string {
    if (!ctx.props.rowClass) return "";
    return resolveClassList(
      ctx.props.rowClass({ row: row.original as TData, rowIndex }),
    );
  }

  /** Compute the consumer-supplied cell class for one rendered cell. */
  function computeCellClass(row: Row<TData>, column: Column<TData>): string {
    const raw = column.columnDef.cellClass;
    if (raw == null) return "";
    if (typeof raw === "string" || Array.isArray(raw)) {
      return resolveClassList(raw);
    }
    if (typeof raw === "function") {
      // Build a minimal CellContext - the only fields the wrapper-side
      // cellClass author needs are `row` and `column`. Callers can read
      // `ctx.row.original` and `ctx.column.id` exactly like in a `cell`
      // renderer. The other fields are stubbed for compatibility.
      const cellCtx = {
        row,
        column,
        cell: undefined as any,
        table: undefined as any,
        getValue: () => row.getCellValueByColumnId(column.id),
      };
      return resolveClassList(raw(cellCtx as any));
    }
    return "";
  }

  /**
   * Resolve the per-cell tooltip. Column-level `tooltip` field can be a
   * plain string (rendered as `title=`) or a `(ctx) => string` callback
   * for value-dependent text. Returning empty / nullish means no
   * tooltip - the renderer omits the `title=` attribute entirely.
   */
  function computeCellTooltip(row: Row<TData>, column: Column<TData>): string | null {
    const raw = column.columnDef.tooltip
    if (raw == null) return null
    if (typeof raw === "string") return raw || null
    if (typeof raw === "function") {
      const ctx = {
        row,
        column,
        cell: undefined as any,
        table: undefined as any,
        getValue: () => row.getCellValueByColumnId(column.id),
      }
      const out = (raw as any)(ctx)
      return out ? String(out) : null
    }
    return null
  }

  /**
   * Resolve per-cell validity via the column's declarative `validate` hook.
   * Runs for every rendered cell so pre-existing bad data is flagged on load.
   * Returns `{ invalid, message }` - `invalid` drives the red highlight class,
   * `message` (when present) becomes the cell's tooltip.
   */
  function computeCellValidity(
    row: Row<TData>,
    column: Column<TData>,
  ): { invalid: boolean; message: string | null } {
    const rule = column.columnDef.validate as
      | ((params: {
          value: unknown
          row: TData
          rowIndex: number
          column: Column<TData>
        }) => string | boolean | null | undefined)
      | undefined
    if (typeof rule !== "function") return { invalid: false, message: null }
    // Read the edit-aware value: inline edits land in `editedCellValues`
    // (keyed rowId:colId) and are NOT written into the row's memoized value
    // cache, so `getCellValueByColumnId` would return the stale pre-edit value
    // and validation would never re-run after an edit. Consult the overlay
    // first - same rule the display path (getCellDisplayValue) and summaries
    // use - so a cell re-validates live as the user types.
    const edited = ctx.editedCellValues ?? {}
    const key = getCellKey(row.id, column.id)
    const value =
      key in edited ? edited[key] : row.getCellValueByColumnId(column.id)
    const out = rule({
      value,
      row: row.original as TData,
      rowIndex: row.index,
      column,
    })
    // Valid: null / undefined / true. Invalid: false or a message string.
    if (out == null || out === true) return { invalid: false, message: null }
    if (out === false) return { invalid: true, message: null }
    const msg = String(out)
    return { invalid: true, message: msg.trim() ? msg : null }
  }

  /**
   * Resolve a per-cell note (a longer comment / annotation). Notes
   * come from the grid's `notes` prop - a `{ [rowId]: { [columnId]: string } }`
   * map - so the consumer keeps note storage. Returning non-empty
   * paints a corner indicator AND becomes the cell's tooltip text.
   */
  function computeCellNote(row: Row<TData>, column: Column<TData>): string | null {
    // Internal overlay (from the comment editor) wins over props.notes so
    // edits show immediately even when `notes` is controlled. An empty
    // overlay entry means "removed".
    const ov = ctx.noteOverrides?.[row.id]?.[column.id]
    if (ov !== undefined) return ov.trim() ? ov : null
    const map = ctx.props.notes
    if (!map) return null
    const byCol = map[row.id]
    if (!byCol) return null
    const v = byCol[column.id]
    return v && v.trim() ? v : null
  }

  const isThenable = (v: unknown): v is Promise<unknown> =>
    typeof (v as { then?: unknown } | null)?.then === "function";

  /**
   * Resolve a promised option list once per key, then keep it.
   *
   * Render paths call `getColumnEditorOptions` synchronously and often, so an
   * async source cannot block: the first call starts the fetch and returns an
   * empty list, and the resolved value lands in reactive state which re-renders
   * the editor. `asyncEditorOptionsPending` tracks in-flight keys so repeated
   * renders do not fire the request again.
   */
  function resolveAsyncOptions(
    key: string,
    promise: Promise<unknown>,
    /** Drop other cached entries starting with this prefix when the result
     *  lands - used to evict a cascade's superseded signatures. */
    prunePrefix?: string,
  ): CellEditorOption[] {
    const done = ctx.asyncEditorOptions[key];
    if (done) return done;
    const pending: Set<string> = ctx.asyncEditorOptionsPending;
    if (!pending.has(key)) {
      // Plain Set, not reactive state: this runs inside the template, and a
      // $state write during render is a Svelte 5 error.
      pending.add(key);
      const store = (value: CellEditorOption[]) => {
        const next: Record<string, CellEditorOption[]> = {};
        for (const [k, v] of Object.entries(ctx.asyncEditorOptions as Record<string, CellEditorOption[]>)) {
          // Keep everything except this cell's stale signatures.
          if (prunePrefix && k !== key && k.startsWith(prunePrefix)) continue;
          next[k] = v;
        }
        next[key] = value;
        ctx.asyncEditorOptions = next;
      };
      promise
        .then((value) => store(normalizeEditorOptions(value as never)))
        // A failed lookup settles on "no options" rather than leaving the
        // editor spinning forever.
        .catch(() => store([]))
        .finally(() => {
          pending.delete(key);
        });
    }
    return [];
  }

  /**
   * Cache key for a per-row async source.
   *
   * A cascade depends on the row's OTHER cells - City is a function of Country -
   * so keying by row id alone made the first result permanent: changing the
   * country left the old city list cached forever. The row's own values are
   * folded into the key, so editing the row naturally supersedes the entry.
   *
   * Only reached for columns already known to be async, so the stringify cost
   * is bounded by the rows actually rendering such a column.
   */
  function asyncRowKey(column: Column<TData>, row: Row<TData>): string {
    let signature: string;
    try {
      signature = JSON.stringify(row.original);
    } catch {
      // Circular / non-serializable row: fall back to identity, which at least
      // invalidates when the consumer replaces the object immutably.
      signature = String(row.index);
    }
    return `${column.id}::${row.id}::${signature}`;
  }

  function getColumnEditorOptions(
    column: Column<TData>,
    row?: Row<TData> | null,
  ): CellEditorOption[] {
    const def = column.columnDef.editorOptions;
    if (typeof def === "function") {
      // Dynamic per-row: must be re-evaluated because the row's other
      // cells may have just changed (cascade).
      if (!row?.original) return [];
      // Once a column is known to hand back promises, answer from the cache
      // WITHOUT calling the source again. Render reads options constantly, so
      // calling an async source every time fires a real request per render -
      // and any state the source touches is being mutated mid-render, which
      // Svelte rejects outright. The key folds in the row's values, so editing
      // the row supersedes the entry and the cascade refetches.
      const known = (ctx.asyncEditorColumns as Set<string>).has(column.id);
      if (known) {
        const key = asyncRowKey(column, row);
        const done = ctx.asyncEditorOptions[key];
        if (done) return done;
        if ((ctx.asyncEditorOptionsPending as Set<string>).has(key)) return [];
        const produced = def(row.original as TData);
        if (isThenable(produced)) {
          return resolveAsyncOptions(key, produced, `${column.id}::${row.id}::`);
        }
        return normalizeEditorOptions(produced);
      }
      const produced = def(row.original as TData);
      if (isThenable(produced)) {
        (ctx.asyncEditorColumns as Set<string>).add(column.id);
        return resolveAsyncOptions(
          asyncRowKey(column, row),
          produced,
          `${column.id}::${row.id}::`,
        );
      }
      return normalizeEditorOptions(produced);
    }
    if (isThenable(def)) return resolveAsyncOptions(column.id, def);
    const id = column.id;
    if (
      !ctx.editorOptionsCache[id] ||
      ctx.editorOptionsCache[id + "__src"] !== (def as unknown as object)
    ) {
      ctx.editorOptionsCache[id] = normalizeEditorOptions(def);
      (ctx.editorOptionsCache as Record<string, unknown>)[id + "__src"] = def;
    }
    return ctx.editorOptionsCache[id];
  }

  /**
   * True while a column's (or cell's) async option list is still loading.
   * Derived from "the source is async and no result has landed" rather than
   * from the pending Set, so it stays reactive - `asyncEditorOptions` is the
   * reactive half, the Set is only a dedupe guard.
   */
  function areEditorOptionsLoading(
    column: Column<TData>,
    row?: Row<TData> | null,
  ): boolean {
    const def = column.columnDef.editorOptions;
    if (typeof def === "function") {
      if (!row?.original) return false;
      // Never call the source here - that would fire another request just to
      // answer "are we loading?". The resolver records which columns are async.
      if (!(ctx.asyncEditorColumns as Set<string>).has(column.id)) return false;
      return !ctx.asyncEditorOptions[asyncRowKey(column, row)];
    }
    return isThenable(def) && !ctx.asyncEditorOptions[column.id];
  }

  /** Joined display string for list/chips cells. */
  function formatListCellValue(
    column: Column<TData>,
    value: unknown,
    row?: Row<TData> | null,
  ): string {
    const options = getColumnEditorOptions(column, row);
    const sep = column.columnDef.editorSeparator ?? ", ";
    if (Array.isArray(value)) {
      return value.map((v) => getOptionLabel(options, v)).join(sep);
    }
    if (value == null || value === "") return "";
    return getOptionLabel(options, value);
  }

  function formatCellValue(
    column: Column<TData>,
    value: unknown,
    row: Row<TData>,
  ) {
    const formatter = column.columnDef.formatter as
      | CellFormatter<TData>
      | undefined;
    if (typeof formatter === "function") {
      const formatted = formatter({ value, row, column, table: ctx.grid });
      return String(formatted ?? "");
    }

    // Password columns: mask the stored value with bullets when the cell
    // is in read-only mode. The editor still receives the real string.
    if (column.columnDef.editorType === "password") {
      const s = String(value ?? "");
      return s.length > 0 ? "•".repeat(Math.min(s.length, 12)) : "";
    }

    const formatConfig = column.columnDef.format as
      | CellFormatConfig
      | undefined;
    if (!formatConfig) return String(value ?? "");

    if (
      formatConfig.type === "number" ||
      formatConfig.type === "currency" ||
      formatConfig.type === "percent"
    ) {
      return formatNumericWithConfig(value, {
        type: formatConfig.type,
        locales: (formatConfig.locales ?? ctx.props.localization?.locale),
        currency:
          formatConfig.type === "currency"
            ? (formatConfig.currency ?? "USD")
            : undefined,
        valueIsPercentPoints:
          formatConfig.type === "percent"
            ? formatConfig.valueIsPercentPoints
            : undefined,
        options: formatConfig.options,
      });
    }

    if (formatConfig.type === "date" || formatConfig.type === "datetime") {
      const parsedDate = asDate(value);
      if (parsedDate) {
        const preset = resolveDatePattern(
          formatConfig.pattern,
          formatConfig.type,
        );
        const merged: Intl.DateTimeFormatOptions =
          preset || formatConfig.options
            ? { ...preset, ...formatConfig.options }
            : formatConfig.type === "date"
              ? { year: "numeric", month: "2-digit", day: "2-digit" }
              : {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                };

        return getDateFormatter((formatConfig.locales ?? ctx.props.localization?.locale), merged).format(
          parsedDate,
        );
      }
    }

    return String(value ?? "");
  }

  /**
   * Format a cell value for a PINNED row. Same surface as
   * `formatCellValue` but doesn't depend on Row<TData>. Custom
   * `formatter` callbacks are invoked with a `row` of `null` (their
   * type allows it; most don't read it).
   */
  function formatPinnedValue(
    column: Column<TData>,
    value: unknown,
  ): string {
    const def = column.columnDef;
    const formatter = def.formatter as
      | ((ctx: { value: unknown; row: null; column: Column<TData>; table: unknown }) => unknown)
      | undefined;
    if (typeof formatter === "function") {
      return String(
        formatter({ value, row: null, column, table: ctx.grid }) ?? "",
      );
    }
    if (def.editorType === "password") {
      const s = String(value ?? "");
      return s.length > 0 ? "•".repeat(Math.min(s.length, 12)) : "";
    }
    const formatConfig = def.format as CellFormatConfig | undefined;
    if (!formatConfig) return String(value ?? "");
    if (
      formatConfig.type === "number" ||
      formatConfig.type === "currency" ||
      formatConfig.type === "percent"
    ) {
      return formatNumericWithConfig(value, {
        type: formatConfig.type,
        locales: (formatConfig.locales ?? ctx.props.localization?.locale),
        currency:
          formatConfig.type === "currency"
            ? (formatConfig.currency ?? "USD")
            : undefined,
        valueIsPercentPoints:
          formatConfig.type === "percent"
            ? formatConfig.valueIsPercentPoints
            : undefined,
        options: formatConfig.options,
      });
    }
    if (formatConfig.type === "date" || formatConfig.type === "datetime") {
      const parsedDate = asDate(value);
      if (parsedDate) {
        const preset = resolveDatePattern(formatConfig.pattern, formatConfig.type);
        const merged: Intl.DateTimeFormatOptions =
          preset || formatConfig.options
            ? { ...preset, ...formatConfig.options }
            : formatConfig.type === "date"
              ? { year: "numeric", month: "2-digit", day: "2-digit" }
              : { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" };
        return getDateFormatter((formatConfig.locales ?? ctx.props.localization?.locale), merged).format(parsedDate);
      }
    }
    return String(value ?? "");
  }

  /**
   * Resolve `cellClass` for a pinned row. We synthesise a minimal
   * context `{ getValue, value, row: null, column }`; cell-class
   * callbacks that read only the value (the common case) work
   * unchanged.
   */
  function computePinnedCellClass(
    rowData: TData,
    column: Column<TData>,
  ): string {
    const cellClass = column.columnDef.cellClass as
      | ((ctx: { getValue: () => unknown; value: unknown; row: null; column: Column<TData> }) => string | undefined | null)
      | undefined;
    if (typeof cellClass !== "function") return "";
    const value = getPinnedCellValue(rowData, column);
    const out = cellClass({ getValue: () => value, value, row: null, column });
    return out ? String(out) : "";
  }

  return {
    cellConditionalFormat,
    computeRowClass,
    computeCellClass,
    computeCellTooltip,
    computeCellValidity,
    computeCellNote,
    getColumnEditorOptions,
    areEditorOptionsLoading,
    formatListCellValue,
    formatCellValue,
    formatPinnedValue,
    computePinnedCellClass,
  };
}
