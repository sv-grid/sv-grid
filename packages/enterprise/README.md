<p align="center">
  <img src="https://svgrid.com/brand/svgrid-logo-icon-1200.png" alt="SvGrid" width="100" height="100" />
</p>

<h1 align="center">@svgrid/enterprise</h1>

<p align="center"><strong>The commercial feature pack for SvGrid.</strong></p>

<p align="center">
  <a href="https://svgrid.com">Website</a> ·
  <a href="https://svgrid.com/docs">Docs</a> ·
  <a href="https://svgrid.com/pricing">Pricing</a>
</p>

---

`@svgrid/enterprise` layers production export, printing, and analytics on top of the MIT [`@svgrid/grid`](https://www.npmjs.com/package/@svgrid/grid) core. It attaches to the grid's public API without changing it - the same `api` object you already hold simply gains new methods.

## What it adds

- **Data export** - Excel (`.xlsx`), PDF, CSV, TSV, and HTML, with theme-matched styling, headers/footers, and image support.
- **Paginated print** - opens a clean, paginated, printable view of the grid with title and page breaks.
- **Pivot tables** - drag-and-drop pivot Designer with row/column/value fields, aggregation, and drill-through to source rows.
- **AI helpers** - utilities for wiring the grid into LLM-driven workflows.

## Install

```bash
npm install @svgrid/enterprise
```

Format engines are optional peer dependencies - install only the ones you use:

```bash
npm install jszip      # Excel (.xlsx)
npm install pdfmake    # PDF
```

## Usage

```ts
import { setLicenseKey, installEnterprise } from '@svgrid/enterprise'

setLicenseKey('SVENTERPRISE-XXXX-XXXX-XXXX') // your Enterprise key

// Inside <SvGrid onApiReady={(api) => { ... }}>:
const pro = installEnterprise(api)

await pro.exportData({ format: 'xlsx', filename: 'orders' })
pro.print({ title: 'Q2 Orders' })
```

`installEnterprise` returns the same grid API with the enterprise methods added on top, so the rest of your integration is unchanged.

## Licensing

Commercial. A valid Enterprise key is required at runtime; calls throw without one. Purchase a key at [svgrid.com/pricing](https://svgrid.com/pricing).

OSS projects under an [OSI-approved license](https://opensource.org/licenses) qualify for a **free Enterprise key**.

The source in this package is published for evaluation and for paying customers; visibility does not grant a license. See [LICENSE](./LICENSE).

## Support

Enterprise licenses include commercial and priority support. Open an issue at [github.com/sv-grid/sv-grid](https://github.com/sv-grid/sv-grid/issues) or reach the team via [svgrid.com](https://svgrid.com).

## Trademark

SvGrid&trade; and sv-grid&trade; are trademarks of jQWidgets Ltd.
