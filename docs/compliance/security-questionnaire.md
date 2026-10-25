# Security questionnaire answers

Answers to the questions a vendor security review asks about a front-end
component library, grouped the way most questionnaires (SIG Lite, CAIQ, a
buyer's own) group them. Each answer points at the code, file or workflow that
backs it, so a reviewer can check it rather than take it on trust.

Questions about the company rather than the product (insurance, headcount,
financial statements) go to sales@jqwidgets.com.

## Scope: what is being assessed

| Question | Answer |
| --- | --- |
| What is the product? | JavaScript packages installed from npm: `@svgrid/grid` (MIT) and `@svgrid/enterprise` (commercial). They run inside your application, in the browser or under Node for SSR. |
| Is it a hosted service? | **No.** We operate no service your application depends on. Your data never reaches a system of ours. |
| Do you host anything at all? | The website (svgrid.com), the trial and licensing forms, and an optional remote MCP server (mcp.svgrid.com) for AI coding assistants. None of them is in your application's runtime path. What the MCP server records is listed on the [privacy page](https://svgrid.com/privacy/). |
| Does a SOC 2 report apply? | SOC 2 examines service organizations, and we run no service in your data path. See [SOC 2 posture](./soc2.md) for how the library fits your own report. |

## Data handling

| Question | Answer |
| --- | --- |
| Does the library send data anywhere? | **No.** No telemetry, analytics or update checks. The only network calls are ones you configure: a server data source calls the `fetch` you pass it, and the AI helpers call the `AIProvider` you register. |
| Does the license check phone home? | **No.** The Enterprise key is validated offline, in the browser. Without a valid key the features still run and show a watermark. |
| Does it write to storage? | Not unless you opt in (saved views, for example). See [GDPR + data residency](./gdpr.md). |
| Does it evaluate code? | No `eval` or `new Function` in `@svgrid/grid`; it runs under a strict CSP. See [security](../help/security.md#csp-guidance). |
| Personal data, PHI | The library processes only what your app renders. See [GDPR](./gdpr.md) and [HIPAA](./hipaa.md). |

## Supply chain

| Question | Answer |
| --- | --- |
| Runtime dependencies | `@svgrid/grid`: one, `esm-env` (MIT, no dependencies of its own). `@svgrid/enterprise`: none required; `jszip` and `pdfmake` are optional peers loaded on first XLSX or PDF use. Enterprise also ships one vendored module, the Smart UI exporter (jQWidgets). |
| SBOM | CycloneDX 1.6, one per package, in [`sbom/`](https://github.com/sv-grid/sv-grid/tree/main/sbom). Regenerated with every release, and CI fails if one drifts from its manifest (`pnpm sbom:check`). Vendored code is listed as a component. |
| Are releases signed? | npm packages are published from GitHub Actions with `--provenance`, so npm shows the workflow and commit that built them. From the next release on, each SBOM also carries a Sigstore attestation: `gh attestation verify sbom/svgrid-grid.cdx.json --repo sv-grid/sv-grid`. |
| Can you build from source? | Yes. The npm packages are built from this public repository; there are no private patches. |
| Licenses of what you ship | MIT for the grid and its dependency; the vendored exporter is jQWidgets' own code under its license. The SBOM records each license. |

## Secure development

| Question | Answer |
| --- | --- |
| How is code tested before release? | Every push to `main` runs the Test workflow (`.github/workflows/test.yml`): type checks of every package, lint, the grid and Enterprise unit suites, browser specs in Chromium, bundle-size budgets and SBOM drift. The release workflow (`.github/workflows/publish-npm.yml`) runs when a push to `main` finishes its Test run green, and publishes that commit; there is no scheduled publish. A manual run is the maintainer's override. |
| Security-relevant tests | HTML sanitization of cell content (`sanitize-html.test.ts`); formula injection in CSV, TSV and chart CSV exports (`csv-injection.test.ts`); crafted .xlsx files that address cells far outside the sheet (`import-xlsx-limits.dom.test.ts`) or unzip to far more than they weigh (`xlsx-zip-bomb.dom.test.ts`); LIMIT and OFFSET rejected unless they are non-negative integers in the SvelteKit SQL data source (`sql-source.test.ts`); and the accessibility suites. |
| CSV / formula injection | File exports prefix text that a spreadsheet would run as a formula (`=`, `+`, `-`, `@`, tab, carriage return) with `'`, by default. See [export](../help/export.md). |
| Can a version change after release? | No. npm does not allow a published version to be overwritten. |

## Vulnerability management

| Question | Answer |
| --- | --- |
| How do we report a vulnerability? | Privately, through GitHub's vulnerability reporting or by email, as [SECURITY.md](https://github.com/sv-grid/sv-grid/blob/main/SECURITY.md) describes. |
| Response times | Acknowledgement within 3 working days and an assessment within 10 (SECURITY.md). Enterprise customers: acknowledgement within one business day, and a fix for High and Critical issues within five business days ([security](../help/security.md#vulnerability-handling)). |
| How are customers told? | A GitHub security advisory and the release notes. Enterprise customers hear before the advisory is public. |
| Known vulnerabilities | None published. Check the repository's advisories page for the current list. |
| EU Cyber Resilience Act | The pieces the CRA asks a manufacturer for are in place: a coordinated disclosure policy (SECURITY.md), a machine-readable SBOM per release, and a published support policy ([API stability](../help/api-stability.md#long-term-support)). |

## Accessibility

| Question | Answer |
| --- | --- |
| Do you publish an ACR / VPAT? | Yes: [VPAT 2.5Rev INT against WCAG 2.2 AA](./vpat.md), self-assessed, with every gap listed. |

## See also

- [Compliance overview](./index.md)
- [Security & supply chain](../help/security.md)
- [Audit log integration](./audit-log.md)
