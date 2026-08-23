# SOC 2 posture

sv-grid is a UI library, not a service - so it cannot itself hold a
SOC 2 report. But it can sit inside a SOC 2-audited application, and
the controls below describe the line where the library's
responsibility ends and yours begins.

## TL;DR for procurement

> sv-grid is a client-side JavaScript library shipped as MIT-licensed
> source. It performs no network IO, holds no user data, and has no
> backend. SOC 2 audit scope applies to your hosting and build
> pipeline, not the library. We give you the inputs (SBOM, security
> disclosure policy, deterministic builds) you need to include
> sv-grid in your own SOC 2 report.

## What the library guarantees

| SOC 2 control area    | Library covers                                                  |
| --------------------- | --------------------------------------------------------------- |
| **CC6.1 Logical access** | n/a - no service to log into                                  |
| **CC6.6 Encryption in transit** | n/a - no transit                                       |
| **CC7.1 System operations** | Bundle is deterministic; SHA-256 published per release      |
| **CC8.1 Change management** | Every change ships as a PR with reviews; release notes per version |
| **CC9.2 Vendor management** | 0 runtime deps in `@svgrid/grid`; lazy peer deps in `@svgrid/enterprise` documented in [security](../help/security.md) |

## What you cover (in your own SOC 2)

| Control area          | Your responsibility                                             |
| --------------------- | --------------------------------------------------------------- |
| Hosting               | Wherever your app is served from (Vercel / Cloudflare / your own infra) |
| User authentication   | Your app's auth layer - sv-grid never sees credentials          |
| Data at rest          | Wherever your data sits BEFORE it reaches the grid              |
| Audit logging         | Wire `onCellValueChange` etc. to your audit pipeline - see [audit log](./audit-log.md) |
| Backup / restore      | Your DB - the grid is stateless                                  |
| Incident response     | Your SRE process                                                |

## Inputs we provide to your auditor

1. **MIT licence** - vetted by your legal team once, valid forever
2. **Public source code** - no obfuscation; your auditor can read every line
3. **Zero runtime dependencies** - `@svgrid/grid`, `@svgrid/enterprise`, `@svgrid/grid-wc` and `@svgrid/ui` each declare no runtime dependencies, so there is no transitive tree to review. Verify with `npm view @svgrid/grid dependencies`. The two optional peers for Enterprise export (`jszip`, `pdfmake`, both MIT) are listed in [security](../help/security.md)
4. **SBOM on request** - generate one against any installed version with `npx @cyclonedx/cdxgen -o sbom.json`; see [security](../help/security.md#sbom)
5. **Security disclosure policy** - email `support@jqwidgets.com`, GPG fingerprint published, response SLA documented in [security](../help/security.md)
6. **Vulnerability history** - every CVE attributed to sv-grid published in the [changelog](../changelog.md) with disclosure date, fix version, mitigation
7. **npm provenance** - `@svgrid/grid` is published from CI with `--provenance`, so npm records a verifiable link from the tarball back to the building workflow and commit

## Common auditor questions

> *"Is there a SOC 2 report for sv-grid?"*

No - it would be meaningless. There's no service. The library is a
dependency of your application, the same way React or Svelte is. Your
auditor will treat it as a dependency, in scope under CC9.2.

> *"Does sv-grid have access to our data?"*

No. The library runs in the user's browser. Your data is whatever
your app hands to the `<SvGrid data={...}>` prop. We never see it.

> *"Can we self-host the docs?"*

Yes - the entire `docs/` folder is in the repo. Clone, build, host
behind your VPN if your compliance regime requires it. The
[MCP server](../help/mcp-server.md) runs locally too.

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
