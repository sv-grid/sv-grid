# Enterprise features from the element

`@svgrid/grid-wc` is MIT and complete on its own. The paid pack -
[@svgrid/enterprise](https://svgrid.com/pricing/) - is a separate install, and
most of it works from a React, Vue or Angular host with no Svelte in your build.

Where the line falls is a packaging consequence, not a policy: four of the
enterprise entry points are plain JavaScript, and the main entry pulls Svelte
components with it.

## The api handle

Everything here needs the grid's imperative api. The element parks it on itself
once the grid has mounted, and fires `apiready` at the same moment:

```js
const grid = document.querySelector('sv-grid')
grid.addEventListener('apiready', () => {
  // grid.api is now the SvGridApi
})
```

In React the wrapper surfaces both:

```tsx {nocheck}
import { useRef, useState } from 'react'
import { SvGrid, type SvGridHandle } from '@svgrid/grid-wc/react'

const ref = useRef<SvGridHandle>(null)
const [ready, setReady] = useState(false)

<SvGrid ref={ref} data={rows} columns={columns} onApiReady={() => setReady(true)} />
// ref.current.api  -  the same object `apiready` carries
```

## Works with no Svelte in your build

These four entry points are plain JavaScript. Import them from any bundler,
including Angular's, and pass them the element's api.

### Excel, PDF, HTML, CSV and TSV export

```js
import { exportGrid } from '@svgrid/enterprise/export'

await exportGrid(grid.api, { format: 'xlsx', filename: 'orders' })
```

`format` takes `xlsx`, `pdf`, `html`, `csv` or `tsv`. Pass `download: false` to
get the file back instead of saving it - useful for uploading or attaching it:

```js
const { blob, filename, mime } = await exportGrid(grid.api, {
  format: 'pdf',
  download: false,
})
```

CSV and TSV are already free in `@svgrid/grid`; `xlsx` and `pdf` are the paid
formats.

### Import

```js
import { importData } from '@svgrid/enterprise/import'

const { rows, errors, total } = await importData(grid.api, {
  file,            // a File, Blob, or inline CSV / TSV / JSON text
  format: 'auto',  // sniffs xlsx vs text
})
```

### Print

```js
import { printGrid } from '@svgrid/enterprise/print'

await printGrid(grid.api, { title: 'Q3 orders', orientation: 'landscape' })
```

### Pivot model

`createPivotModel` is a pure function - rows in, model out - so it needs no api
at all, though the element's rows are the obvious input:

```js
import { createPivotModel } from '@svgrid/enterprise/pivot'

const model = createPivotModel(grid.api.getData(), {
  rows: ['region'],
  cols: ['status'],
  values: [{ field: 'total', agg: 'sum' }],
})
```

Feed `model.rows` and `model.columns` into a second, read-only `<sv-grid>`.

## The license key

```js
import { setLicenseKey } from '@svgrid/enterprise/license'

setLicenseKey('SVENTERPRISE-...')
```

Call it once, before the first export. With **no** key nothing breaks: the paid
features still run, the grid shows a small watermark, and the console carries a
one-time notice.

A **malformed** key is a different case - it throws rather than degrading, so a
placeholder string is worse than no key at all. Keys carry an `SVENTERPRISE-`
prefix.

## Needs a Svelte-aware bundler

The main entry - `@svgrid/enterprise` - imports the pack's Svelte components, so
a host that cannot compile `.svelte` files cannot import it. With Vite plus
[`@sveltejs/vite-plugin-svelte`](https://github.com/sveltejs/vite-plugin-svelte)
it works, and three more things become available:

```js
import { installEnterprise, enableBoardView, enableSchedulerView } from '@svgrid/enterprise'

installEnterprise(grid.api)   // adds api.exportData / importData / print / pivot / ai
enableBoardView()             // makes the element's `board` prop render a Kanban board
enableSchedulerView()         // makes its `scheduler` prop render a calendar
```

`installEnterprise` is a convenience: it hangs the same export, import, print
and pivot functions off the api object rather than you importing them. The board
and scheduler views are the part you cannot get any other way, because they are
Svelte components rendered inside the element.

Angular CLI builds have no Svelte compiler, so for Angular the four entry points
above are the whole of what is reachable.

## Summary

| Feature | Any bundler | Needs a Svelte-aware build |
| --- | --- | --- |
| xlsx / pdf / html / csv / tsv export | ✓ | |
| Import (xlsx / csv / tsv / json) | ✓ | |
| Print | ✓ | |
| Pivot model | ✓ | |
| License key | ✓ | |
| `installEnterprise(api)` | | ✓ |
| Kanban board view | | ✓ |
| Scheduler / calendar view | | ✓ |

See also [limitations](./limitations.md) for what the element itself cannot do,
regardless of licensing.
