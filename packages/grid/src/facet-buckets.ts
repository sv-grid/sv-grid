// Facet value-bucketing: turns a high-cardinality numeric/date column into a
// fixed set of range buckets for the filter menu. Pure - the caller passes the
// row data and an accessor, so this holds no grid state.
import type { Column, RowData } from "./index";
import { rawToNumber, formatFacetDate, formatFacetNumber } from "./SvGrid.helpers";

export type FacetBucket = {
  label: string;
  numericMin: number;
  numericMax: number;
  isLast: boolean;
  isDate: boolean;
};
const FACET_BUCKET_THRESHOLD = 30;
const FACET_BUCKET_COUNT = 10;

export function isBucketableColumn<TData extends RowData>(column: Column<TData>): { isDate: boolean } | null {
  const editorType = column.columnDef.editorType;
  if (editorType === "number") return { isDate: false };
  if (editorType === "date" || editorType === "datetime") return { isDate: true };
  return null;
}

export function buildBuckets<TData extends RowData>(
  column: Column<TData>,
  isDate: boolean,
  data: ReadonlyArray<TData>,
  getAccessor: (row: TData, column: Column<TData>) => unknown,
): Array<FacetBucket> | null {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  const distinct = new Set<number>();
  for (const rowData of data) {
    const num = rawToNumber(getAccessor(rowData, column), isDate);
    if (!Number.isFinite(num)) continue;
    distinct.add(num);
    if (num < min) min = num;
    if (num > max) max = num;
  }
  if (distinct.size <= FACET_BUCKET_THRESHOLD) return null;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max)
    return null;

  const span = max - min;
  const buckets: Array<FacetBucket> = [];
  for (let i = 0; i < FACET_BUCKET_COUNT; i += 1) {
    const lo = min + (span * i) / FACET_BUCKET_COUNT;
    const hi = min + (span * (i + 1)) / FACET_BUCKET_COUNT;
    const label = isDate
      ? `${formatFacetDate(lo)} – ${formatFacetDate(hi)}`
      : `${formatFacetNumber(lo)} – ${formatFacetNumber(hi)}`;
    buckets.push({
      label,
      numericMin: lo,
      numericMax: hi,
      isLast: i === FACET_BUCKET_COUNT - 1,
      isDate,
    });
  }
  return buckets;
}

export function isInBucket(num: number, bucket: FacetBucket): boolean {
  if (!Number.isFinite(num)) return false;
  if (num < bucket.numericMin) return false;
  return bucket.isLast ? num <= bucket.numericMax : num < bucket.numericMax;
}
