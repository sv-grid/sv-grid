# Enterprise support

What you get on each tier, what response time to expect, how to
escalate.

## SLAs

| Tier                  | Channel                  | First response | Resolution target | Hours of cover   |
| --------------------- | ------------------------ | -------------- | ----------------- | ---------------- |
| Community (free)      | GitHub issues            | best-effort    | best-effort       | community-driven |
| Single Application    | Email + private Slack    | next business day | 5 business days | 9-5 ET, M-F      |
| Multiple Application  | Email + private Slack    | next business day | 5 business days | 9-5 ET, M-F      |
| Enterprise            | Named contact + Slack    | 4h business hours, **1h for sev-1** | per contract | 9-7 ET, M-F (+ on-call sev-1) |

"Sev-1" = production outage caused by sv-grid; "sev-2" = major
feature broken; "sev-3" = bug; "sev-4" = question.

## What's in scope

| In scope                                  | Out of scope                                           |
| ----------------------------------------- | ------------------------------------------------------ |
| sv-grid bugs                              | Bugs in your application code                          |
| Type-error questions in sv-grid surface   | Generic TypeScript / Svelte questions                  |
| Migration help (from another grid)        | Full app port (we can recommend partners)              |
| Performance triage on supported browsers  | Performance on EOL browsers                            |
| Feature-request triage                    | We promise to evaluate; we don't promise to build      |
| Production-down incident triage           | Re-architecture of your data layer                     |

## How to open a ticket

1. **Reproduce in a minimal repo** - StackBlitz / CodeSandbox / `pnpm
   create svelte` + the smallest grid that shows the issue. We
   support the official `@svgrid/grid` and `@svgrid/enterprise`
   packages.
2. **Include**:
   - sv-grid version (`pnpm ls @svgrid/grid @svgrid/enterprise`)
   - Svelte version, Vite version, OS
   - Browser + version (we test on the latest 2 majors of Chrome, Firefox, Safari, Edge - see [browser support](../help/browser-support.md))
   - The exact error message + stack trace
   - A 30-second screen recording for visual issues
3. **Send to** `support@jqwidgets.com` with subject `[sev-N] <one-line summary>`.

## Escalation

For Team and above, replying to the ticket with `[escalate]` in the
subject moves it to the on-call engineer regardless of business hours.
Use for production outages only.

Enterprise customers get a Slack Connect channel; ping `@oncall` for
sev-1.

## Security disclosures

For security issues, **do not file a public issue**. Email
`support@jqwidgets.com` (PGP fingerprint at
[svgrid.com/.well-known/security.txt](https://svgrid.com/.well-known/security.txt)).
Response within 24h; patch within 7 days for high-severity.

See [security & supply chain](../help/security.md) for the full
disclosure policy.

## Roadmap visibility

- Community: public roadmap at [svgrid.com/roadmap](https://svgrid.com/roadmap/)
- Single / Multiple Application: quarterly roadmap email + invite to monthly office hours
- Enterprise: named PM, monthly roadmap call, ability to sponsor features

## Documentation feedback

Found a doc bug, unclear page, or missing topic? Open an issue at
[github.com/sv-grid/sv-grid/issues](https://github.com/sv-grid/sv-grid/issues)
with the `docs` label, or hit the "Edit on GitHub" link on any page.

## See also

- [Enterprise licensing](./licensing.md)
- [Enterprise evaluation](./evaluation.md)
- [Security & supply chain](../help/security.md)
- [API stability](../help/api-stability.md) - the deprecation policy that drives support windows
