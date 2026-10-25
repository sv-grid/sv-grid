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
  per-criterion WCAG 2.2 / Section 508 / EN 301 549 claim, with the
  evidence behind each one and the gaps stated rather than omitted.
- [Security questionnaire answers](./security-questionnaire.md) - data
  handling, supply chain, secure development and vulnerability handling,
  in the order a vendor review asks them
- [Audit log integration](./audit-log.md) - turn the grid's callbacks
  into an immutable audit trail with one adapter

## Vendor-questionnaire shortlist

| Question                                          | Answer                                                          |
| ------------------------------------------------- | --------------------------------------------------------------- |
| Does the library transmit any data?               | **No.** Zero outbound network calls. Inspect with DevTools.     |
| Does the library write to localStorage?           | **Only when you opt in.** [Saved views](../help/saved-views.md) writes when you tell it to. |
| Does the library evaluate user input as code?     | **No.** CSP-compliant; no `eval` / `new Function`.              |
| Does the library include third-party trackers?    | **No.** No analytics SDK in the bundle; see [bundle size](../help/bundle-size.md) for what is in it. |
| Is the library SOC 2 / ISO 27001 certified?       | The LIBRARY can't be certified - it's not a service. Your hosted app gets certified; the library is in-scope as a dependency. See [SOC 2 posture](./soc2.md). |
| Is the library GDPR-compliant?                    | The library is GDPR-neutral: it never processes data the user didn't already see. See [GDPR + data residency](./gdpr.md). |
| Is the library HIPAA-compliant?                   | Same: HIPAA-neutral. PHI handling is a property of your app, not the grid. See [HIPAA posture](./hipaa.md). |
| Is the source code auditable?                     | **Yes.** MIT-licensed; published as readable source (no minified obfuscation).                   |
| Where is data stored?                             | **In your app's memory.** Never on a sv-grid server. There is no sv-grid server. |
| Is there a security disclosure policy?            | Yes - [SECURITY.md](https://github.com/sv-grid/sv-grid/blob/main/SECURITY.md): private reporting, acknowledgement within 3 working days, assessment within 10. Enterprise customers get faster response; see [vulnerability handling](../help/security.md#vulnerability-handling). |
| Is the library tested for accessibility?          | **Yes.** `axe-core` runs on every commit twice: in jsdom across several grid configurations, and in Chromium, where the layout rules (contrast, target size) can run. Contrast is also computed for all 20 built-in themes in light and dark. See [accessibility](../help/accessibility.md). |
| Do you publish a VPAT / ACR?                      | **Yes.** [VPAT 2.5Rev INT](./vpat.md), report 2.0, covering WCAG 2.2 AA, Revised Section 508 and EN 301 549. It is a self-assessment and says so: every "Supports" names the test behind it, and the gaps (drag-only actions, menu focus return, no recorded screen-reader pass) are listed rather than left out. |
| Are dependencies vetted?                          | Yes - one runtime dependency in `@svgrid/grid` (`esm-env`, MIT, itself dependency-free). `@svgrid/enterprise` lazy-loads `jszip` + `pdfmake` as optional peers and ships one vendored module (the Smart UI exporter). See [security](../help/security.md) for the table. |
| Is there an SBOM?                                 | **Yes.** A CycloneDX 1.6 document per published package in [`sbom/`](https://github.com/sv-grid/sv-grid/tree/main/sbom), vendored code included. Each release regenerates and signs them (Sigstore attestation, verify with `gh attestation verify`), and CI fails if one drifts from its manifest. See [security](../help/security.md#sbom). |
| Will you fill in our security questionnaire?      | Yes. Most answers are already written up in [security questionnaire answers](./security-questionnaire.md); send the rest to `support@jqwidgets.com`. |

## See also

- [Security & supply chain](../help/security.md) - the parent posture
- [Observability](../help/observability.md) - the audit log seam
- [API stability](../help/api-stability.md) - the deprecation promise
