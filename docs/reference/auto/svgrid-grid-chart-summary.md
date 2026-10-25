# `@svgrid/grid` · `chart-summary.ts`

Auto-generated. Source: `packages\grid\src\chart-summary.ts`.

### `type ChartSummaryOptions`

What {@link chartSummary} takes.

```ts
export type ChartSummaryOptions = {
  /** How numbers are written. Default: the spec's `valueFormat` / `locale` / `currency`. */
  formatValue?: (v: number) => string
  /** How many series a cartesian chart describes before it says "and N more". Default 4. */
  maxSeries?: number
}
```

### `function chartSummary`

Describe a spec in plain words. Never throws: an empty spec of any type
comes back as "No data." so a live region always has something to say.

```ts
export function chartSummary(spec: ChartSpec, opts: ChartSummaryOptions = {}): string
```
