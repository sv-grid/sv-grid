# Custom filter functions

> Filter logic that the built-in `filterFns` (`includesString`,
> `equals`, `between`, ...) doesn't cover - semver ranges, CIDR / IP
> matching, fuzzy search, regex. The library doesn't expose a
> per-column `filterFn` field; the pattern is **pre-filter the data
> array** and hand the result to the grid.

## When

You need any of:

- semver-range matching (`^2.4.0` → `2.4.7` but not `3.0.0`)
- CIDR / IP subnet matching (`10.0.0.0/8` → `10.5.2.3`)
- acronym / fuzzy matching (`rct` → `react` AND `redact`)
- regex matching against a Tag column
- score-based ranking by relevance, not just a boolean filter

For exact-match, contains, range, and "in [list]" - prefer
[`api.setFilter`](../reference/SvGridApi.md#setfilter) with a built-in
operator.

## The pattern

Each filter is a pure `(value, spec) => boolean` function. Compose
them in a `$derived` that filters the data array before it reaches
`<SvGrid data={...}>`.

```svelte
<script lang="ts">
  import { SvGrid, tableFeatures, rowSortingFeature, columnFilteringFeature } from '@svgrid/grid'

  type FilterFn = (value: unknown, filterValue: string) => boolean

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  let services: Service[] = [/* ... */]
  let semverSpec = $state('')
  let cidrSpec   = $state('')
  let fuzzySpec  = $state('')
  let regexSpec  = $state('')

  const filtered = $derived(
    services.filter((s) =>
      semverInRange(s.semver, semverSpec)
      && cidrContainsIp(s.ip, cidrSpec)
      && fuzzySubstring(s.id, fuzzySpec)
      && regexMatch(s.tag, regexSpec)
    ),
  )
</script>

<SvGrid data={filtered} {columns} {features} />
```

The grid stays a plain consumer - all filters compose naturally and
empty inputs are no-ops.

## The four filter implementations

### Semver in range

```ts
/** Matches simple "^x.y.z" (compatible) and "~x.y.z" (patch-only). */
const semverInRange: FilterFn = (value, filterValue) => {
  const v = String(value ?? '')
  const spec = String(filterValue ?? '').trim()
  if (!spec) return true
  const parse = (s: string) =>
    s.split('.').map((n) => parseInt(n, 10) || 0) as [number, number, number]
  const op = spec[0]
  const base = parse(spec.slice(op === '^' || op === '~' ? 1 : 0))
  const cur  = parse(v)
  if (op === '^') return cur[0] === base[0] &&
    (cur[1] > base[1] || (cur[1] === base[1] && cur[2] >= base[2]))
  if (op === '~') return cur[0] === base[0] && cur[1] === base[1] && cur[2] >= base[2]
  return v === spec
}
```

### CIDR contains IP

```ts
const cidrContainsIp: FilterFn = (value, filterValue) => {
  const ip = String(value ?? '')
  const cidr = String(filterValue ?? '').trim()
  if (!cidr) return true
  const [net, bitsStr] = cidr.split('/')
  if (!net || !bitsStr) return false
  const bits = parseInt(bitsStr, 10)
  const toInt = (s: string) =>
    s.split('.').reduce((a, b) => (a << 8) + (parseInt(b, 10) || 0), 0) >>> 0
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  return (toInt(ip) & mask) === (toInt(net) & mask)
}
```

### Fuzzy substring (acronym OR contiguous)

```ts
const fuzzySubstring: FilterFn = (value, filterValue) => {
  const hay = String(value ?? '').toLowerCase()
  const needle = String(filterValue ?? '').toLowerCase().trim()
  if (!needle) return true
  if (hay.includes(needle)) return true
  // Acronym: every needle char appears in hay in order.
  let i = 0
  for (const ch of hay) {
    if (ch === needle[i]) i += 1
    if (i === needle.length) return true
  }
  return false
}
```

### Regex match

```ts
const regexMatch: FilterFn = (value, filterValue) => {
  const v = String(value ?? '')
  const pattern = String(filterValue ?? '').trim()
  if (!pattern) return true
  try { return new RegExp(pattern).test(v) }
  catch { return false }
}
```

## Performance notes

- Pre-filtering on the consumer side runs **before** the grid's own
  sort/group/page pipeline - so the engine sees fewer rows and does
  less work.
- For large datasets (>10k rows) keep filter functions allocation-free
  - no `.map().filter()` chains inside a hot path. The four above are
  all single-pass.
- Debounce the input bindings if a filter is heavy. `bind:value` fires
  every keystroke; wrap it in a `$derived` keyed off a debounced
  `$state` mirror if needed.

## See also

- [Locale-aware filtering recipe](./external-search.md)
- [Saved filter sets](./saved-filter-sets.md)
- [Between-operator filters for date ranges](./between-date-filter.md)
- [`SvGridApi.setFilter`](../reference/SvGridApi.md#setfilter) for built-in operator filters
