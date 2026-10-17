# Stats blocks

Number sections for reports and status boards: large figures with labels,
framed as a page section rather than a dashboard tile. There are two blocks, a
weekly report and a status board. The report is built from `SvButton` and
`SvToaster`, the board from `SvSwitchButton` and `SvBadge`, and every value is
a raw number formatted with `Intl.NumberFormat`, so it reads in the visitor's
locale.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/stats"></div>

See them first with `npx @svgrid/ui try blocks/stats`. No project needed.

## With trends

A weekly report: four figures, each with an icon, last week's value and a trend
chip. Churn and load time set `lowerIsBetter`, so a drop shows green. Export CSV
writes the raw numbers to a `Blob`, downloads it through an object URL that is
revoked afterwards, and confirms with a toast.

<div data-docs-demo="564-block-stats-trends" data-height="360"></div>

`npx @svgrid/ui add stats-trends`

## Banded

A status board on a full-width tinted band: a heading with a health badge, then
a bordered, table-like grid of six cells with a value, a label, a status dot and
the change since an hour ago. Cells over their `warnAbove` threshold turn the
dot amber and the badge counts them. The Live updates switch polls every 3
seconds. Three columns become one on phones.

<div data-docs-demo="565-block-stats-banded" data-height="460"></div>

`npx @svgrid/ui add stats-banded`

## Formatting real numbers in the visitor's locale

Send raw numbers from the server and format them in the component. A string
like `"$48.6M"` built on the server is fixed to the server's locale; a number
plus `Intl.NumberFormat` options renders as `48,6 Mio. $` for a German visitor
and `$48.6M` for an American one.

```ts
// src/routes/report/+page.server.ts
import type { PageServerLoad } from './$types'
import { db } from '$lib/server/db'

export const load: PageServerLoad = async () => {
  const row = await db.yearSummary(2025)
  return {
    stats: [
      { label: 'Bookings handled', value: row.bookings, format: { notation: 'compact', maximumFractionDigits: 2 } },
      { label: 'Paid out to venues', value: row.payoutsUsd, format: { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 } },
      { label: 'Repeat customers', value: row.repeatRate, format: { style: 'percent' } },
    ] satisfies { label: string; value: number; format: Intl.NumberFormatOptions }[],
  }
}
```

```svelte
<!-- src/routes/report/+page.svelte -->
<script lang="ts">
  let { data } = $props()

  // One formatter per stat, rebuilt only when the data changes.
  const rows = $derived(data.stats.map((s) => ({
    ...s,
    text: new Intl.NumberFormat(undefined, s.format).format(s.value),
  })))
</script>

<dl>
  {#each rows as s (s.label)}
    <div><dt>{s.label}</dt><dd>{s.text}</dd></div>
  {/each}
</dl>
```

A few things to keep in mind:

- `undefined` as the locale means the browser's language. During server
  rendering it is the server's default locale, so the first paint can differ
  from the hydrated text. To match, read `Accept-Language` in a hook, pass it to
  the page through `locals` and `load`, and use it as the first argument.
- Percent style multiplies by 100: send `0.62`, not `62`.
- `currency` is required with `style: 'currency'`. Keep the currency code
  next to the value in the data, not in the formatter, when you report in more
  than one.
- Compact notation rounds. Keep the full number for a CSV export or a tooltip,
  as the trends block does: it shows `1,284` and exports the raw values.
- The banded block formats a change with the cell's own options plus
  `signDisplay: 'exceptZero'`, so a percent cell's change is in the same unit
  as its value: an error rate that went from 0.06% to 0.04% shows `-0.02%`.

## Headless

Each block's `<script module>` exports its core: `createWeeklyReport()` and
`createStatusBoard()`. The core takes the raw numbers as an option, formats
them and owns the export or live-polling state, with no markup. Take the banded
core alone with `npx @svgrid/ui add stats-banded --headless` and point its
`poll` at your API. `poll` receives the current cells and returns the next
ones. While `live` is true it runs every `interval` milliseconds (3000 by
default); the timer stops when `live` goes false or the component unmounts:

```svelte
<script lang="ts">
  import { createStatusBoard } from './stats-banded.svelte.js'

  const board = createStatusBoard({
    poll: () => fetch('/api/status/cells').then((r) => r.json()),
    interval: 10_000,
  })
</script>

<label>
  <input type="checkbox" checked={board.live} onchange={(e) => (board.live = e.currentTarget.checked)} />
  Live updates
</label>
<button onclick={board.poll}>Refresh now</button>
<p>{board.warnings} over threshold</p>
<dl>
  {#each board.cells as c (c.id)}
    <dt>{c.label}</dt>
    <dd class:warn={c.warn}>{c.shown} ({c.diffText} vs 1 h ago)</dd>
  {/each}
</dl>
```

## See also

- [UI blocks overview](./index.md)
- [SvSwitchButton](../ui-components/sv-switch-button.md)
- [SvStat](../ui-components/sv-stat.md)
