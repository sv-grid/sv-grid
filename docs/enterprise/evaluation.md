# Enterprise evaluation

The `@svgrid/enterprise` package is soft-gated; you can evaluate every
feature in production-equivalent code paths without contacting
sales. This page is the playbook.

## Step 1: Install

```bash
pnpm add @svgrid/enterprise
# Add the peers for the features you want to evaluate:
pnpm add jszip          # xlsx export/import
pnpm add pdfmake        # pdf export
```

`jszip` and `pdfmake` are lazy-loaded by @svgrid/enterprise - they're only
required if you actually invoke the matching feature.

## Step 2: Install the evaluation key

```ts
import { setLicenseKey } from '@svgrid/enterprise'
setLicenseKey('SVENTERPRISE-DEV-DEMO')
```

This suppresses the watermark in local dev. **For staging /
production evaluation, request an evaluation key** at
[svgrid.com/evaluate](https://svgrid.com/evaluate) - it's a one-form
request, no sales call, key arrives in ~10 minutes.

The evaluation key is a real key with a 30-day expiry. Behaves
identically to a paid license; lets you ship internal staging /
demo deployments to evaluators without the watermark.

### What unlicensed looks like

With no key set, Enterprise stays fully functional but nudges you:

- A small **"www.svgrid.com" watermark** in the corner of each grid
  (fades after 5 seconds).
- The first time you actually invoke a Enterprise feature (export, import,
  print, AI), a one-time **upgrade card** appears in the bottom-right
  naming that feature, with a one-click link to start a free trial. It
  shows at most once per session.

Both are pure DOM - **no network calls, no cookies, no web storage**
(see [security](../help/security.md)). `setLicenseKey()` with any
valid key suppresses them before they appear. To remove the upgrade
card programmatically (e.g. you render your own upgrade UI), call:

```ts
import { dismissUpgradePrompt } from '@svgrid/enterprise'
dismissUpgradePrompt()
```

## Step 3: Wire up

```svelte
<script lang="ts">
  import { SvGrid, type SvGridApi } from '@svgrid/grid'
  import { installEnterprise, type EnterpriseGridApi } from '@svgrid/enterprise'

  let api = $state<EnterpriseGridApi<typeof features, Order> | null>(null)
</script>

<SvGrid
  data={rows} columns={columns} features={features}
  onApiReady={(next: SvGridApi<typeof features, Order>) => {
    api = installEnterprise(next)
  }}
/>

<button onclick={() => api?.exportData({ format: 'xlsx' })}>Export</button>
```

That's the integration. The Community grid is unchanged; Enterprise
augments the api object.

## Step 4: Try the features (30-min tour)

| Feature | One-line evaluation                                                  |
| ------- | -------------------------------------------------------------------- |
| Export  | `api.exportData({ format: 'xlsx', filename: 'data' })`                |
| Pivot   | `const pivot = createPivotModel(rows, { rows: ['region'], cols: ['quarter'], values: [{ field: 'amount', agg: 'sum' }] })` |
| Import  | `<input type="file" onchange={(e) => api.importData({ file: e.target.files[0] }).then(r => api.addRows(r.rows))}>` |
| AI      | `setAIProvider(yourAdapter); const plan = await api.ai.filter('show last quarter > $10k')` |

Each Enterprise feature has a fully-working demo in the gallery
([56-60 + 51 + 52 + 53](https://svgrid.com/#/demos)) that you can
read end-to-end.

## Step 5: Performance + budget check

Bundle sizes (gzip):

| Surface         | Size  | Notes                              |
| --------------- | ----- | ---------------------------------- |
| Community only  | 49 kB | Renderer + engine                  |
| + Enterprise export    | +12 kB| + `jszip` peer when xlsx is used   |
| + Enterprise pdf       | +90 kB| + `pdfmake` peer when pdf is used  |
| + Enterprise pivot     | +6 kB | Pure TS, no peers                  |
| + Enterprise AI        | +4 kB | You bring the model client         |
| + Enterprise import    | +5 kB | + `jszip` for xlsx import          |

Subpath imports (`@svgrid/enterprise/export`, `@svgrid/enterprise/pivot`, etc.)
ensure you only pay for what you use.

## Step 6: Decide

- Shipping one production app? **Single Application Developer License**
  ($599 per developer).
- Shipping multiple apps across your org? **Multiple Application
  Developer License** ($999 per developer).
- Large team (5+), multi-year, NDA, or PO? **Enterprise / volume**
  (contact sales).

Each is a perpetual license + 1 year of updates and support that renews
automatically; cancel anytime.

[Full pricing](https://svgrid.com/pricing).

## Migrating from another grid mid-evaluation

If you're swapping out AG Grid / TanStack Table / MUI X / Handsontable
/ Glide, see the [migration guides](../help/migrating-from-ag-grid.md)
- typically a half-day port for a 5-grid app.

## See also

- [Enterprise licensing](./licensing.md) - what each tier covers
- [Enterprise support](./support.md) - what you get with each tier
- [Missing features](../help/missing-features.md) - the honest gap list
