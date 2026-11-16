// summaries handlers extracted from the controller. Imperative event handlers
// reading/writing controller state via the `ctx` handle; the reactive core
// ($state/$derived/$effect) stays in the controller.
import {
  applyGroupAggregate,
  type Column,
  type Row,
  type RowData,
  type TableFeatures,
} from "./index";
import "./sv-grid-scrollbar";
import { isWindowedData } from "./windowed-brand";
import { loadedRows } from "./selection";
import {
  getCellKey,
} from "./SvGrid.helpers";
import {
  formatSummaryNumeric,
  isGroupRow,
} from "./cell-values";

export function createSummaries<
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
>(ctx: any) {
  /**
   * Aggregate every row into a per-column footer summary (sum for numeric
   * columns, `Count: N` otherwise). This loop is the hottest path on a
   * large grid - it is rows x columns iterations - so two things keep the
   * constant factor down:
   *
   *   1. The edited-cell overlay is only consulted when an edit actually
   *      exists. `key in editedCellValues` hits a reactive-proxy `has`
   *      trap for every cell otherwise - 5M no-op trap calls on a
   *      100k x 50 grid. Skipping it when the map is empty is the single
   *      biggest win here.
   *   2. The column's accessor (`fieldFn` / `field`) is resolved once
   *      per column, not re-read off `columnDef` for every cell.
   */
  function computeSummaries(
    rows: ReadonlyArray<Row<TData>>,
    columns: ReadonlyArray<Column<TData>>,
  ): Record<string, string> {
    // Windowed rows (a server row model) are mostly placeholders, which hold no
    // values: only the loaded rows can add anything. Walking every index built a
    // row for each of a million entries and held the page for over a second on
    // each scroll. The entries not loaded still count as records.
    let rowCount: number;
    if (isWindowedData(rows)) {
      const total = rows.length;
      const loaded = loadedRows(rows as Array<Row<TData>>);
      rows = recordsOf(loaded, ctx.advancedKeep);
      rowCount = rows.length + (total - loaded.length);
    } else {
      rows = recordsOf(rows, ctx.advancedKeep);
      rowCount = rows.length;
    }
    const walked = rows.length;
    const summary: Record<string, string> = {};
    const hasEdits = Object.keys(ctx.editedCellValues).length > 0;
    for (const column of columns) {
      const def = column.columnDef;
      const fieldFn = def.fieldFn;
      const field = def.field;
      const columnId = column.id;

      // A column that declares its own `summary` opts out of the default
      // sum/count below. Only that column pays for the aggregator dispatch, so
      // a grid that declares none keeps the original hot loop exactly as it was.
      const declared = def.summary;
      if (declared !== undefined) {
        if (declared === false) {
          summary[columnId] = "";
          continue;
        }
        const value = applyGroupAggregate(declared, columnId, rows);
        summary[columnId] =
          typeof value === "number" && Number.isFinite(value)
            ? formatSummaryNumeric(column, value)
            : value == null
              ? ""
              : String(value);
        continue;
      }

      let numericSum = 0;
      let numericCount = 0;
      for (let i = 0; i < walked; i += 1) {
        const row = rows[i]!;
        let value: unknown;
        const base = fieldFn
          ? fieldFn(row.original)
          : field
            ? (row.original as Record<string, unknown>)[field]
            : row.getCellValueByColumnId(columnId);
        if (hasEdits) {
          const key = getCellKey(row.id, columnId);
          value = key in ctx.editedCellValues ? ctx.editedCellValues[key] : base;
        } else {
          value = base;
        }
        const asNumber = Number(value);
        if (Number.isFinite(asNumber)) {
          numericSum += asNumber;
          numericCount += 1;
        }
      }
      summary[columnId] =
        numericCount > 0
          ? formatSummaryNumeric(column, numericSum)
          : `Count: ${rowCount}`;
    }
    return summary;
  }

  /**
   * Grouped, the footer totals the records, not the banners: an expanded group's
   * records follow it in the list, a collapsed one's are read from its subRows
   * (through the advanced filter, which tested only what was in the list).
   */
  function recordsOf(rows: ReadonlyArray<Row<TData>>, keep: ((row: Row<TData>) => boolean) | null): ReadonlyArray<Row<TData>> {
    let grouped = false;
    for (const row of rows) {
      if (isGroupRow(row)) {
        grouped = true;
        break;
      }
    }
    if (!grouped) return rows;
    const out: Array<Row<TData>> = [];
    const leaves = (row: Row<TData>) => {
      for (const sub of row.subRows ?? []) {
        if (isGroupRow(sub)) leaves(sub);
        else if (!keep || keep(sub)) out.push(sub);
      }
    };
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]!;
      // Subtotal rows (a clone of their banner, or a row model's own) are not records.
      if ((row as { __groupFooter?: boolean }).__groupFooter || (row.original as { __groupFooter?: boolean } | null)?.__groupFooter) continue;
      if (!isGroupRow(row)) {
        out.push(row);
        continue;
      }
      const next = rows[i + 1];
      if (next && (next.depth ?? 0) > (row.depth ?? 0)) continue;
      // A group whose rows are not loaded (a server row model) totals as itself.
      if (row.subRows) leaves(row);
      else out.push(row);
    }
    return out;
  }

  function hasRenderedColumn(entry: {
    item: (typeof ctx.renderedColumnItems)[number];
    column: (typeof ctx.allColumns)[number] | undefined;
  }): entry is {
    item: (typeof ctx.renderedColumnItems)[number];
    column: (typeof ctx.allColumns)[number];
  } {
    return entry.column !== undefined;
  }

  return {
    computeSummaries,
    hasRenderedColumn,
  };
}
