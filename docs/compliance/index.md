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
- [Audit log integration](./audit-log.md) - turn the grid's callbacks
  into an immutable audit trail with one adapter

## Vendor-questionnaire shortlist

| Question                                          | Answer                                                          |
| ------------------------------------------------- | --------------------------------------------------------------- |
| Does the library transmit any data?               | **No.** Zero outbound network calls. Inspect with DevTools.     |
| Does the library write to localStorage?           | **Only when you opt in.** [Saved views](../help/saved-views.md) writes when you tell it to. |
| Does the library evaluate user input as code?     | **No.** CSP-compliant; no `eval` / `new Function`.              |
| Does the library include third-party trackers?    | **No.** Verify the bundle - ~78 kB gzip, no analytics SDK.     |
| Is the library SOC 2 / ISO 27001 certified?       | The LIBRARY can't be certified - it's not a service. Your hosted app gets certified; the library is in-scope as a dependency. See [SOC 2 posture](./soc2.md). |
| Is the library GDPR-compliant?                    | The library is GDPR-neutral: it never processes data the user didn't already see. See [GDPR + data residency](./gdpr.md). |
| Is the library HIPAA-compliant?                   | Same: HIPAA-neutral. PHI handling is a property of your app, not the grid. See [HIPAA posture](./hipaa.md). |
| Is the source code auditable?                     | **Yes.** MIT-licensed; published as readable source (no minified obfuscation).                   |
| Where is data stored?                             | **In your app's memory.** Never on a sv-grid server. There is no sv-grid server. |
| Is there a security disclosure policy?            | Yes - email `support@jqwidgets.com`. Patches typically ship within 7 days for high-severity issues. |
| Is the library tested for accessibility?          | The WAI-ARIA 1.2 grid pattern is implemented and covered by unit tests over the ARIA prop builders. Rendered-DOM axe testing is a recipe we publish for your suite, not a check we run in ours. See [accessibility](../help/accessibility.md). |
| Are dependencies vetted?                          | Yes - 0 runtime dependencies in `@svgrid/grid`. `@svgrid/enterprise` lazy-loads `jszip` + `pdfmake` as peers. See [security](../help/security.md) for the dep table. |
| Is there an SBOM?                                 | Generate one for any installed version with `npx @cyclonedx/cdxgen -o sbom.json`. With 0 runtime dependencies the tree is shallow by construction. See [security](../help/security.md#sbom). |

## See also

- [Security & supply chain](../help/security.md) - the parent posture
- [Observability](../help/observability.md) - the audit log seam
- [API stability](../help/api-stability.md) - the deprecation promise
