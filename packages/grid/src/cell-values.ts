// Pure column/cell value access + display-formatting helpers. They operate
// only on their Column/Row/data arguments (plus the numeric formatter), so
// they hold no grid state and live outside the controller.
import type {
  CellFormatConfig,
  Column,
  ColumnDef,
  Row,
  RowData,
  TableFeatures,
} from "./index";
import { formatNumericWithConfig } from "./cell-formatting";

export function getColumnBaseValue<TData extends RowData>(row: Row<TData>, column: Column<TData>) {
  const def = column.columnDef;
  if (def.fieldFn) return def.fieldFn(row.original);
  if (def.field) return row.original[def.field];
  return row.getCellValueByColumnId(column.id);
}

export function isGroupRow<TData extends RowData>(row: Row<TData>) {
  return typeof row.getCanExpand === "function" && row.getCanExpand();
}

export function toolPanelHeaderLabel<TData extends RowData>(column: Column<TData>): string {
  const h = column.columnDef.header;
  return typeof h === "string" ? h : column.id;
}

/** Apply the column's `format` config to a raw numeric summary value
 *  (sum / avg / etc.). Mirrors the currency/number/percent branches in
 *  `formatCellValue` so a totaled salary column shows "$1,234,567" in
 *  the footer instead of "1234567". Per-row `formatter` functions are
 *  intentionally NOT invoked here - they may close over row state. */
export function formatSummaryNumeric<TData extends RowData>(column: Column<TData>, value: number): string {
  const formatConfig = column.columnDef.format as
    | CellFormatConfig
    | undefined;
  if (
    formatConfig &&
    (formatConfig.type === "number" ||
      formatConfig.type === "currency" ||
      formatConfig.type === "percent")
  ) {
    return formatNumericWithConfig(value, {
      type: formatConfig.type,
      locales: formatConfig.locales,
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
  return String(value);
}

/**
 * Effective horizontal alignment for a column. Honors the explicit
 * `align` prop on the ColumnDef; otherwise picks a sensible default
 * based on `editorType`:
 *   number / date / datetime → 'right'
 *   checkbox                 → 'center'
 *   everything else          → 'left'
 */
export function getColumnAlign<TData extends RowData>(column: Column<TData>): "left" | "center" | "right" {
  const explicit = column.columnDef.align;
  if (explicit) return explicit;
  const editorType = column.columnDef.editorType;
  if (
    editorType === "number" ||
    editorType === "date" ||
    editorType === "datetime"
  ) {
    return "right";
  }
  if (editorType === "checkbox") return "center";
  return "left";
}

/**
 * Read a cell value from a PINNED row. Pinned rows aren't bound to a
 * TanStack Row<TData>, so we resolve the value directly off the raw
 * TData via `fieldFn` or `field`. Mirrors `getColumnBaseValue`'s
 * lookup path minus the Row indirection.
 */
export function getPinnedCellValue<TData extends RowData>(
  rowData: TData,
  column: Column<TData>,
): unknown {
  const def = column.columnDef;
  if (def.fieldFn) return def.fieldFn(rowData);
  const field = def.field as string | undefined;
  if (!field) return undefined;
  return (rowData as unknown as Record<string, unknown>)[field];
}

export function getColumnAccessorValue<TData extends RowData>(rowData: TData, column: Column<TData>) {
  const def = column.columnDef;
  if (def.fieldFn) return def.fieldFn(rowData);
  if (def.field) return rowData[def.field];
  return undefined;
}

export function columnDefMatchesId<TFeatures extends TableFeatures, TData extends RowData>(
  def: ColumnDef<TFeatures, TData>,
  columnId: string,
): boolean {
  return (def.id ?? def.field ?? null) === columnId;
}
