# @svgrid/enterprise

The paid feature pack for [sv-grid](https://svgrid.com).

Ships data export to **Excel (xlsx), PDF, CSV, TSV, HTML** and a
**Print** action that opens a paginated, printable view of the grid.

## Install

```bash
pnpm add @svgrid/enterprise
# optional peers - only needed for the formats you use:
pnpm add jszip       # for xlsx
pnpm add pdfmake     # for pdf
```

## Use

```ts
import { setLicenseKey, installEnterprise } from '@svgrid/enterprise'

setLicenseKey('SVENTERPRISE-XXXX-XXXX-XXXX')  // your Pro key

// inside <SvGrid onApiReady={...}>:
const pro = installEnterprise(api)

await pro.exportData({ format: 'xlsx', filename: 'orders' })
pro.print({ title: 'Q2 Orders' })
```

The full grid API stays untouched - `installEnterprise` returns the same
object with `exportData` and `print` added on top.

## License

Commercial. A valid Pro key is required at runtime; calls throw
otherwise. Buy a key at <https://svgrid.com/pricing>.
