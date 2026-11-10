# SOC 2 posture

sv-grid is a set of libraries, not a service - so it cannot itself hold a
SOC 2 report. But it can sit inside a SOC 2-audited application, and
the controls below describe the line where the library's
responsibility ends and yours begins.

## TL;DR for procurement

> `@svgrid/grid` is a client-side JavaScript library shipped as MIT-licensed
> source. It performs no network IO, holds no user data, and has no
> backend. SOC 2 audit scope applies to your hosting and build
> pipeline, not the library. We give you the inputs (SBOM, security
> disclosure policy, deterministic builds) you need to include
> it in your own SOC 2 report.
>
> `@svgrid/enterprise` is commercial and ships minified. SvGrid Base in it
> runs on your server as well as in the page: it reads and writes your
> database, and its automations can call webhooks. We still operate nothing
> in your data path, but those parts of your app are in your scope. See
> [SvGrid Base](#svgrid-base).

## What the library guarantees

| SOC 2 control area    | Library covers                                                  |
| --------------------- | --------------------------------------------------------------- |
| **CC6.1 Logical access** | n/a for the grid - no service to log into. Base: see below    |
| **CC6.6 Encryption in transit** | n/a for the grid - no transit. Base: see below         |
| **CC7.1 System operations** | Bundle is deterministic; SHA-256 published per release      |
| **CC8.1 Change management** | Every change ships as a PR with reviews; release notes per version |
| **CC9.2 Vendor management** | One runtime dep in `@svgrid/grid` (`esm-env`, MIT, dependency-free); lazy peer deps in `@svgrid/enterprise` documented in [security](../help/security.md) |

## What you cover (in your own SOC 2)

| Control area          | Your responsibility                                             |
| --------------------- | --------------------------------------------------------------- |
| Hosting               | Wherever your app is served from (Vercel / Cloudflare / your own infra) |
| User authentication   | Your app's auth layer - sv-grid never sees credentials          |
| Data at rest          | Wherever your data sits BEFORE it reaches the grid              |
| Audit logging         | Wire `onCellValueChange` etc. to your audit pipeline - see [audit log](./audit-log.md) |
| Backup / restore      | Your DB - the grid is stateless                                  |
| Incident response     | Your SRE process                                                |

## SvGrid Base

Base adds code that runs in your app with your credentials, so these are controls of
your app that it takes part in:

| Control area | What Base gives you | What stays yours |
| ------------ | ------------------- | ---------------- |
| **CC6.1 Logical access** | `createBaseEndpoint` will not start without `authorize` or `public`, and `scope` keeps a tenant to its rows, its links and its junction tables. See [server handlers](../help/security.md#server-handlers). | Who your `authorize` lets in, and listing your tenant tables |
| **CC6.6 Encryption in transit** | A webhook URL can be `https:`, and the server runner refuses internal addresses | TLS on your route, your database connection and every webhook URL |
| **CC7.2 Monitoring** | The `audit` hook, and handler logs without the values a driver quoted | Keeping them. Reads are not audited |
| **CC9.2 Vendor management** | Nothing is sent to us | Each system an automation or an AI field reaches is a vendor of yours |

## Inputs we provide to your auditor

1. **MIT licence** - for `@svgrid/grid`: vetted by your legal team once, valid forever. `@svgrid/enterprise` is under its commercial licence.
2. **Public source code** - `@svgrid/grid` has no obfuscation; your auditor can read every line. `@svgrid/enterprise` is built from a private repository and published minified, and the Custom plan includes source-code escrow
3. **A shallow dependency tree** - `@svgrid/enterprise`, `@svgrid/grid-wc` and `@svgrid/ui` declare no runtime dependencies; `@svgrid/grid` declares one, `esm-env` (MIT), which has none of its own, so the transitive tree is one package deep. Verify with `npm view @svgrid/grid dependencies`. The two optional peers for Enterprise export (`jszip`, `pdfmake`, both MIT) are listed in [security](../help/security.md)
4. **Published SBOM** - a CycloneDX 1.6 document per package under [`sbom/`](https://github.com/sv-grid/sv-grid/tree/main/sbom), covering runtime and peer dependencies to full declared depth. Regenerate with `pnpm sbom`; `pnpm sbom:check` fails if it has drifted from the manifests. Satisfies the EU Cyber Resilience Act's machine-readable SBOM expectation
5. **Security disclosure policy** - report through GitHub's private vulnerability reporting or by email to `boikom@jqwidgets.com` with `SECURITY` in the subject, as [SECURITY.md](https://github.com/sv-grid/sv-grid/blob/main/SECURITY.md) says; response times are in [security](../help/security.md)
6. **Vulnerability history** - every CVE attributed to sv-grid published in the [changelog](../changelog.md) with disclosure date, fix version, mitigation
7. **npm provenance** - `@svgrid/grid` is published from CI with `--provenance`, so npm records a verifiable link from the tarball back to the building workflow and commit

## Common auditor questions

> *"Is there a SOC 2 report for sv-grid?"*

No - it would be meaningless. There's no service. The library is a
dependency of your application, the same way React or Svelte is. Your
auditor will treat it as a dependency, in scope under CC9.2.

> *"Does sv-grid have access to our data?"*

No. `@svgrid/grid` runs in the user's browser, and your data is whatever
your app hands to the `<SvGrid data={...}>` prop. SvGrid Base also runs on
your server, with your database credentials. Neither sends anything to us:
we never see it.

> *"Can we self-host the docs?"*

Yes - the entire `docs/` folder is in the repo. Clone, build, host
behind your VPN if your compliance regime requires it. The
[MCP server](../help/mcp-server.md) runs locally too, and `mcp.svgrid.com`
is an optional hosted copy for AI coding assistants.

> *"What happens if a CVE is found in sv-grid?"*

Triage within 24h. High-severity patches typically ship within 7
days. Subscribers to the GitHub release notifications get the
release tag the moment we cut it. We backport security fixes to the
last 2 minor versions; see [api-stability](../help/api-stability.md)
for the support window.

## See also

- [GDPR + data residency](./gdpr.md)
- [Security & supply chain](../help/security.md) - SBOM, signing, dep table
- [Audit log integration](./audit-log.md) - turn callbacks into audit events
