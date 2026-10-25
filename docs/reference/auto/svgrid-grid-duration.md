# `@svgrid/grid` · `duration.ts`

Auto-generated. Source: `packages\grid\src\duration.ts`.

### `function parseDuration`

Parse a human duration to minutes, or `null` if unparseable. Accepts:
- `h:mm`         e.g. "1:30" -> 90
- unit form      e.g. "1h 30m", "1.5h", "45m" -> 90 / 90 / 45
- a bare number  e.g. "90" -> 90 (treated as minutes)

```ts
export function parseDuration(input: string): number | null
```

### `function formatDuration`

Format minutes as `h:mm` (colon) or `Nh Nm` (units). Empty for invalid input.

```ts
export function formatDuration(minutes: number, style: 'colon' | 'units' = 'colon'): string
```
