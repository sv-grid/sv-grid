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
): ProposalGroup[] {
  const fieldLabel = opts.fieldLabel ?? ((f: string) => f)
  const msg = reviewMessages(opts.messages)
  const minScale = opts.minScale ?? 5
  const low = opts.lowConfidence ?? 0.6
  const order = new Map<string, number>()
  proposals.forEach((p, i) => order.set(p.id, i))

  const buckets = new Map<string, Bucket>()
  const put = (p: Proposal, kind: GroupKind, param: string) => {
    const key = [p.source.id, p.field, kind, param].join(SEP)
    let b = buckets.get(key)
    if (!b) buckets.set(key, (b = { kind, param, field: p.field, sourceId: p.source.id, members: [] }))
    b.members.push(p)
  }
  const cell = (p: Proposal) => p.source.id + SEP + p.field

  // 1-3: provable per proposal.
  let rest: Proposal[] = []
  for (const p of proposals) {
    const r = ruleOf(p.before, p.after)
    if (r) put(p, r.kind, r.param)
    else rest.push(p)
  }

  // 4: scale, only once enough members share a ratio.
  rest = bucketPass(rest, (p) => {
    const r = ratioOf(p.before, p.after)
    return r == null ? null : cell(p) + SEP + r
  }, (members) => members.length >= minScale, (p, k) => put(p, 'scale', k.slice(k.lastIndexOf(SEP) + 1)))

  // 5: non-blank pairs seen at least twice, one group per target value.
  rest = bucketPass(rest, (p) => (isBlank(p.before) ? null : cell(p) + SEP + keyOf(p.before) + SEP + keyOf(p.after)),
    (members) => members.length >= 2,
    (p) => put(p, 'same-mapping', keyOf(p.after)))

  // 6: blank before, split by the value proposed; singletons go to one pooled group.
  rest = bucketPass(rest, (p) => (isBlank(p.before) ? cell(p) + SEP + keyOf(p.after) : null),
    () => true,
    (p, _k, members) => put(p, 'fill-empty', members.length >= 2 ? keyOf(p.after) : '*'))

  // 7: one target from at least three proposals.
  rest = bucketPass(rest, (p) => cell(p) + SEP + keyOf(p.after),
    (members) => members.length >= 3,
    (p) => put(p, 'constant-target', keyOf(p.after)))

  // 8: everything else, per field.
  for (const p of rest) put(p, 'unpatterned', '')

  const groups: ProposalGroup[] = []
  for (const [key, b] of buckets) {
    const members = b.members.sort((x, y) => order.get(x.id)! - order.get(y.id)!)
    const confs = members.map((m) => m.confidence).filter((c): c is number => typeof c === 'number')
    groups.push({
      key,
      kind: b.kind,
      rule: RULE_KINDS.has(b.kind),
      param: b.param,
      label: labelOf(b.kind, b.param, fieldLabel(b.field), members, msg),
      field: b.field,
      sourceId: b.sourceId,
      ids: members.map((m) => m.id),
      count: members.length,
      minConfidence: confs.length ? Math.min(...confs) : undefined,
      avgConfidence: confs.length ? confs.reduce((s, c) => s + c, 0) / confs.length : undefined,
      sample: sampleOf(members, low),
      beforeDistribution: b.kind === 'constant-target' || b.kind === 'same-mapping' ? distributionOf(members) : undefined,
    })
  }
  return groups.sort((a, b) => rankOf(a, low) - rankOf(b, low) || b.count - a.count || (a.key < b.key ? -1 : 1))
}
```

### `function showValue`

A value as a group label shows it: short, `(empty)` for blank, spaces
visible. A string is quoted only where the quotes tell something: around
spaces at its ends, or when it reads as a number, a boolean or the blank mark.

```ts
export function showValue(v: unknown, empty = '(empty)'): string {
  if (isBlank(v)) return empty
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v)
  const short = s.length > 40 ? s.slice(0, 39) + '...' : s
  if (typeof v !== 'string') return short
  const quote = /^\s|\s$/.test(s) || /^-?[\d.,]+$|^(true|false)$/i.test(s) || s === empty
  return quote ? `"${visibleSpaces(short)}"` : visibleSpaces(short)
}
```
