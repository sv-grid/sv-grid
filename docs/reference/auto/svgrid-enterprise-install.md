# `@svgrid/enterprise` · `install.ts`

Auto-generated. Source: `packages\enterprise\src\install.ts`.

### `type EnterpriseAIApi`

_No JSDoc yet._

```ts
export type EnterpriseAIApi<TData extends RowData> = {
  /** Natural-language -> filter + sort plan (and optionally apply it). */
  filter(query: string, opts?: AIFilterOptions): Promise<AIFilterResult>
  /** Propose values for empty cells based on a few worked examples. */
  smartFill<TValue = unknown>(opts: AISmartFillOptions): Promise<AISmartFillResult<TValue>>
  /** One-paragraph + bullets summary of a row, selection, group, or the whole view. */
  summarize(opts: AISummarizeOptions): Promise<AISummary>
  /** Classify free-text cells into one of a known set of labels. */
  classify(opts: AIClassifyOptions): Promise<AIClassifyResult>
  // TData is referenced so the type stays bound to the row shape even
  // though the helpers all read through `api.getData()`. Lets callers
  // get correct inference downstream without explicit generics.
  readonly _rowType?: TData
}
```

### `type EnterprisePivotApi`

_No JSDoc yet._

```ts
export type EnterprisePivotApi<
```

### `type EnterpriseGridApi`

_No JSDoc yet._

```ts
export type EnterpriseGridApi<
```

### `function installEnterprise`

Augment a SvGridApi instance with Enterprise methods (`exportData`, `print`,
`ai.*`). Mutates and returns the same object so existing references
keep working.

If no license key has been set, the Enterprise methods still function but the
grid shows a small "unlicensed" watermark linking to jqwidgets.com and
the console emits a one-time nudge. Revoked or malformed keys throw on
first call.

```ts
export function installEnterprise<
```
