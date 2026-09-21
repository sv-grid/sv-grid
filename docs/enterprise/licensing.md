# Enterprise licensing

The `@svgrid/enterprise` package is **soft-gated**: every feature runs
without a key, with a small unlicensed-build watermark in the
bottom-right corner of the grid + a one-time console nudge. Set a
key once at app startup and both disappear.

![The soft-gate model: without a key the grid runs fully with a small watermark and a one-time console nudge; calling setLicenseKey once clears both, and every feature runs either way.](/docs-media/enterprise-licensing.svg)

## Setting the key

```ts
import { setLicenseKey } from '@svgrid/enterprise'

setLicenseKey(import.meta.env.VITE_SVPRO_KEY)
```

Call this before the first `<SvGrid>` mounts. In Vite/SvelteKit,
expose the key as `VITE_SVPRO_KEY=SVENTERPRISE-...` in your `.env` (NOT
checked in) - or read it from your config service.

## License tiers

Every Enterprise license is a **perpetual license** that includes **1 year of
updates and support**. The price shown **renews automatically each year**
to keep updates and support active; **cancel anytime** and you keep every
version released during your paid term.

| License                            | What it covers                                                     | Price (per developer) | Support                                   |
| ---------------------------------- | ------------------------------------------------------------------ | --------------------- | ----------------------------------------- |
| **Grid Developer License**         | Enterprise grid features. No spreadsheet, no Studio                 | **$599**              | Email (next business day) + private Slack |
| **Suite Developer License**        | Everything in Grid, plus the spreadsheet and Studio                 | **$999**              | Email (next business day) + private Slack |
| **Enterprise / volume**            | Suite, site or organisation-wide                                    | Custom quote          | Priority + named contact, NDA / PO        |
| **OEM / redistribution**           | Shipping SvGrid to third parties as a component or app builder      | Custom quote          | Priority + named contact, NDA / PO        |

Both developer licenses cover an **unlimited number of production apps** in your
organisation. The line between them is the feature set, not the app count.

**Grid ($599)** is the enterprise grid: server-side row model, grouping and tree
data, pivot, export and import, print, the advanced filter, alerts, the selection
bar, and the Kanban, scheduler and Gantt renderers.

**Suite ($999)** adds the two things that are their own products:

- the **spreadsheet**: `<SvSheet>`, the `<sv-sheet>` element, the formula engine,
  and the `.xlsx` / `.xls` / `.ods` / `.csv` readers and writers;
- **Studio**: the designer, the code generator, and the SQL data sources.

> Priced **per developer** - engineers who write or modify code that imports
> `@svgrid/enterprise`. Production seats / end users are unlimited. One license key
> activates every grid in scope - no per-page or per-component accounting.
> Teams of 5+ and multi-year terms get volume discounts; email
> `sales@jqwidgets.com`.

### When you need an OEM license

A developer seat covers your own application, including a SaaS product your
customers pay for. It does not cover handing SvGrid to third parties as
something they build with: shipping it as a component or SDK, embedding it in an
app builder or low-code platform where your customers author their own screens,
or reselling it white-labelled. Those need an OEM license, priced separately from
seats. Section 4A of the [EULA](/docs/legal/EULA) has the exact test. If you are
not sure which side of the line you are on, email `sales@jqwidgets.com` and
describe the product; the answer is usually one message.

## License key format

```
SVENTERPRISE-SUITE-XXXX-XXXX-XXXX-XXXX
│            │
│            └── edition: GRID or SUITE
└── prefix the runtime recognises; the rest identifies your license
```

A key issued before editions existed carries no edition segment. Those keys read
as Suite, so nothing an existing customer already ships changes.

The check is purely client-side and **no network call** is ever made to
validate, so air-gapped deployments work out of the box.

It is also deliberately not cryptography. The runtime classifies the key
string - prefix recognised, which edition it names, on the revoked list, a
`DEV` / `EVAL` sentinel, or a paid key - and nothing more (`checkLicenseKey` in
`packages/enterprise/src/license-core.ts`). Anyone with devtools can read a key
out of a deployed bundle, and an unlicensed build still runs; it just shows a
watermark and logs a one-time notice. The license is a legal agreement, not a
technical lock, and we would rather say so than imply a DRM scheme that isn't
there. Keys are revocable: a key we revoke stops being accepted in later
releases.

## Per-environment keys

Different keys for different deployment stages so revoking is surgical:

```ts
const KEY = {
  development: import.meta.env.VITE_SVPRO_DEV_KEY,
  staging:     import.meta.env.VITE_SVPRO_STAGING_KEY,
  production:  import.meta.env.VITE_SVPRO_PROD_KEY,
}[import.meta.env.MODE] ?? ''

setLicenseKey(KEY)
```

## Dev / demo key

For demos + integration tests, use the published sentinel:

```ts
setLicenseKey('SVENTERPRISE-DEV-DEMO')
```

This suppresses the watermark for local development. **Do not ship
this key to production** - it's a dev-only convenience and will be
revoked in any production-domain validation pipeline.

## What happens without a key

| Surface                     | Behaviour                                                  |
| --------------------------- | ---------------------------------------------------------- |
| Grid render                 | Works.                                                     |
| Editing, sort, filter       | Works.                                                     |
| `pro.exportData(...)`       | Works.                                                     |
| `pro.importData(...)`       | Works.                                                     |
| `pro.ai.*`                  | Works.                                                     |
| `createPivotModel(...)`     | Works.                                                     |
| Studio: designer / panels   | Works.                                                     |
| Studio: `createSqlDataSource` | Works.                                                   |
| Studio: MCP generator       | Works; output carries a one-line notice.                   |
| Unlicensed watermark        | Visible on every grid instance.                            |
| Console nudge               | Logged once per page load.                                  |

Nothing is "trial mode" - the soft-gate is meant for evaluation. Once
you're sold, drop in a key.

## A Grid key on a Suite feature

The same soft gate, for the same reason. A Grid Developer License that opens
`<SvSheet>`, calls the formula engine, or reaches a Studio data source gets the
watermark and a one-time console notice naming the feature. Nothing stops
working and nothing is hidden, so a Grid-tier team can try the spreadsheet in
their own app before deciding to upgrade, exactly as an unlicensed team can.

```ts
import { licenseCovers } from '@svgrid/enterprise'

licenseCovers('spreadsheet') // false on a GRID key, true on SUITE
```

Use `licenseCovers` if you want to hide a Suite-only entry point in your own UI
rather than let it nudge.

## Studio (data-app generator)

The Studio - the schema designer, edit panel, master-detail, SQL data
source, and the AI generator - is part of the **same** Enterprise
license. One key covers everything; there's no separate Studio tier or
per-feature entitlement. It's **soft-gate only**: every Studio surface
runs unlicensed, it just nudges.

It has two places you set the key, because it runs in two places:

**1. In your app (the browser)** - the same `setLicenseKey()` you
already call. The designer, edit panel, master-detail, and data sources
all read it. Nothing new to do.

```ts
import { setLicenseKey } from '@svgrid/enterprise'
setLicenseKey(import.meta.env.VITE_SVPRO_KEY)
```

**2. In the AI generator (the MCP server)** - the generator runs in a
Node process (Claude Code / Desktop), so it reads the key from the
`SVGRID_LICENSE_KEY` environment variable in your MCP config. Set it
once:

```jsonc
{
  "mcpServers": {
    "svgrid": {
      "command": "npx",
      "args": ["@svgrid/mcp"],
      "env": { "SVGRID_LICENSE_KEY": "SVENTERPRISE-..." }
    }
  }
}
```

Without it, the generator still produces code - it just prepends a
one-line commercial notice, and the generated app carries the usual
watermark until you call `setLicenseKey()` in it. Same honor-system,
same key format, no network calls.

## License renewal

The license itself is perpetual; what renews each year is your
**updates-and-support term**. It renews automatically until you cancel
(cancel anytime). The key keeps validating every version released during
a paid term, and if you cancel or let the term lapse, your installed
version keeps working - you just stop receiving new releases and support.

- 60 days before the term ends: yellow nudge on the watermark
- 30 days: orange
- 7 days: red
- After the term ends (if you cancelled): features keep working; only
  versions released after your paid term need a renewed term

We never disable working features on a paying customer.

## Audit trail

Each license key has a stable ID embedded. The same key activates as
many builds as you want; the ID is what we cross-reference against
your subscription in support tickets. **No telemetry is sent** -
support uses the ID you give us, not anything we phoned home for.

## See also

- [Enterprise evaluation](./evaluation.md) - 30-day evaluation flow
- [Enterprise support](./support.md) - SLAs, escalation, contact channels
- [Pricing](https://svgrid.com/pricing/) - canonical pricing source
