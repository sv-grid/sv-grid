# Enterprise feature pack

`@svgrid/enterprise` is a paid add-on for `@svgrid/grid`. It bolts onto
the same `<SvGrid>` you already have and adds four feature areas: data
export, data import, an AI assistant, and pivot tables.

![The @svgrid/enterprise pack bolts data export, data import, an AI assistant, and pivot tables onto the same SvGrid you already have.](/docs-media/enterprise-pack.svg)

```bash
pnpm add @svgrid/enterprise
```

```ts
import { installEnterprise, setLicenseKey } from '@svgrid/enterprise'

setLicenseKey('SVENTERPRISE-…')   // once, at app startup
const pro = installEnterprise(api) // wraps a SvGridApi with Enterprise methods
```

That's the whole integration. Every Enterprise helper hangs off the api object
you already have; the grid component stays Community.

## What ships in Enterprise

### [Data export](../help/export.md)

`pro.exportData(opts)` writes the current view to Excel (xlsx), PDF,
CSV, TSV, or HTML. The xlsx writer honours:

- **Cell + row styles** via `opts.styles` - read the same `--sg-*`
  tokens the grid renders with so the file matches the theme.
- **Page header + footer** lines with text or embedded images
  (`opts.header`, `opts.footer`).
- **Embedded images** from cell values when columns are listed in
  `opts.imageFields`.
- **Multiple sheets** in one workbook via `opts.sheets`.
- **Printable view** via `pro.print(opts)` - opens a new window with
  repeat-on-page headers, cover page, page-size + orientation.

Demos: [56 theme-matched](../../examples/src/demos/56-export-theme-matched.svelte),
[57 header + footer + logo](../../examples/src/demos/57-export-header-footer-logo.svelte),
[58 images](../../examples/src/demos/58-export-with-images.svelte),
[59 multi-sheet](../../examples/src/demos/59-export-multi-sheet.svelte).

### [Data import](../help/import.md)

`pro.importData(opts)` reads an Excel / CSV / TSV / JSON file (or
inline text), maps columns to your row shape, validates each row, and
returns a typed `ImportResult` with `rows`, `errors`, and a `summary`.
You decide whether to commit the rows into the grid or preview first.

Demo: [53 Excel import](../../examples/src/demos/53-excel-import.svelte).

### [AI assistant](../help/ai.md)

Four model-agnostic helpers on `pro.ai`:

- `filter(query)` - natural-language filter + sort plan ("show me last
  quarter's churn over $10k, sorted by date").
- `smartFill(opts)` - propose values for empty cells from a few worked
  examples.
- `summarize(opts)` - one-paragraph + bullets summary of a row,
  selection, group, or the whole view.
- `classify(opts)` - classify free-text cells into one of a known set
  of labels.

You register a provider via `setAIProvider(yourAdapter)`. No model
client is bundled - you bring OpenAI / Anthropic / Ollama / local.

Demo: [51 AI assistant](../../examples/src/demos/51-ai-assistant.svelte).

### [Pivot tables](../help/pivot.md)

`createPivotModel(data, config)` (or `pro.pivot.build(config)` against
the live api) returns `{ rows, columns }` you feed to a separate
`<SvGrid>` instance. Supports row + column axes, eight built-in
aggregators (sum/avg/min/max/count/countDistinct/first/last) or
custom, grand-total row + column, subtotals, custom axis sort.

Demo: [52 pivot table + designer](../../examples/src/demos/52-pivot-table.svelte).

## Licensing

The pack is **soft-gated**. Until a valid license key is set,
everything still functions but the grid shows a small "unlicensed"
watermark + a one-time console nudge. Set a key once at app startup
and the watermark disappears:

```ts
import { setLicenseKey } from '@svgrid/enterprise'
setLicenseKey('SVENTERPRISE-XXXX-XXXX-XXXX')
```

For dev builds, the demos use `setLicenseKey('SVENTERPRISE-DEV-DEMO')` to
suppress the watermark in screenshots.

Pricing + multi-app licensing: <https://svgrid.com/pricing>.

## How Enterprise integrates

```ts
import { SvGrid, type SvGridApi } from '@svgrid/grid'
import { installEnterprise, setLicenseKey, type EnterpriseGridApi } from '@svgrid/enterprise'

setLicenseKey(import.meta.env.VITE_SVPRO_KEY)

let api = $state<EnterpriseGridApi<typeof features, Order> | null>(null)
```

```svelte
<SvGrid
  data={rows}
  columns={columns}
  features={features}
  onApiReady={(next: SvGridApi<typeof features, Order>) => {
    api = installEnterprise(next)
  }}
/>

<button onclick={() => api?.exportData({ format: 'xlsx', filename: 'orders' })}>
  Export to Excel
</button>
```

`installEnterprise` mutates and returns the same api object - existing
references keep working. The `EnterpriseGridApi` type extends `SvGridApi` so
the grid's existing methods are still there alongside the new ones.

## Tree-shaking

Each Enterprise module is a separate subpath export:

```ts
import { exportGrid }     from '@svgrid/enterprise/export'    // export only
import { importData }     from '@svgrid/enterprise/import'    // import only
import { aiFilter }       from '@svgrid/enterprise/ai'        // AI only
import { createPivotModel } from '@svgrid/enterprise/pivot'   // pivot only
```

If you only need export, the AI provider plumbing, pivot engine, and
import parser don't ship. The `@svgrid/enterprise` barrel import is
convenient; the subpaths are smaller.

## Peer dependencies

| Feature | Peer dep             | Optional?                                  |
| ------- | -------------------- | ------------------------------------------ |
| xlsx    | `jszip`              | Yes - only loaded when xlsx is exported.   |
| pdf     | `pdfmake`            | Yes - only loaded when pdf is exported.    |
| import  | `jszip` (xlsx only)  | Yes - only for xlsx import.                |
| AI      | -                    | -. You bring your own provider client.     |
| pivot   | -                    | -. Pure TypeScript, no runtime deps.       |

Install only what you need:

```bash
pnpm add @svgrid/enterprise jszip            # community + Enterprise + xlsx
pnpm add @svgrid/enterprise jszip pdfmake    # also pdf
```

## See also

- [Getting started](../getting-started.md) - if you haven't seen the
  Community walkthrough yet.
- [Help index](../help/index.md) - all topic pages including the four
  Enterprise pages.
- [Missing features](../help/missing-features.md) - the honest gap list.
