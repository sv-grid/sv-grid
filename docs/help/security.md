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
| Network egress at runtime         | **None.** Zero analytics, zero phone-home, no automatic update checks. |
| Telemetry                         | **Zero.** No `fetch`, no `navigator.sendBeacon`, no console identifiers. |
| `eval` / `new Function` / dynamic code | **None in `@svgrid/grid`.** See [CSP-compliant grid](https://svgrid.com/demos/16-csp-compliant/) demo + runtime self-check. |
| Cookies / localStorage            | None set by the library itself. (Your app's saved-views helpers may opt in.) |
| Outbound dependencies             | **Community:** zero runtime deps. **Enterprise:** two optional peer deps (`jszip`, `pdfmake`), see below. |
| AI calls                          | The user's own `AIProvider` adapter calls whichever endpoint *they* configured. The package never embeds a model client. |
| License                           | Community: MIT. Enterprise: commercial (see [LICENSE](../../packages/enterprise/LICENSE)). |
| npm provenance + signing          | Published with `npm publish --provenance` from GitHub Actions; integrity hashes in the npm registry. |
| Source                            | 100% open source. `pnpm patch` works; everything in this monorepo is the same code that ships to npm. |

## Runtime dependencies

`@svgrid/grid` has **zero runtime dependencies**. It is a single
package with no transitive supply chain - the only thing the user's
build pulls in is `svelte` itself (peer).

`@svgrid/enterprise` adds two **optional** peer dependencies, both lazy-loaded
on first use:

| Peer            | When loaded                                  | License        | Why optional                                                     |
| --------------- | -------------------------------------------- | -------------- | ---------------------------------------------------------------- |
| `jszip` ^3.10   | `api.exportData({ format: 'xlsx' })` *or* `api.importData({ format: 'xlsx' })` | MIT            | If you don't export/import Excel, you don't install this peer. |
| `pdfmake` ^0.2  | `api.exportData({ format: 'pdf' })`          | MIT            | If you don't export to PDF, you don't install this peer.         |

Neither is bundled. Both are dynamically `import()`-ed at first call. If
the consumer hasn't installed the peer, the call throws a typed error
naming the missing module and the install command - the rest of the
library keeps working.

CSV, TSV, HTML, JSON import/export, print, the AI assistant, and the
pivot helpers have **no extra peer dependencies** at all.

## What the package does at runtime

Every observable side effect, mapped:

| Surface                              | Side effect                                                                |
| ------------------------------------ | -------------------------------------------------------------------------- |
| `<SvGrid>` mount                     | Sets up `requestAnimationFrame`, `ResizeObserver`, and DOM event listeners on the grid container. |
| Inline editing                       | Reads + writes `document` selection; commits via your `onCellValueChange`. |
| Export to xlsx / pdf / csv / tsv / html | Creates a `Blob` and triggers a download via a synthetic `<a download>`. No network. |
| Import from xlsx / csv / tsv / json  | Reads the user-provided `File` via `arrayBuffer()` / `text()`. No network. |
| Print                                | Opens a sandbox popup window with an isolated HTML document and calls its `print()`. |
| AI helpers                           | Build a prompt locally and call the consumer-registered `AIProvider`. The grid itself never opens a connection. |
| License key check                    | A 4-line string-prefix check against an in-memory revoked-key set. No network. |
| Unlicensed watermark                 | Renders a small DOM badge linking to the pricing page. No network. |
| Unlicensed upgrade prompt            | On first unlicensed Enterprise feature call, appends a one-time DOM card linking to a trial. No network, no storage; one in-memory flag. |

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
- `connect-src 'self'` is enough - the grid never opens a connection to
  a third-party origin.
- `script-src` does NOT need `'unsafe-eval'` for community. (Enterprise pulls
  in `pdfmake` which historically used `eval`; check the pdfmake version
  if your CSP is strict.)
- Demo [16. CSP-compliant grid](https://svgrid.com/demos/16-csp-compliant/) runs the grid under a CSP header and surfaces any violation in real time.

## Source provenance

- Source repository: `github.com/sv-grid/sv-grid` - all releases tagged.
- Build pipeline: GitHub Actions. The release workflow signs and
  publishes to npm with `--provenance`. You can verify the signature
  via `npm audit signatures` (npm 9+) or by inspecting the
  package metadata on the registry.
- No private patches. The code on npm is the code in the public
  monorepo at the tagged commit.

## Vulnerability handling

- Reports: open a draft security advisory on the GitHub repository, or
  email `support@jqwidgets.com`. PGP key on the repository's SECURITY.md.
- Response SLA (paid customers): acknowledgement within one business
  day, advisory + patch within five business days for severity High +
  Critical.
- Community: best-effort but every report is triaged.
- Public advisories for Enterprise customers go out via the support Slack +
  email **before** the GitHub advisory page goes public.

## SBOM

We publish a **CycloneDX 1.6** document per package in
[`sbom/`](https://github.com/sv-grid/sv-grid/tree/main/sbom), covering runtime
and peer dependencies to full declared depth. Fetch the one you need straight
from the repo, or regenerate from a clone:

```bash
pnpm sbom          # write sbom/*.cdx.json
pnpm sbom:check    # non-zero exit if they have drifted from the manifests
```

If your process prefers a scanner-produced document, or you want SPDX instead,
generate one against your own installed tree:

```bash
npx @cyclonedx/cdxgen -t npm -o sbom.json
```

For Enterprise, the SBOM lists `jszip` and `pdfmake` as optional peers - flag
to your scanner if you don't use those formats.

## Data residency

The library processes data **in the browser**. Nothing leaves the user's
machine via the package itself.

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

Yes. SvGrid is a client-side library: it makes no network calls of its own,
sends no telemetry, and runs CSP-clean (no `eval`, no `new Function`, no inline
scripts). All data stays in the browser, so it does not change your app's data
egress posture.

### Does SvGrid send any telemetry or phone home?

No. There is zero outbound traffic from the library. Any network calls in your
app are ones you write.

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
