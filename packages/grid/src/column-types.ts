// Column data types. `cellDataType` (declared, or inferred with the grid's
// `inferColumnTypes`) is what the values are: sorting, filter operators,
// alignment and bucketing read it through `columnDataType`. `editorType` is
// only what edits them, so a number column can use any editor. A column
// with no `editorType` gets the usual one for its type, and a `format` for
// dates.
//
// Anything set explicitly on the ColumnDef always wins; this only fills gaps.
// Resolution happens once when columns are ingested, producing plain ColumnDef
// objects.
export type CellDataType = "text" | "number" | "boolean" | "date" | "dateString";

type TypeDefaults = {
  editorType: string;
  format?: { type: string };
};

function defaultsFor(dt: CellDataType): TypeDefaults {
  switch (dt) {
    case "number":
      return { editorType: "number" };
    case "boolean":
      return { editorType: "checkbox" };
    case "date":
      return { editorType: "date", format: { type: "date" } };
    case "dateString":
      // ISO date strings ('2026-06-27') - date editor, but no Date coercion.
      return { editorType: "date" };
    case "text":
    default:
      return { editorType: "text" };
  }
}

/**
 * The column's data type: what sorting, filter operators, alignment and
 * bucketing go by, whatever edits the cell (a text box, a number input, a
 * registered editor). Declared with `cellDataType`; a column without one
 * keeps what its built-in `editorType` meant before: `number`, `date` /
 * `datetime`, `checkbox`.
 */
export function columnDataType(
  def: { cellDataType?: string; editorType?: string } | undefined,
): CellDataType | undefined {
  if (!def) return undefined;
  if (def.cellDataType) return def.cellDataType as CellDataType;
  const e = def.editorType;
  if (e === "number") return "number";
  if (e === "date" || e === "datetime") return "date";
  if (e === "checkbox") return "boolean";
  return undefined;
}

/** Date or ISO date string: sorts, filters and buckets as a date. */
export const isDateDataType = (t: CellDataType | undefined): boolean => t === "date" || t === "dateString";

/** Best-effort inference of a column's data type from a sample value. */
export function inferCellDataType(value: unknown): CellDataType | undefined {
  if (value == null) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return "number";
  if (typeof value === "boolean") return "boolean";
  if (value instanceof Date) return "date";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}([T\s]|$)/.test(value)) {
    return "dateString";
  }
  return "text";
}

/**
 * Resolve `cellDataType` (explicit or, when `infer` is on, inferred from
 * `sampleRow`) into concrete `editorType` / `format` defaults. Explicit fields
 * on the ColumnDef are preserved. Columns that resolve to no type are returned
 * untouched. Nested column groups are resolved recursively.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveColumnTypes(
  columns: ReadonlyArray<any>,
  sampleRow: unknown,
  infer: boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  return columns.map((col) => {
    // Recurse into header groups first.
    if (col.columns && col.columns.length) {
      return { ...col, columns: resolveColumnTypes(col.columns, sampleRow, infer) };
    }
    // Infer only what is unknown: no `cellDataType`, and no built-in editor
    // that implies one (`number`, `date`, `checkbox`). A column edited in a
    // text box or a custom editor still gets its data type from the data.
    let dt: CellDataType | undefined = col.cellDataType;
    if (!dt && infer && !columnDataType(col) && sampleRow != null) {
      const field = col.field;
      const raw =
        col.fieldFn?.(sampleRow) ??
        (typeof field === "string" ? (sampleRow as Record<string, unknown>)[field] : undefined);
      dt = inferCellDataType(raw);
    }
    if (!dt) return col;
    const d = defaultsFor(dt);
    return {
      ...col,
      // Kept on the column: sorting, filtering and alignment read it.
      cellDataType: dt,
      editorType: col.editorType ?? d.editorType,
      format: col.format ?? d.format,
    };
  });
}
