// cellDataType resolution. A column's `cellDataType` (or grid-level
// `inferColumnTypes`) is a high-level shorthand that fills in `editorType`,
// `format`, and - transitively, via `getColumnAlign` and the filter-operator
// tables, which both key off `editorType` - alignment and filter operators.
//
// Anything set explicitly on the ColumnDef always wins; this only fills gaps.
// Resolution happens once when columns are ingested, producing plain ColumnDef
// objects, so every downstream reader (editing, filtering, formatting,
// alignment) sees a normal column with no new code paths.
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
    // An explicit editorType means the author already chose - don't override.
    const hasExplicitEditor = col.editorType != null;
    let dt: CellDataType | undefined = col.cellDataType;
    if (!dt && infer && !hasExplicitEditor && sampleRow != null) {
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
      editorType: col.editorType ?? d.editorType,
      format: col.format ?? d.format,
    };
  });
}
