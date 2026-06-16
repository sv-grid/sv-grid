# Enterprise licensing

The `@svgrid/enterprise` package is **soft-gated**: every feature runs
without a key, with a small unlicensed-build watermark in the
bottom-right corner of the grid + a one-time console nudge. Set a
key once at app startup and both disappear.

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

| License                                    | Apps covered                        | Price (per developer) | Support                                   |
| ------------------------------------------ | ----------------------------------- | --------------------- | ----------------------------------------- |
| **Single Application Developer License**   | One deployed production app         | **$599**              | Email (next business day) + private Slack |
| **Multiple Application Developer License** | Unlimited apps in your organisation | **$999**              | Email (next business day) + private Slack |
| **Enterprise / volume**                    | Unlimited                           | Custom quote          | Priority + named contact, NDA / PO        |

> Priced **per developer** - engineers who write or modify code that imports
> `@svgrid/enterprise`. Production seats / end users are unlimited. One license key
> activates every grid in scope - no per-page or per-component accounting.
> Teams of 5+ and multi-year terms get volume discounts; email
> `sales@jqwidgets.com`.

## License key format

```
SVENTERPRISE-IXIX-XXXX-XXXX-XXXX-XXXX
       │
       └── single hex-encoded payload, verified locally
```

The check is purely client-side, signed against our public key.
**No network call** is ever made to validate. Air-gapped deployments
work out of the box.

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
| Unlicensed watermark        | Visible on every grid instance.                            |
| Console nudge               | Logged once per page load.                                  |

Nothing is "trial mode" - the soft-gate is meant for evaluation. Once
you're sold, drop in a key.

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
- [Pricing](https://svgrid.com/pricing) - canonical pricing source
