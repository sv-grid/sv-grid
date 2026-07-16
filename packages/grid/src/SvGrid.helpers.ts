// Pure, stateless helper functions extracted from SvGrid.svelte. None of
// these close over component state - they operate only on their arguments
// (plus DOM/Intl globals), so they live here to keep the component leaner.
import type { CellEditorType, CellEditorOption } from "./index";
import type { ResolvedCellFormat } from "./conditional-formatting";

export function cfTextStyle(cf: ResolvedCellFormat): string {
  let s = "";
  if (cf.color) s += `color:${cf.color};`;
  if (cf.fontWeight != null) s += `font-weight:${cf.fontWeight};`;
  return s;
}

export function fmtStat(n: number): string {
  return Number.isInteger(n)
    ? n.toLocaleString()
    : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function getCellKey(rowId: string, columnId: string) {
  return `${rowId}:${columnId}`;
}

/**
 * Normalise the return value of a `cellClass` / `rowClass` callback
 * (or a static `cellClass` field) into a single space-separated
 * class string. Accepts: string, string[], Record<string, boolean>,
 * null/undefined. Anything else returns ''.
 */
export function resolveClassList(
  value:
    | string
    | ReadonlyArray<string>
    | Record<string, boolean>
    | undefined
    | null,
): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.filter(Boolean).join(" ");
  if (typeof value === "object") {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(value)) if (v) parts.push(k);
    return parts.join(" ");
  }
  return "";
}

export function toDateInputValue(value: unknown) {
  if (value == null || value === "") return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return value;
  const parsed =
    value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

export function toDateTimeLocalInputValue(value: unknown) {
  if (value == null || value === "") return "";
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
  )
    return value;
  const parsed =
    value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 16);
}

/** Strip the `-native` opt-out suffix so the native-input helpers treat
 *  `date-native` exactly like `date` (the rich pickers own the bare types). */
function baseEditor(editorType: CellEditorType): string {
  return String(editorType).replace(/-native$/, "");
}

/** 'HH:MM[:SS]' string (or Date) to a Date carrying that time (today's date). */
export function timeStringToDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const m = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
      const d = new Date();
      d.setHours(Math.min(23, +m[1]!), Math.min(59, +m[2]!), m[3] ? +m[3] : 0, 0);
      return d;
    }
  }
  return null;
}

/** A Date to an 'HH:MM' string (the `time` editor's stored form). */
export function dateToTimeString(d: Date | null): string | null {
  if (!d) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function getEditableInputValue(editorType: CellEditorType, value: unknown) {
  const base = baseEditor(editorType);
  if (base === "date") return toDateInputValue(value);
  if (base === "datetime") return toDateTimeLocalInputValue(value);
  return String(value ?? "");
}

export function getEditorInputType(editorType: CellEditorType) {
  const base = baseEditor(editorType);
  if (base === "number") return "number";
  if (base === "date") return "date";
  if (base === "datetime") return "datetime-local";
  if (base === "time") return "time";
  if (base === "password") return "password";
  if (base === "color") return "color";
  return "text";
}

/** Resolve a stored value to an array form (for list/chips multi-select). */
export function toValueArray(value: unknown): Array<string | number> {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) {
    return value.filter((v) => v != null && v !== "") as Array<
      string | number
    >;
  }
  return [value as string | number];
}

/** Look up the display label for a given option value. */
export function getOptionLabel(options: CellEditorOption[], value: unknown): string {
  const match = options.find(
    (o) => o.value === value || String(o.value) === String(value),
  );
  return match ? match.label : String(value ?? "");
}

/** Look up the configured `color` for a value (for colorful chips). */
export function getOptionColor(
  options: CellEditorOption[],
  value: unknown,
): string | undefined {
  const match = options.find(
    (o) => o.value === value || String(o.value) === String(value),
  );
  return match?.color;
}

/** Build a theme-aware inline `style` string for a colorful chip. The
 *  color value can be any CSS color (hex, rgb, hsl, oklch, named).
 *  We tint the background and border via `color-mix` so the chip stays
 *  readable on light AND dark themes, and use the color itself as the
 *  text color for a soft-pill look (à la GitHub labels). */
export function colorfulChipStyle(color: string | undefined): string {
  if (!color) return "";
  return (
    `background: color-mix(in srgb, ${color} 22%, transparent);` +
    `border-color: color-mix(in srgb, ${color} 45%, transparent);` +
    `color: color-mix(in srgb, ${color} 80%, var(--sg-fg, #0f172a));`
  );
}

export function getEditorClass(editorType: CellEditorType) {
  const base = baseEditor(editorType);
  if (base === "number")
    return "sv-grid-cell-editor sv-grid-cell-editor-number";
  if (base === "date")
    return "sv-grid-cell-editor sv-grid-cell-editor-date";
  if (base === "datetime")
    return "sv-grid-cell-editor sv-grid-cell-editor-datetime";
  if (base === "color")
    return "sv-grid-cell-editor sv-grid-cell-editor-color";
  return "sv-grid-cell-editor";
}

export function asDate(value: unknown) {
  if (value == null || value === "") return null;
  const parsed =
    value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function clampMenuX(x: number, width: number) {
  return Math.max(8, Math.min(x, window.innerWidth - width - 8));
}

export function cssEscape(s: string): string {
  return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(s) : s.replace(/"/g, '\\"');
}

export function rawToNumber(raw: unknown, isDate: boolean): number {
  if (raw == null || raw === "") return Number.NaN;
  if (isDate) {
    const d = raw instanceof Date ? raw : new Date(String(raw));
    const t = d.getTime();
    return Number.isFinite(t) ? t : Number.NaN;
  }
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function formatFacetNumber(n: number): string {
  const abs = Math.abs(n);
  const maxFractionDigits =
    abs >= 1000 ? 0 : abs >= 100 ? 1 : abs >= 1 ? 2 : 4;
  return n.toLocaleString(undefined, {
    maximumFractionDigits: maxFractionDigits,
  });
}

export function formatFacetDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
