# Security & supply chain

SvGrid is built for shipping into regulated environments where every
dependency, every runtime call, and every network egress has to be
justified before procurement signs. This page is the answer to "what
does this package do, what does it depend on, and what would I tell
our InfoSec team?".

![The SvGrid library renders and holds state inside the browser and opens no connection of its own - no fetch, no telemetry; only your app code crosses the boundary to the network to fetch rows and persist changes.](/docs-media/grid-security.svg)

<div data-docs-demo="16-csp-compliant" data-height="540"></div>

## TL;DR

| Property                          | Status                                                                 |
| --------------------------------- | ---------------------------------------------------------------------- |
| Network egress at runtime         | **None to us.** Zero analytics, zero phone-home, no automatic update checks. SvGrid Base in `@svgrid/enterprise` also reaches your own systems: see [SvGrid Base](#svgrid-base). |
| Telemetry                         | **Zero.** No `fetch`, no `navigator.sendBeacon`, no console identifiers. |
| `eval` / `new Function` / dynamic code | **None in `@svgrid/grid`.** See [CSP-compliant grid](https://svgrid.com/demos/16-csp-compliant/) demo + runtime self-check. |
| Cookies / localStorage            | None set by the library itself. (Your app's saved-views helpers may opt in.) |
| Outbound dependencies             | **Community:** one runtime dep, `esm-env` (MIT, no dependencies of its own). **Enterprise:** five optional peer deps (`jszip`, `pdfmake`, and `react`, `react-dom`, `vue` for the framework wrappers), see below. |
| AI calls                          | The user's own `AIProvider` adapter calls whichever endpoint *they* configured. The package never embeds a model client. |
| License                           | Community: MIT. Enterprise: commercial (see [LICENSE](../../packages/enterprise/LICENSE)). |
| npm provenance + signing          | Published with `npm publish --provenance` from GitHub Actions; integrity hashes in the npm registry. |
| Source                            | `@svgrid/grid` and the other MIT packages: open source, in this monorepo, the same code that ships to npm. `@svgrid/enterprise`: commercial, built from a private repository and published as a minified build with type declarations. `pnpm patch` works on the published files of either. |

## Runtime dependencies

`@svgrid/grid` has **one runtime dependency**, [`esm-env`](https://www.npmjs.com/package/esm-env)
(MIT), which has no dependencies of its own and only reports the build's
browser / dev / SSR conditions. Beyond that the user's build pulls in
`svelte` itself (peer). Verify with `npm view @svgrid/grid dependencies`.

`@svgrid/enterprise` adds five **optional** peer dependencies. Two are lazy-loaded
on first use, and three are needed only by the framework wrappers:

| Peer            | When loaded                                  | License        | Why optional                                                     |
| --------------- | -------------------------------------------- | -------------- | ---------------------------------------------------------------- |
| `jszip` ^3.10   | `api.exportData({ format: 'xlsx' })` *or* `api.importData({ format: 'xlsx' })` | MIT            | If you don't export/import Excel, you don't install this peer. |
| `pdfmake` ^0.2 or ^0.3 | `api.exportData({ format: 'pdf' })`    | MIT            | If you don't export to PDF, you don't install this peer.         |
| `react` and `react-dom` >=17 | Importing `@svgrid/enterprise/wc/react` or `/wc/base/react` | MIT | Only for a React app using the web components. |
| `vue` >=3.3     | Importing `@svgrid/enterprise/wc/vue` or `/wc/base/vue` | MIT | Only for a Vue app using the web components. |

None is bundled. `jszip` and `pdfmake` are dynamically `import()`-ed at first call. If
the consumer hasn't installed one, the call throws a typed error naming the
missing module and the install command - the rest of the library keeps working.

One piece of third-party code *is* bundled: `@svgrid/enterprise` ships the
Smart UI export module (jQWidgets) as `dist/smart.export.js`, vendored
unmodified. The SBOM lists it as a component with its version.

CSV, TSV, HTML, JSON import/export, print, the AI assistant, and the
pivot helpers have **no extra peer dependencies** at all.

## What the package does at runtime

Every observable side effect, mapped:

| Surface                              | Side effect                                                                |
| ------------------------------------ | -------------------------------------------------------------------------- |
| `<SvGrid>` mount                     | Sets up `requestAnimationFrame`, `ResizeObserver`, and DOM event listeners on the grid container. |
| Inline editing                       | Reads + writes `document` selection; commits via your `onCellValueChange`. |
| Export to xlsx / pdf / csv / tsv / html | Creates a `Blob` and triggers a download via a synthetic `<a download>`. No network. CSV and TSV prefix formula-like text with `'` so a spreadsheet does not run it ([export](./export.md)). |
| Import from xlsx / csv / tsv / json  | Reads the user-provided `File` via `arrayBuffer()` / `text()`. No network. An .xlsx cell addressed outside the sheet (past column XFD) is rejected, and so is a sheet that would need more than ten million blank cells to lay out. An .xlsx or .ods is unzipped as a stream and refused once its parts pass 256 MB together, so a zip bomb never lands in memory. A crafted file cannot exhaust memory either way. |
| Print                                | Opens a same-origin popup with `window.open`, writes the HTML document into it and calls its `print()`. The document carries a CSP of `script-src 'none'`, so a value in it runs no script. The popup is not a sandbox: it shares your origin. |
| AI helpers                           | Build a prompt locally and call the consumer-registered `AIProvider`. The grid itself never opens a connection. |
| License key check                    | The key's SHA-256 digest compared with the one in the package. No network. |
| Unlicensed watermark                 | Renders a small DOM badge linking to the pricing page. No network. |
| SvGrid Base                          | Reads and writes through the source you give it, and reads an attachment's URL for a PDF preview. See [SvGrid Base](#svgrid-base). |
| Unlicensed upgrade prompt            | On first unlicensed Enterprise feature call, appends a one-time DOM card linking to a trial. No network, no storage; one in-memory flag. |

## SvGrid Base

SvGrid Base, in `@svgrid/enterprise`, does more than draw a grid: it has code that
runs on your server, and it reaches systems you name. Nothing here calls us.

### What it connects to

| From | To | When |
| --- | --- | --- |
| The page | Your endpoint (`createKitDataSource`, `baseFromEndpoint`), your REST API, or your Supabase project | Every read and write of a table on one. Supabase also reads `/rest/v1/` to learn the columns. |
| The page | An attachment's URL | The browser loads an image with `<img>`, and the library itself `fetch`es a file a person opens in a PDF preview. |
| Your server | Your database | Through the `execute` you pass, with your driver and your credentials. |
| Your server | A webhook's URL | When a server automation runs. Its author wrote the URL. |
| Your server | Your mail provider | Through the `sendEmail` you pass. The library sends no mail itself. |

Under a strict CSP, `connect-src` and `img-src` need your attachment host and your
endpoint, and `frame-src blob:` allows the PDF preview. Without those a PDF offers
its Download link instead.

### Webhooks and email

A server automation runs in your server with its network position, and whoever can
write an automation chooses the URL. So:

- It refuses private, local, link-local and reserved addresses, the cloud metadata
  service, names under `.internal`, `.local` and the like, and IPv6 forms that wrap
  one (`::ffff:`, NAT64, 6to4). `allowInternalWebhooks: true` lifts this.
- The name is checked and then the connection is made to those checked addresses,
  on Node, so a name cannot resolve one way for the check and another for the call.
  A `fetch` of your own passed to `createAutomationServer` gets the check but not
  that pin, and neither does a runtime with no socket API of its own.
- It does not follow a redirect.
- A secret is named by the automation (`{secret:NAME}`), from the `secrets` you
  list. What a record holds is data: `{secret:NAME}` typed into a field stays text.
  Whoever can write an automation can send any secret you list, so list only those
  it needs.

The browser runner has no secrets and cannot send email, and a browser's own rules
apply to its webhooks.

### Attachments

- Only `http:`, `https:` and `blob:` URLs are used. An attachment's `type` is what a
  client said, so a preview does not believe it.
- A PDF is framed only when its bytes could be read and are a PDF, and then as a
  copy the library typed itself. Anything else, a file on a host that sends no CORS
  headers included, offers a download. A page calling itself `contract.pdf` never
  runs in the dialog.
- Uploading is your `upload` function: the library stores nothing and scans nothing.
  File type and size limits in the page are a convenience, so check them on your
  server too.

### Server handlers

- The schema is the whitelist: a column off it is not read, returned or written.
- `createBaseEndpoint` will not start until you say who may use it and which tables
  it serves. `authorize` runs on every read and write, `GET` included.
- `scope` keeps a tenant to its rows on every path. A resolver that gives an empty or
  missing value is a refusal, never "every row". Only an explicit `null` means no
  scope.
- A junction table is scoped by a tenant column of its own or through its parent
  record, and a `null` for a junction between scoped tables is a `403`. See
  [links under a tenant](./base/quick-start.md#links-under-a-tenant).
- A foreign key written through `createBaseEndpoint` must name a record inside its
  table's scope. Another tenant's record and no record get the same `409`, so links
  do not tell one tenant which keys another holds. A table the route does not serve is
  not checked.
- A key is unique across tenants, so creating a record with another tenant's key gets
  a `409`. It says the key exists and nothing else. Use keys nobody can guess.
- The route takes `application/json` only and refuses a `POST` from another site, by
  `Origin` and `Sec-Fetch-Site`. Add a page on another host with `origins`.
- Writes are checked on the server only if you pass `validate` or `hooks`.
- A driver's error stays on the server. A client gets a plain reason and a code, and
  the log gets the codes and names with the values the driver quoted taken out.
- `isSecretColumn` keeps columns named like credentials out of a base. It reads the
  **name** only, and is a default, not a guarantee: read your tables and use `hide`.
  `session_id` is not on its list, because it is a plain foreign key in many schemas, and
  neither is the `id` of a table of sessions: name those yourself.
- A key cannot be hidden, because a record has to be named to be changed. So a table
  whose key is named like a credential does not start until you name it in
  `exposeSecretKeys`. Until then no client reads it, and a foreign key holding that value
  stays out as well.
- An automation's webhook and email are described by `GET` only to a person `authorize`
  lets change the table, and an automation that runs on the server never sends its URL,
  headers or addresses to a page. A webhook that runs in the browser has to be in the
  page, so its URL is a person's to see: run it on the server if the URL is a secret.
  On Supabase a table's comment, automations included, is in the API description any
  holder of the anon key can read, so name a secret there with `{secret:NAME}`.
- A delete on a soft-delete table keeps the row and its personal data until it is
  purged: see [GDPR](../compliance/gdpr.md#erasure-in-svgrid-base). The `audit` hook
  logs marks, restores and purges apart: see [audit log](../compliance/audit-log.md#soft-delete-restore-and-purge).

### Stored content

Rich text is sanitized on the way in and on the way out, and an outside image in it
becomes a link, so opening a record makes no request to another host. A color from
data (a select option, a record's value on a board or a calendar, an alert rule, a
spreadsheet cell's format) must be a color: `red;background:url(...)` is dropped. CSV
exports guard formula-like text, and Excel exports write no formulas.

The print window and the HTML export run no script: their document carries a
`script-src 'none'` policy, a link in them is `http`, `https`, `mailto`, `tel` or
`blob` only, and a color goes through the same check. An SQL download keeps a table's
name inside its comment line, whatever the name holds.

## CSP guidance

The community grid is CSP-friendly. A strict policy that works:

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
connect-src 'self';
```

Notes:

- `'unsafe-inline'` on `style-src` is needed because Svelte 5 emits
  scoped style attributes inline. You can drop it if you switch to
  `unsafe-hashes` with a CSP nonce-aware build of Svelte.
- `connect-src 'self'` is enough for the grid, which never opens a connection to
  a third-party origin. SvGrid Base needs [a little more](#what-it-connects-to). With
  `img-src` and `frame-src` opened as that section says, Base raised no violation in a
  grid, board, calendar, Gantt, gallery, list or form view, and needs no `'unsafe-eval'`.
- `script-src` does NOT need `'unsafe-eval'` for community. (Enterprise pulls
  in `pdfmake` which historically used `eval`; check the pdfmake version
  if your CSP is strict.)
- Demo [16. CSP-compliant grid](https://svgrid.com/demos/16-csp-compliant/) runs the grid under a CSP header and surfaces any violation in real time.
- Trusted Types: the grid and SvGrid Base render under `require-trusted-types-for 'script'`.
  Rich text goes through the sanitizer and one policy named `svgrid`; Svelte adds
  `svelte-trusted-html`. With a policy list, write
  `trusted-types svgrid svelte-trusted-html`, plus `'allow-duplicates'` when the page loads
  SvGrid twice. Chart Print draws a `data:` image. The paths that do not run under it
  (`printGrid` opening its window, the spreadsheet's Print, file open and HTML paste, and an `SvTour`
  step `image` given as markup) are listed in
  [SECURITY.md](https://github.com/sv-grid/sv-grid/blob/main/SECURITY.md#trusted-types).

## Source provenance

- Source repository: `github.com/sv-grid/sv-grid` - all releases tagged.
- Build pipeline: GitHub Actions. The release workflow signs and
  publishes to npm with `--provenance`. You can verify the signature
  via `npm audit signatures` (npm 9+) or by inspecting the
  package metadata on the registry.
- No private patches to the MIT packages: the code on npm is the code in the
  public monorepo at the tagged commit. `@svgrid/enterprise` is built by the
  same pipeline from a private repository, so its source cannot be read there.
  The Custom plan includes source-code escrow.

## Vulnerability handling

- Reports: open a draft security advisory on the GitHub repository, or
  email the address in
  [SECURITY.md](https://github.com/sv-grid/sv-grid/blob/main/SECURITY.md).
  [`/.well-known/security.txt`](https://svgrid.com/.well-known/security.txt)
  points to the same place.
- Response times, for any report: acknowledgement within 3 working days and
  an initial assessment within 10 working days, as
  [SECURITY.md](https://github.com/sv-grid/sv-grid/blob/main/SECURITY.md) says.
- Enterprise customers: acknowledgement within one business day, advisory and
  patch within five business days for severity High and Critical.
- Public advisories for Enterprise customers go out via the support Slack +
  email **before** the GitHub advisory page goes public.

## SBOM

We publish a **CycloneDX 1.6** document per package in
[`sbom/`](https://github.com/sv-grid/sv-grid/tree/main/sbom), covering runtime
and peer dependencies to full declared depth, plus vendored code. Fetch the
one you need straight from the repo, or regenerate from a clone:

```bash
pnpm sbom          # write sbom/*.cdx.json
pnpm sbom:check    # non-zero exit if they have drifted from the manifests
```

The release workflow regenerates the SBOMs at the released versions and signs
them with a Sigstore build attestation, and the Test workflow runs
`pnpm sbom:check` on every commit. To check that a copy is the one the
release produced:

```bash
gh attestation verify sbom/svgrid-grid.cdx.json --repo sv-grid/sv-grid
```

`@svgrid/mcp` is the one package with a deeper graph (the MCP SDK, `zod`,
`svelte`); its SBOM lists those top-level dependencies, not their own.

If your process prefers a scanner-produced document, or you want SPDX instead,
generate one against your own installed tree:

```bash
npx @cyclonedx/cdxgen -t npm -o sbom.json
```

For Enterprise, the SBOM lists `jszip`, `pdfmake`, `react`, `react-dom` and `vue` as optional peers - flag
to your scanner if you don't use those formats.

## Data residency

`@svgrid/grid` processes data **in the browser**. Nothing leaves the user's
machine via the package itself. SvGrid Base also reaches
[the systems you name](#what-it-connects-to).

If you wire `setAIProvider(fn)` to a remote endpoint, the prompt + row
sample the helpers build (a column schema + at most ~25 sampled rows)
is what goes through your adapter. The package gives you the prompt
verbatim before sending - you decide whether to redact, route to an
on-prem model, or hash sensitive fields.

## Audit-friendly defaults

- **No global state** beyond a few module-scoped variables for the
  license + AI provider registration. No singletons that survive HMR.
- **Pure-function helpers** for filtering / sorting / aggregation -
  every callable you import is testable in isolation (vitest suite
  proves this for 1000+ assertions).
- **No prototype pollution surface.** Every helper uses
  `Object.create(null)` or own-property maps; no untyped object
  merging.
- **No reflection-driven config.** Column definitions are plain
  objects; the grid never reads metadata via `eval` or `with`.

## Frequently asked questions

### Is SvGrid safe to use in a regulated or enterprise environment?

Yes. `@svgrid/grid` is a client-side library: it makes no network calls of its
own, sends no telemetry, and runs CSP-clean (no `eval`, no `new Function`, no
inline scripts). All data stays in the browser, so it does not change your app's
data egress posture. SvGrid Base in `@svgrid/enterprise` has server code and reaches
your own database, webhooks and attachment hosts, listed in
[SvGrid Base](#svgrid-base).

### Does SvGrid send any telemetry or phone home?

No. Nothing goes to us: no telemetry, no update checks. The grid makes no calls of
its own. SvGrid Base makes the ones [listed above](#what-it-connects-to), all to
systems you configure or a person chose.

### What is SvGrid's supply-chain footprint?

The Community core has a minimal dependency surface; Enterprise export/import features
lazy-load their dependencies only when used. See this page for the full
dependency and runtime-call accounting procurement asks for.

## See also

- [Browser support](./browser-support.md) - tested target matrix.
- [Testing and quality](./testing-and-quality.md) - the test suite that
  underwrites this page's claims.
- [API stability](./api-stability.md) - semver policy, deprecation
  lifecycle.
