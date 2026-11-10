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

Enterprise customers get an acknowledgement within one business day, and an
advisory and patch within five business days for High and Critical issues.

We will keep you updated as the fix progresses and credit you in the release
notes and advisory unless you prefer otherwise. Please give us a chance to
release a fix before disclosing publicly.

## Supported versions

Security fixes land on the latest minor of the current major. Older majors are
not patched.

| Package | Supported |
|---|---|
| `@svgrid/grid` | latest 3.x |
| `@svgrid/enterprise` | latest 3.x |
| `@svgrid/mcp`, `@svgrid/studio` | latest release |

## Scope

`@svgrid/grid` is a client-side library. It makes no outbound network calls of
its own, does not evaluate user input as code, and renders in a way that is
compatible with strict CSP and Trusted Types.

### Trusted Types

The grid and SvGrid Base, with a field of every type, render under
`require-trusted-types-for 'script'`. HTML they draw (a rich text cell, its
editor, Markdown) goes through the sanitizer and then one policy, `svgrid`, made
the first time it is needed and only where the browser has `trustedTypes`.
Svelte makes one more, `svelte-trusted-html`, for its templates. A CSP that
lists its policies needs both:

```
require-trusted-types-for 'script'; trusted-types svgrid svelte-trusted-html
```

A page that loads SvGrid twice (the `<sv-grid>` bundle beside the npm package,
or a dev server reloading the module) makes `svgrid` twice: add
`'allow-duplicates'`. Chart Print draws the chart as a `data:` image, so
`img-src` needs `data:`.

These paths write an HTML or XML string and do not run under enforced Trusted
Types:

- `printGrid` from `@svgrid/enterprise` when it opens its window. With
  `{ open: false }` it returns the document and writes nothing.
- the spreadsheet (`<SvSheet>`): Print, opening an .xlsx or .ods file, and
  pasting HTML.
- `SvTour` with a step `image` given as markup instead of a URL.

`@svgrid/enterprise` adds code that runs on your server and code that reaches your
own systems: `createKitHandlers`, `createSqlDataSource`, `createBaseEndpoint` and
`createAutomationServer` run in your server and talk to your database, and a server
automation calls the webhook URLs its author wrote. In the page, SvGrid Base reads
an attachment's URL for a PDF preview. None of it calls us. See
[docs/compliance](https://svgrid.com/docs/help/security/) for the full posture.

In scope:

- XSS or HTML injection through cell values, headers, formatters, or renderers
- prototype pollution through column definitions, filter state, or imported data
- CSP or Trusted Types bypass in the render component
- parser vulnerabilities in CSV / TSV / Excel import
- license-check bypass in `@svgrid/enterprise` (report privately, please)
- reading or writing past `authorize`, `scope` or the schema through
  `createKitHandlers`, `createSqlDataSource` or `createBaseEndpoint`
- reaching an internal address past the webhook guard of `createAutomationServer`,
  or reading a secret through a record
- script running from an attachment, a rich text field or an alert rule

Out of scope:

- vulnerabilities in your own application code that merely uses the grid
- issues requiring the victim to paste attacker-controlled code into their app
- findings from automated scanners with no demonstrated exploit
- missing hardening headers on svgrid.com that have no user impact
