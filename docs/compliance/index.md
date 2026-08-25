# Compliance

sv-grid is a client-side UI library - **all data stays in the
browser**, the library never makes a network call of its own, no
telemetry phones home. The compliance story is therefore short, but
because enterprise procurement asks the same questions every time,
this section answers each one directly.

> If your reviewer wants a one-pager: jump to the
> [vendor-questionnaire shortlist](#vendor-questionnaire-shortlist)
> at the bottom.

## Pages

- [SOC 2 posture](./soc2.md) - what the library covers, what your
  hosting / build pipeline must cover
- [GDPR + data residency](./gdpr.md) - personal-data handling, where
  data physically sits, the user-rights surface
- [HIPAA posture](./hipaa.md) - PHI handling in the browser, what
  "no PHI on disk" requires you to wire
- [Accessibility Conformance Report (VPAT 2.5Rev)](./vpat.md) - the
  per-criterion WCAG 2.1 / Section 508 / EN 301 549 claim, with the
  evidence behind each one and the gaps stated rather than omitted.
- [Audit log integration](./audit-log.md) - turn the grid's callbacks
  into an immutable audit trail with one adapter

## Vendor-questionnaire shortlist

| Question                                          | Answer                                                          |
| ------------------------------------------------- | --------------------------------------------------------------- |
| Does the library transmit any data?               | **No.** Zero outbound network calls. Inspect with DevTools.     |
| Does the library write to localStorage?           | **Only when you opt in.** [Saved views](../help/saved-views.md) writes when you tell it to. |
| Does the library evaluate user input as code?     | **No.** CSP-compliant; no `eval` / `new Function`.              |
| Does the library include third-party trackers?    | **No.** Verify the bundle - ~77 kB gzip, no analytics SDK.     |
| Is the library SOC 2 / ISO 27001 certified?       | The LIBRARY can't be certified - it's not a service. Your hosted app gets certified; the library is in-scope as a dependency. See [SOC 2 posture](./soc2.md). |
| Is the library GDPR-compliant?                    | The library is GDPR-neutral: it never processes data the user didn't already see. See [GDPR + data residency](./gdpr.md). |
| Is the library HIPAA-compliant?                   | Same: HIPAA-neutral. PHI handling is a property of your app, not the grid. See [HIPAA posture](./hipaa.md). |
| Is the source code auditable?                     | **Yes.** MIT-licensed; published as readable source (no minified obfuscation).                   |
| Where is data stored?                             | **In your app's memory.** Never on a sv-grid server. There is no sv-grid server. |
| Is there a security disclosure policy?            | Yes - email `support@jqwidgets.com`. Patches typically ship within 7 days for high-severity issues. |
| Is the library tested for accessibility?          | **Yes.** `axe-core` runs against a rendered `<SvGrid>` in CI on every commit, across the plain grid, the filter row, row selection and pagination. Layout-dependent rules (notably colour contrast) are disabled because the suite runs in jsdom, which performs no layout; contrast is covered instead by a computed check over all 20 built-in themes in light and dark. See [accessibility](../help/accessibility.md). |
| Do you publish a VPAT / ACR?                      | **Yes.** [VPAT 2.5Rev INT](./vpat.md), covering WCAG 2.1 AA, Revised Section 508 and EN 301 549 in one document. It is a self-assessment, and says so: every "Supports" names the test behind it, and the two known gaps (no `aria-invalid` on cell editors, no recorded screen-reader test pass) are stated in the report rather than left out. |
| Are dependencies vetted?                          | Yes - 0 runtime dependencies in `@svgrid/grid`. `@svgrid/enterprise` lazy-loads `jszip` + `pdfmake` as peers. See [security](../help/security.md) for the dep table. |
| Is there an SBOM?                                 | **Yes.** A CycloneDX 1.6 document per published package lives in [`sbom/`](https://github.com/sv-grid/sv-grid/tree/main/sbom), regenerated with `pnpm sbom`. With 0 runtime dependencies in the grid the graph is shallow by construction. See [security](../help/security.md#sbom). |

## See also

- [Security & supply chain](../help/security.md) - the parent posture
- [Observability](../help/observability.md) - the audit log seam
- [API stability](../help/api-stability.md) - the deprecation promise
