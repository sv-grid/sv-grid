# `@svgrid/enterprise` · `review/cluster.ts`

Auto-generated. Source: `packages\enterprise\src\review\cluster.ts`.

### `type ClusterOptions`

How `clusterProposals` labels and splits groups: field labels, the size a
scale group needs, the confidence below which a proposal counts as unsure,
and the wording.

```ts
export type ClusterOptions = {
  /** Wording of the group labels (the `label*`, `case*`, `punct*` keys); English by default. */
  messages?: Partial<ReviewMessages>
  /** The header to show for a field in group labels. Default: the field itself. */
  fieldLabel?: (field: string) => string
  /** Fewest members a `scale` group needs. Default 5. */
  minScale?: number
  /** Below this, a judgment group sorts with the risky ones. Default 0.6. */
  lowConfidence?: number
}
```

### `function clusterProposals`

Group proposals by the change they make (trim, case, reformat, scale, one
mapping, fill empty, one target, no pattern), the groups that need a person
first. What the panel lists.

```ts
export function clusterProposals(
  proposals: ReadonlyArray<Proposal>,
  opts: ClusterOptions = {},
): ProposalGroup[]
```

### `function showValue`

A value as a group label shows it: short, `(empty)` for blank, spaces
visible. A string is quoted only where the quotes tell something: around
spaces at its ends, or when it reads as a number, a boolean or the blank mark.

```ts
export function showValue(v: unknown, empty = '(empty)'): string
```
