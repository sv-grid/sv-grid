# sv-grid-pro

The paid feature pack for [sv-grid](https://sv-grid.dev).

Ships data export to **Excel (xlsx), PDF, CSV, TSV, HTML** and a
**Print** action that opens a paginated, printable view of the grid.

## Install

```bash
pnpm add sv-grid-pro
# optional peers - only needed for the formats you use:
pnpm add jszip       # for xlsx
pnpm add pdfmake     # for pdf
```

## Use

```ts
import { setLicenseKey, installPro } from 'sv-grid-pro'

setLicenseKey('SVPRO-XXXX-XXXX-XXXX')  // your Pro key

// inside <SvGrid onApiReady={...}>:
const pro = installPro(api)

await pro.exportData({ format: 'xlsx', filename: 'orders' })
pro.print({ title: 'Q2 Orders' })
```

The full grid API stays untouched - `installPro` returns the same
object with `exportData` and `print` added on top.

## License

Commercial. A valid Pro key is required at runtime; calls throw
otherwise. Buy a key at <https://sv-grid.dev/pricing>.
