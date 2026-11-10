# GDPR + data residency

`@svgrid/grid` is **GDPR-neutral**: it never transmits personal
data, never stores it server-side, and never logs it. If your app is
GDPR-compliant before adding the grid, adding it does not break
that compliance.

`@svgrid/enterprise` adds SvGrid Base and the server handlers. They still
send nothing to us, but they do move personal data, inside your app and to
systems you configure: Base reads and writes your database, a webhook sends
record fields to its URL, and a preview fetches an attachment's URL. Each
section below says what `@svgrid/grid` does and then what Base adds.

GDPR reviewers ask the same five questions every time - this page answers
each one.

## 1. Where does data live?

With `@svgrid/grid`: in your application's browser memory, for the
duration of the user's session. The grid never holds a copy outside
what's in the `data` prop.

With SvGrid Base: in the database you connect it to. The page holds the
records it reads, and undo history, in memory. Nothing of Base goes to
`localStorage`, and nothing goes to a server of ours.

**Exceptions you opt into:**

| Feature                                              | What gets written                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| [Saved views](../help/saved-views.md)                | View name + column widths + filter / sort state. Not the rows.     |
| [State maintenance](../help/state-maintenance.md)    | Same - state only, never data, unless you call `setData(...)`.     |
| [Clipboard copy/paste](../help/state-maintenance.md) | When the user explicitly copies, the row values land in the OS clipboard. |

| [Trash store](../help/base/undo-trash-import.md) (Base)   | A full copy of each deleted record, in the store you give it.      |

To audit: run your app with DevTools → Application → Local Storage.
With saved-views disabled, sv-grid writes nothing.

## 2. Does the library transmit personal data?

`@svgrid/grid`: no. It has **zero outbound network calls**. Inspect with
DevTools → Network: nothing from it appears.

Server-side adapters (your `onFiltersChange` / `onSortingChange`
handlers) ARE outbound calls, but they're code YOU wrote. The grid
just notifies you of state changes; what you do next is your code.

`@svgrid/enterprise` never calls us: no telemetry, analytics or update
checks. SvGrid Base does make calls, each to a place you or your people
chose:

| Call | Goes to | What it carries |
| ---- | ------- | --------------- |
| Reads and writes | Your `createBaseEndpoint` route, your database or your Supabase project | The records |
| Preview of an attachment | The attachment's URL, which can be on another host | The request itself: that host sees the reader's IP address |
| A webhook action | The URL in the automation | Record fields. Sent from the browser or from your server, as the automation says |
| An email action | Your `sendEmail` function | What the automation writes |
| An AI field | The `AIProvider` you register | The fields its prompt names |

A processor behind a webhook or an AI provider is yours to list in your own
records of processing. See [security](../help/security.md#svgrid-base).

**Logs.** The server handlers log failures. They log the driver's code and names,
with the values it quoted taken out, so a duplicate key does not write a person's
email to your logs. Your `audit` hook and anything your own `execute` logs are yours.

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

### Erasure in SvGrid Base

If a table uses `softDelete`, a delete is not an erasure. The row, with all its personal
data, stays in the table with its `deleted_at` set until it is purged. For an erasure request:

- Delete the record, then **Delete forever** or **Empty trash**, or run the SQL yourself.
  Purge is the real `DELETE`. It removes the record's junction rows, is final, and no undo
  in any open window brings the record back.
- A purge can be refused (another table still references the row). The person is told, and
  the record stays in the trash until it is resolved. Check it went.
- The `audit` hook logs `purge` once per record that was really deleted, which is the entry
  to keep as evidence. `delete` alone means marked.
- Marked rows have no age limit of their own: `trashDays` covers only items the page's trash
  stored. Set your retention with a scheduled `DELETE ... WHERE deleted_at < ...`.
- A trash store (`trashStore`) holds a full copy of each deleted record. Delete forever removes
  it, and your store's backups are yours to cover.
- Backups and database logs are outside what SvGrid can reach.

## 4. Does the library use cookies or fingerprinting?

No. The library:
- Sets no cookies.
- Reads no cookies.
- Does not call any fingerprinting API (`screen.width`, `navigator.platform`, `canvas.toDataURL` etc.) at runtime for the purpose of tracking.

Canvas is used on the page, and what is on one leaves it only in a file a
person exports. The grid and the spreadsheet measure text on one to size
columns and cells, a chart is drawn onto one to export it as an image or
a PDF, and the spreadsheet draws a picture for a sheet on one. None of it
is read for tracking.

## 5. Where are the docs hosted? Where is the npm registry?

| Surface                  | Hosted at                                       |
| ------------------------ | ----------------------------------------------- |
| Doc site (`svgrid.com`)  | GitHub Pages                                    |
| Source repo              | GitHub                                          |
| npm packages             | npmjs.com                                       |
| MCP server (`@svgrid/mcp`) | Your machine (runs locally)                   |
| Remote MCP server (optional) | `mcp.svgrid.com`, run by us                 |

If your data-residency policy requires EU-only origins, all of
these can be replaced:

- Mirror the docs internally (the `docs/` folder is in the repo).
- Use npmjs.eu or your private registry.
- The local MCP server has no upstream calls; it runs against your
  installed copy of `node_modules`. Use it, and not `mcp.svgrid.com`,
  if your policy rules out a hosted one. The hosted one is for AI coding
  assistants, is not in your application's runtime path, and what it
  records is on the [privacy page](https://svgrid.com/privacy/).

## Sub-processors

The library has none. There is no sv-grid service your application
depends on.

The doc site at `svgrid.com` and the optional `mcp.svgrid.com` run on
services we choose. Those are not sub-processors of your app. The systems
Base calls (the table above) are ones you choose, so they are yours to assess.

## Data-protection impact assessments

A DPIA is required when processing creates "high risk to rights and
freedoms". `@svgrid/grid` doesn't process data; your app does. The risk
profile of using it vs hand-writing a `<table>` is **identical** - both
display the data your app already has.

SvGrid Base is more than a view: it writes to your database and can send
records out through automations. Assess it as a part of your app, with its
webhooks and AI fields as flows of their own.

## See also

- [SOC 2 posture](./soc2.md)
- [HIPAA posture](./hipaa.md) - tighter rules for healthcare PHI
- [Security & supply chain](../help/security.md)
- [Saved views](../help/saved-views.md) - the one feature that writes to localStorage
