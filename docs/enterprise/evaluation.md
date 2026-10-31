# Enterprise evaluation

You can try every `@svgrid/enterprise` feature without a key. Install it
and use it. Nothing is locked; the page shows a small watermark and logs
a console message, and that is the only difference.

![The evaluation: install, try every feature while the watermark and the console message show, then set a license key when ready, with no gated-off code paths.](/docs-media/enterprise-evaluation.svg)

Two ways to try it, both running every feature with only the watermark and
console notice:

- **Browse the demos offline.** Download the bundle below: a demo browser
  with every example and its source. Nothing to build.
- **Build your own app.** Install from npm and follow steps 1 to 3. This is
  the path if you want to write code against the grid.

## Start a 30-day trial

One download has both packages, the demo browser to run offline with every
example's source, and a README with the steps. It also starts 30 days of
email support: write to support@jqwidgets.com and an engineer who works on
SvGrid answers. The features are the same as installing from npm below.

<div data-docs-trial="docs-evaluation"></div>

## 1. Create an app

`@svgrid/grid` and `@svgrid/enterprise` are libraries you import, not a
project on their own. Running the install in an empty folder leaves you with
only a `node_modules` folder and nowhere to put a component, so start from an
app.

The quickest, with Enterprise already wired in:

```bash
npm create @svgrid@latest my-grid-app -- --template pivot-dashboard
cd my-grid-app
npm install
npm run dev
```

That opens a running grid at the printed `localhost` address, and the code
lives in `src/`. Other templates are `minimal`, `admin-dashboard`, `base`,
`sveltekit` and `headless`; drop `--template` to choose interactively.

Already have a Svelte 5 or SvelteKit app? Install the packages into it
instead:

```bash
npm install @svgrid/grid @svgrid/enterprise
npm install jszip pdfmake   # only needed for Excel and PDF export
```

## 2. Add Enterprise to a grid

Put this in a component (`src/App.svelte` in a Vite app, a `+page.svelte` in
SvelteKit), then run `npm run dev`:

```svelte
<script>
  import { SvGrid } from '@svgrid/grid'
  import '@svgrid/grid/themes/ember.css'
  import { installEnterprise } from '@svgrid/enterprise'

  let api = $state(null)

  const rows = [
    { name: 'Ada Lovelace', team: 'Engineering', salary: 145000 },
    { name: 'Alan Turing', team: 'Research', salary: 160000 },
  ]
  const columns = [
    { field: 'name', header: 'Name' },
    { field: 'team', header: 'Team' },
    { field: 'salary', header: 'Salary' },
  ]
</script>

<SvGrid data={rows} {columns} onApiReady={(next) => (api = installEnterprise(next))} />

<button onclick={() => api?.exportData({ format: 'xlsx', filename: 'team' })}>
  Export to Excel
</button>
```

The `<SvGrid>` component itself stays the same. `installEnterprise()` adds
the Enterprise methods to the grid API: `exportData`, `importData`,
`print`, pivot and AI.

For a complete page with themes, PDF, CSV and print, see
[Enterprise getting started](./getting-started.md).

## 3. Try the features

The [demo gallery](https://svgrid.com/demos/) has a working demo for every
Enterprise feature, with the source next to it. These pages cover each
one in detail:

- [Export](../help/export.md) - Excel, PDF, CSV
- [Import](../help/import.md) - column mapping and per-row validation

## Without a key

You can skip `setLicenseKey()` entirely. Everything still runs, and you
see:

- a small "www.svgrid.com" watermark on each grid, which fades after 5
  seconds
- one console message per page load
- a one-time upgrade card the first time you call an Enterprise feature

None of these make network calls or write cookies or storage (see
[security](../help/security.md)).

This works the same on localhost, staging, or a demo deployment. You don't
need to ask anyone for a trial key. When you buy a license, call
`setLicenseKey()` with your key and the watermark goes away.

## Buying

- **Indie Developer License**, $299 per developer: the enterprise grid for
  freelancers and companies under $1M revenue, without support.
- **Grid Developer License**, $599 per developer: the enterprise grid.
- **Suite Developer License**, $999 per developer: adds the spreadsheet
  (`<SvSheet>`), SvGrid Base (`<SvBase>`) and Studio.

All three cover unlimited apps and are perpetual, with a year of updates
(and support, except Indie). For 5+ developers, a PO, or redistribution as an SDK, contact
sales. Details on the [pricing page](https://svgrid.com/pricing/).

## See also

- [Enterprise getting started](./getting-started.md) - a complete working page
- [Enterprise licensing](./licensing.md) - key formats, seats, renewals
- [Migration guides](../help/migrating-from-ag-grid.md) - moving from another grid
