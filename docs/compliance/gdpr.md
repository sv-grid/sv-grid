# GDPR + data residency

sv-grid is **GDPR-neutral**: the library never transmits personal
data, never stores it server-side, and never logs it. If your app is
GDPR-compliant before adding sv-grid, adding sv-grid does not break
that compliance.

That said, GDPR reviewers ask the same five questions every time -
this page answers each one.

## 1. Where does data live?

In your application's browser memory, for the duration of the user's
session. The grid never holds a copy outside what's in the `data`
prop.

**Exceptions you opt into:**

| Feature                                              | What gets written                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| [Saved views](../help/saved-views.md)                | View name + column widths + filter / sort state. Not the rows.     |
| [State maintenance](../help/state-maintenance.md)    | Same - state only, never data, unless you call `setData(...)`.     |
| [Clipboard copy/paste](../help/state-maintenance.md) | When the user explicitly copies, the row values land in the OS clipboard. |

To audit: run your app with DevTools → Application → Local Storage.
With saved-views disabled, sv-grid writes nothing.

## 2. Does the library transmit personal data?

No. The library has **zero outbound network calls**. Inspect with
DevTools → Network: nothing from sv-grid appears.

Server-side adapters (your `onFiltersChange` / `onSortingChange`
handlers) ARE outbound calls, but they're code YOU wrote. The grid
just notifies you of state changes; what you do next is your code.

## 3. How do we honour data-subject requests?

GDPR Articles 15-22 (access, rectification, erasure, portability,
restriction, objection, automated decision-making) all apply to your
DATABASE, not the grid. The grid is purely a view layer.

The one nuance: if you use [saved views](../help/saved-views.md) to
persist user-specific layouts, those layouts may count as personal
data under Article 4(1). Two safe responses:

```ts
// Article 15: provide a copy.
const allViews = JSON.parse(localStorage.getItem('svgrid:views') ?? '{}')

// Article 17: forget.
localStorage.removeItem('svgrid:views')
api.clearAllFilters()
api.setColumnPinning({ left: [], right: [] })
```

If your saved views live server-side (the recommended pattern for
multi-device users), your existing data-subject endpoint covers them.

## 4. Does the library use cookies or fingerprinting?

No. The library:
- Sets no cookies.
- Reads no cookies.
- Does not call any fingerprinting API (`screen.width`, `navigator.platform`, `canvas.toDataURL` etc.) at runtime for the purpose of tracking.

The PDF/xlsx exporters use `canvas.toDataURL` to rasterise SVG
thumbnails for embedding - that's the only canvas use anywhere, and
it happens locally for the export only.

## 5. Where are the docs hosted? Where is the npm registry?

| Surface                  | Hosted at                                       |
| ------------------------ | ----------------------------------------------- |
| Doc site (`svgrid.com`)  | Vercel (US, EU edge)                            |
| Source repo              | GitHub                                          |
| npm packages             | npmjs.com                                       |
| MCP server               | Your machine (runs locally)                     |

If your data-residency policy requires EU-only origins, all of
these can be replaced:

- Mirror the docs internally (the `docs/` folder is in the repo).
- Use npmjs.eu or your private registry.
- The MCP server has no upstream calls; it runs against your
  installed copy of `node_modules`.

## Sub-processors

The library has none. There is no sv-grid service.

For the doc site at `svgrid.com` we use Vercel + GitHub OAuth (for
the "Edit on GitHub" link only) - these are not sub-processors of
your app, just of the doc site.

## Data-protection impact assessments

A DPIA is required when processing creates "high risk to rights and
freedoms". The library itself doesn't process data; your app does.
The risk profile of using sv-grid vs hand-writing a `<table>` is
**identical** - both display the data your app already has.

## See also

- [SOC 2 posture](./soc2.md)
- [HIPAA posture](./hipaa.md) - tighter rules for healthcare PHI
- [Security & supply chain](../help/security.md)
- [Saved views](../help/saved-views.md) - the one feature that writes to localStorage
