# Security policy

## Reporting a vulnerability

**Do not open a public issue for a security vulnerability.**

Report it privately using
[GitHub's private vulnerability reporting](https://github.com/sv-grid/sv-grid/security/advisories/new),
or by email to **boikom@jqwidgets.com** with `SECURITY` in the subject line.

Please include:

- the affected package and version (`@svgrid/grid`, `@svgrid/enterprise`, ...)
- what an attacker can do, not just what looks wrong
- a minimal reproduction: a demo id, a code snippet, or a repo
- any suggested fix, if you have one

## What to expect

| | |
|---|---|
| Acknowledgement | within 3 working days |
| Initial assessment | within 10 working days |
| Fix or mitigation plan | communicated with the assessment |

We will keep you updated as the fix progresses and credit you in the release
notes and advisory unless you prefer otherwise. Please give us a chance to
release a fix before disclosing publicly.

## Supported versions

Security fixes land on the latest minor of the current major. Older majors are
not patched.

| Package | Supported |
|---|---|
| `@svgrid/grid` | latest 2.x |
| `@svgrid/enterprise` | latest 2.x |
| `@svgrid/mcp`, `@svgrid/studio` | latest release |

## Scope

SvGrid is a client-side library. It makes no outbound network calls of its own,
does not evaluate user input as code, and renders in a way that is compatible
with strict CSP and Trusted Types. See
[docs/compliance](https://svgrid.com/docs/help/security/) for the full posture.

In scope:

- XSS or HTML injection through cell values, headers, formatters, or renderers
- prototype pollution through column definitions, filter state, or imported data
- CSP or Trusted Types bypass in the render component
- parser vulnerabilities in CSV / TSV / Excel import
- license-check bypass in `@svgrid/enterprise` (report privately, please)

Out of scope:

- vulnerabilities in your own application code that merely uses the grid
- issues requiring the victim to paste attacker-controlled code into their app
- findings from automated scanners with no demonstrated exploit
- missing hardening headers on svgrid.com that have no user impact
