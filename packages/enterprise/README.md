<p align="center">
  <img src="https://svgrid.com/brand/svgrid-logo-icon-1200.png" alt="SvGrid" width="100" height="100" />
</p>

<h1 align="center">@svgrid/enterprise</h1>

<p align="center"><strong>Excel export, import, pivot tables, and print for SvGrid.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@svgrid/enterprise"><img src="https://img.shields.io/npm/v/%40svgrid%2Fenterprise.svg?label=%40svgrid%2Fenterprise" alt="npm version" /></a>
  <a href="https://svgrid.com/pricing/"><img src="https://img.shields.io/badge/license-commercial-blue.svg" alt="Commercial license" /></a>
  <a href="https://svelte.dev"><img src="https://img.shields.io/badge/svelte-5-ff3e00.svg" alt="Svelte 5" /></a>
</p>

<p align="center">
  <a href="https://svgrid.com">Website</a> ·
  <a href="https://svgrid.com/docs/">Docs</a> ·
  <a href="https://svgrid.com/pricing/">Pricing</a>
</p>

---

`@svgrid/enterprise` layers production export, printing, analytics, extra grid views, and a full data-app layer on top of the MIT [`@svgrid/grid`](https://www.npmjs.com/package/@svgrid/grid) core. It attaches to the grid's public API without changing it - the same `api` object you already hold simply gains new methods.

## What it adds

- **Data export** - Excel (`.xlsx`), PDF, styled HTML and XML, with theme-matched styling, headers/footers, and image support. CSV, TSV and JSON export (and copy-to-clipboard) are free in `@svgrid/grid`; Enterprise adds the paid formats and a single `exportGrid()` entry point over all of them.
- **Data import** - read Excel / CSV / TSV / JSON into typed rows with column auto-mapping, type inference, and per-row validation, plus a ready-made `SvImportDialog`.
- **Paginated print** - opens a clean, paginated, printable view of the grid with title and page breaks.
- **Pivot tables** - drag-and-drop pivot Designer with row/column/value fields, aggregation, drill-through to source rows, and pivot-to-chart.
- **Scheduler / calendar view** - a Month/Week/Day/Agenda calendar rendered as a view of the grid: `enableSchedulerView()` lets `<SvGrid scheduler={...}>` show events with resources, recurrence, and drag/resize.
- **Staged editing** - collect edits into a reviewable change set before committing.
- **Scheduling automation** - a client-side cron / one-off scheduler (`createScheduler`, `parseCron`, `CRON_PRESETS`) to drive recurring exports and alerts with no backend.
- **SvGrid Studio** - a schema-driven data-app layer: `EntitySchema`, memory / SQL / Supabase / REST data sources, a SvelteKit adapter, edit panels, master/detail, schema charts + KPI dashboards, and the project model + codegen behind the visual designer. See [`@svgrid/studio`](https://www.npmjs.com/package/@svgrid/studio).

## Install

```bash
npm install @svgrid/enterprise
```

Format engines are optional peer dependencies - install only the ones you use:

```bash
npm install jszip      # Excel (.xlsx) export + import
npm install pdfmake    # PDF export
```

## Usage

```ts
import { setLicenseKey, installEnterprise } from '@svgrid/enterprise'

setLicenseKey('SVENTERPRISE-XXXX-XXXX-XXXX') // your Enterprise key

// Inside <SvGrid onApiReady={(api) => { ... }}>:
const pro = installEnterprise(api)

// Export / print
await pro.exportData({ format: 'xlsx', filename: 'orders' })
pro.print({ title: 'Q2 Orders' })

// Import
const result = await pro.importData({ file, format: 'xlsx' })

// Pivot - returns { rows, columns } for a second <SvGrid>
const { rows, columns } = pro.pivot.build({
  rows: ['region'],
  values: [{ field: 'total', agg: 'sum' }],
})
```

The AI helpers are **not** in this package. Natural-language filter,
smart fill, summarize, classify, anomaly detection, and "chart this" are
built in and free in [`@svgrid/grid`](https://www.npmjs.com/package/@svgrid/grid).
Installing Enterprise only adds the Excel/PDF export engine that
AI-planned exports write through.

`installEnterprise` returns the same grid API with the enterprise methods (`exportData`, `copyExport`, `print`, `importData`, `pivot.*`) added on top, so the rest of your integration is unchanged. It also registers the Kanban board and scheduler / calendar views, so `<SvGrid board={...}>` and `<SvGrid scheduler={...}>` render.

## Licensing

Commercial. A valid Enterprise key is required at runtime; calls throw without one. Purchase a key at [svgrid.com/pricing](https://svgrid.com/pricing/).

OSS projects under an [OSI-approved license](https://opensource.org/licenses) qualify for a **free Enterprise key**.

The source in this package is published for evaluation and for paying customers; visibility does not grant a license. See [LICENSE](./LICENSE).

## Support

Enterprise licenses include commercial and priority support. Open an issue at [github.com/sv-grid/sv-grid](https://github.com/sv-grid/sv-grid/issues) or reach the team via [svgrid.com](https://svgrid.com).

## Trademark

SvGrid&trade; and sv-grid&trade; are trademarks of jQWidgets Ltd.
