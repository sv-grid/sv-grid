# `@svgrid/grid` · `datetime/date-format.ts`

Auto-generated. Source: `packages\grid\src\datetime\date-format.ts`.

### `function tokenizeMask`

Split a mask into an ordered list of token / literal parts.

```ts
export function tokenizeMask(mask: string): Part[]
```

### `function formatDate`

Render `date` per `mask` in `locale`.

```ts
export function formatDate(date: Date, mask: string, locale = 'en-US'): string
```

### `function parseDate`

Parse `str` against `mask` in `locale`. Returns a Date or null if the string
does not satisfy the mask. `yearCutoff` disambiguates 2-digit years: values
<= (yearCutoff % 100) map to 2000s, above to 1900s (Smart's default 1926 ->
a 26 pivot). `base` supplies fields the mask omits (defaults to epoch-zero
local midnight so a time-only mask yields a today-agnostic time).

```ts
export function parseDate(
  str: string,
  mask: string,
  locale = 'en-US',
  yearCutoff = 2029,
  base?: Date,
): Date | null
```
