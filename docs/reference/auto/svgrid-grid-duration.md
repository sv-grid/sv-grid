# `@svgrid/grid` · `duration.ts`

Auto-generated. Source: `packages\grid\src\duration.ts`.

### `function parseDuration`

Parse a human duration to minutes, or `null` if unparseable. Accepts:
- `h:mm`         e.g. "1:30" -> 90
- unit form      e.g. "1h 30m", "1.5h", "45m" -> 90 / 90 / 45
- a bare number  e.g. "90" -> 90 (treated as minutes)

```ts
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase()
  if (!s) return null

  const colon = s.match(/^(\d+):(\d{1,2})$/)
  if (colon) {
    const mm = parseInt(colon[2]!, 10)
    if (mm > 59) return null
    return parseInt(colon[1]!, 10) * 60 + mm
  }

  const units = s.match(/\d+(?:\.\d+)?\s*[hm]/g)
  if (units && units.join('').replace(/\s/g, '').length === s.replace(/\s/g, '').length) {
    let total = 0
    for (const part of units) {
      const m = part.match(/(\d+(?:\.\d+)?)\s*([hm])/)!
      const n = parseFloat(m[1]!)
      total += m[2] === 'h' ? n * 60 : n
    }
    return Math.round(total)
  }

  const num = Number(s)
  return Number.isFinite(num) ? Math.round(num) : null
}
```

### `function formatDuration`

Format minutes as `h:mm` (colon) or `Nh Nm` (units). Empty for invalid input. */

```ts
export function formatDuration(minutes: number, style: 'colon' | 'units' = 'colon'): string {
  if (!Number.isFinite(minutes) || minutes < 0) return ''
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (style === 'units') {
    if (h && m) return `${h}h ${m}m`
    if (h) return `${h}h`
    return `${m}m`
  }
  return `${h}:${String(m).padStart(2, '0')}`
}
```
