# SVGRID END USER LICENSE AGREEMENT

Version 1.1

This End User License Agreement ("EULA") governs your use of SvGrid. Please read
it carefully before downloading, installing, or using any portion of the
Software. By downloading, installing, or using the Software you agree to be bound
by the terms and conditions of this EULA. If you do not agree, you are not
permitted to use the Software or any portion of it.

SvGrid is distributed in two editions under two different sets of terms:

- The **Community Edition** (`@svgrid/grid`, `@svgrid/grid-wc`, `@svgrid/ui`,
  `@svgrid/mcp`, `@svgrid/migrate`, `@svgrid/create` and `@svgrid/create-studio`)
  is free and open source under the **MIT License**. Sections 2 and 3 apply to
  it.
- The **Commercial Packages** (`@svgrid/enterprise` and `@svgrid/studio`) are
  commercial software, licensed and not sold, under the terms in Sections 4
  through 12.

## 1. DEFINITIONS

- **"Software"** means SvGrid, including its modules, components, program files,
  source code, examples, media, and documentation, as well as any portion of
  them.
- **"Community Edition"** means the `@svgrid/grid`, `@svgrid/grid-wc`,
  `@svgrid/ui`, `@svgrid/mcp`, `@svgrid/migrate`, `@svgrid/create` and
  `@svgrid/create-studio` packages, and any other SvGrid package published
  under the MIT License.
- **"Enterprise Package"** means the `@svgrid/enterprise` package and any other
  SvGrid package published under this commercial license.
- **"Spreadsheet Module"** means the workbook, formula engine, and spreadsheet
  file-format features of the Enterprise Package, including `<SvSheet>`, the
  `<sv-sheet>` custom element, the formula evaluator, and the readers and
  writers for the `.xlsx`, `.xls`, `.ods` and `.csv` formats.
- **"Studio"** means the `@svgrid/studio` package together with the Studio
  designer, code generator, and SQL data sources shipped in the Enterprise
  Package.
- **"Grid Edition"** means an Enterprise license whose scope excludes the
  Spreadsheet Module and Studio.
- **"Suite Edition"** means an Enterprise license whose scope includes the
  Enterprise Package in full, the Spreadsheet Module, and Studio.
- **"Author"** means jQWidgets Ltd.
- **"Subscriber"** means the individual or organization that has obtained a valid
  Enterprise license.
- **"Developer"** means any individual who writes or modifies source code that
  imports the Enterprise Package. Read-only users and end users are not
  Developers.
- **"License Key"** means a key issued by the Author that activates the
  Enterprise Package for the edition and the number of Developer seats covered
  by the Subscriber's order.
- **"OEM License"** means a separately negotiated license, described in
  Section 4A, that permits redistribution beyond the grant in Section 4(c).

## 2. COMMUNITY EDITION - MIT LICENSE

The Community Edition is licensed under the MIT License. You may use, copy,
modify, merge, publish, distribute, sublicense, and sell copies of the Community
Edition, including in proprietary and commercial products, free of charge,
subject only to the conditions of the MIT License (preservation of the copyright
and permission notice). No License Key is required, there is no row-count cap,
and there is no usage reporting. The full text of the MIT License is included in
the repository at `packages/grid/LICENSE`.

## 3. COMMUNITY EDITION - NO WARRANTY

The Community Edition is provided "as is" under the MIT License, without warranty
of any kind. The warranty disclaimer and limitation of liability of the MIT
License apply to it.

## 4. ENTERPRISE LICENSE - GRANT

Subject to the Subscriber's compliance with this EULA and to continued payment of
the applicable license fee where an updates-and-support term is in effect, the
Author grants the Subscriber a non-exclusive, non-transferable,
non-sublicensable license to:

  (a) install and use the Enterprise Package on developer workstations and in
      the Subscriber's development, staging, and production deployments;
  (b) modify the Enterprise Package for the Subscriber's internal use, provided
      that all copyright notices and license terms are preserved;
  (c) distribute the Enterprise Package bundled inside the Subscriber's own
      application, provided that the Enterprise Package is not the primary product
      distributed, that it remains under this EULA, and that the distribution is
      not one of the cases listed in Section 4A, which require an OEM License.

The scope of the license is determined by the Subscriber's order:

- A **Grid Developer License** covers the Enterprise Package excluding the
  Spreadsheet Module and Studio, on an unlimited number of deployed production
  applications within the Subscriber's organization, including subsidiaries and
  sister products, plus any number of internal development and staging
  environments.
- A **Suite Developer License** covers the Enterprise Package in full, including
  the Spreadsheet Module and Studio, on the same unlimited application scope.
- An **Enterprise / Custom (Site or Organization-wide) License** covers the scope
  defined in the separately negotiated order or master agreement.
- An **OEM License** covers the redistribution cases in Section 4A.

Use of the Spreadsheet Module or Studio under a Grid Developer License is outside
the licensed scope. Consistent with Section 7, the Software does not block such
use: it stays soft-gated and shows the unlicensed watermark and notice. Bringing
that use into scope requires a Suite Developer License.

## 4A. OEM AND REDISTRIBUTION LICENSE

Section 4(c) covers the ordinary case, in which the Subscriber ships its own
application and the Enterprise Package is one component inside it. An **OEM
License**, negotiated separately with the Author, is required where any of the
following applies:

  (a) the Subscriber distributes the Enterprise Package, or any part of it, to
      third parties as a component, library, SDK, template, or building block
      that those third parties use to build their own applications;
  (b) the Subscriber's product is a platform, application builder, low-code or
      no-code tool, or development environment in which the Subscriber's own
      customers author applications, reports, or workbooks that render through
      the Enterprise Package;
  (c) the Subscriber sublicenses, resells, or white-labels the Enterprise
      Package under another name;
  (d) the Subscriber deploys the Enterprise Package in a multi-tenant hosted
      product in which the Spreadsheet Module or Studio is a material part of
      what the Subscriber's customers are paying for.

An OEM License is priced separately from Developer seats, is granted for a
defined term and a defined product, and may carry a redistribution volume or
royalty basis recorded in the order. Developer seats under Sections 4 and 5 do
not convey the rights in this Section, however many seats are purchased.

For the avoidance of doubt, ordinary business software that is sold to customers
is covered by Section 4(c) and does not require an OEM License. A SaaS
application whose users view, edit, and export their own data in a grid or a
workbook is the Subscriber's own application, not redistribution. The test in
this Section is whether third parties receive the Enterprise Package as
something they build with, not whether the Subscriber charges for its product.

Requests: sales@jqwidgets.com.

## 5. ENTERPRISE LICENSE - SEATS

The Enterprise Package is licensed per Developer. The number of Developer seats
and the edition, Grid or Suite, are determined by the Subscriber's order. All
seats on one order share one edition. Production seats and end users are
unlimited and are not counted. One License Key activates every grid instance in
scope; there is no per-page or per-component accounting. A seat is tied to a role,
not to a named individual: if a Developer leaves and is replaced, the seat
transfers to the replacement at no additional cost. License Keys must not be
shared outside the Developer seats covered by the Subscriber's order.

## 6. ENTERPRISE LICENSE - PERPETUAL LICENSE AND UPDATES/SUPPORT TERM

The Enterprise license is **perpetual**: the Subscriber owns the right to use the
versions of the Enterprise Package released during a paid term forever. Each
order includes a one (1) year term of software updates and support, which
**renews automatically each year** at the then-current rate until cancelled. The
Subscriber may **cancel at any time**. On cancellation or lapse of the
updates-and-support term:

  (a) every version of the Enterprise Package released during a paid term keeps
      working and keeps validating against the Subscriber's License Key;
  (b) the Subscriber stops receiving new releases and support issued after the
      paid term ends.

The Author will not disable working features of a paying or previously paying
Subscriber.

## 7. ENTERPRISE LICENSE - EVALUATION AND SOFT-GATE

The Enterprise Package is soft-gated. All Enterprise features, including the
Spreadsheet Module and Studio, are fully functional without a License Key for the
purpose of evaluation. While unlicensed, the grid and the spreadsheet display a
small "Unlicensed @svgrid/enterprise" watermark and emit a one-time console
notice. There is no time limit and no disabled functionality during evaluation.
Setting a valid License Key that covers the feature in use removes the watermark
and the notice.

The same applies to a feature outside a Subscriber's edition. A Grid Developer
License that reaches the Spreadsheet Module or Studio is treated as unlicensed
for that feature: the feature runs, and the watermark and notice stay until the
license is upgraded. The Author does not disable a feature that is already
running in a Subscriber's application.
On request, the Author issues a time-limited evaluation key that removes the
watermark during evaluation. Any sentinel or development key published by the
Author for local development and testing must not be used in production.

## 8. ENTERPRISE LICENSE - OPEN SOURCE PROJECTS

The Author issues a free Enterprise License Key for projects that are open source
under an OSI-approved license, hosted in a public repository, and are not a paid
product. Such keys are issued at the Suite Edition, provide the full Enterprise
feature set with no watermark, and are renewable annually for as long as the
project remains open source. Requests
are made to the Author with the repository URL.

## 9. ENTERPRISE LICENSE - LICENSE KEY AND VALIDATION

License Key validation is performed entirely client-side. No network call is made
to validate a License Key, and no telemetry is sent. Air-gapped deployments are
supported.

The check is deliberately not a cryptographic one. The Software classifies the
key string: whether it carries the Author's prefix, which edition it names,
whether it appears on the Author's revoked list, whether it is a development or
evaluation sentinel, and any expiry date the key encodes. It does nothing more.
A key can be read out of a deployed bundle by anyone with developer tools, and an
unlicensed or out-of-edition build still runs. This is stated plainly because the
license is a legal agreement and not a technical lock, and the Author would
rather describe the mechanism accurately than imply protection that is not there.
Keys are revocable: a key the Author revokes stops being accepted in later
releases.

Each License Key embeds a stable identifier used only to cross-reference the
Subscriber's order during support. The Subscriber must not remove, obscure, or
disable the License Key check, the watermark, or the console notice.

## 10. ENTERPRISE LICENSE - RESTRICTIONS

The Subscriber may NOT:

  (a) redistribute the Enterprise Package as a standalone package, library, or
      component;
  (b) sublicense, rent, lease, or sell the Enterprise Package to third parties;
  (c) remove, obscure, or disable the License Key check or any copyright or
      proprietary notices;
  (d) use the Enterprise Package to develop a data-grid, table, or spreadsheet
      component product that competes with the Software for distribution to
      third parties;
  (e) share License Keys outside of the Developer seats covered by the
      Subscriber's order;
  (f) ship to production a use of the Spreadsheet Module or Studio that the
      Subscriber's edition does not cover, or a redistribution described in
      Section 4A without an OEM License.

## 11. INTELLECTUAL PROPERTY

All intellectual property rights in the Enterprise Package, including patents,
trademarks, copyrights, and trade secret rights, are and remain the property of
the Author. The Enterprise Package is licensed, not sold. Purchasing a license,
including a license that provides access to source code, does not transfer any
intellectual property rights or ownership in the Software. "SvGrid", "jQWidgets",
and "HTMLElements" are trademarks of the Author. All rights not expressly granted
by this EULA are reserved. This Section does not restrict any right granted to you
for the Community Edition under the MIT License.

## 12. THIRD-PARTY COMPONENTS

The Enterprise Package includes a vendored copy of the data-export utility from
Smart UI / jQWidgets, redistributed under the same ownership (Copyright (c)
2011-2026 jQWidgets). Optional peer dependencies, including `jszip` and `pdfmake`,
are licensed by their respective authors under their own terms (MIT) and are not
bundled into the package; you install them separately.

## 13. DISCLAIMER OF WARRANTY

THE SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING WITHOUT LIMITATION THE IMPLIED WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. THE AUTHOR DOES NOT
WARRANT THAT THE SOFTWARE WILL MEET YOUR REQUIREMENTS OR THAT ITS OPERATION WILL
BE UNINTERRUPTED OR ERROR FREE. YOU ASSUME RESPONSIBILITY FOR SELECTING THE
SOFTWARE TO ACHIEVE YOUR INTENDED RESULTS AND FOR THE RESULTS OBTAINED FROM IT.

## 14. LIMITATION OF LIABILITY

IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR
CONSEQUENTIAL DAMAGES, OR FOR ANY DAMAGES WHATSOEVER INCLUDING BUT NOT LIMITED TO
LOSS OF BUSINESS PROFITS, BUSINESS INTERRUPTION, OR LOSS OF BUSINESS INFORMATION,
ARISING OUT OF THE USE OF OR INABILITY TO USE THE SOFTWARE, EVEN IF ADVISED OF
THE POSSIBILITY OF SUCH DAMAGES. REGARDLESS OF THE FORM OF ACTION, THE AUTHOR'S
AGGREGATE LIABILITY ARISING OUT OF OR RELATED TO THIS EULA SHALL NOT EXCEED THE
LICENSE FEES PAID BY THE SUBSCRIBER IN THE TWELVE (12) MONTHS PRECEDING THE EVENT
GIVING RISE TO THE CLAIM. THE FOREGOING LIMITATIONS SHALL APPLY TO THE MAXIMUM
EXTENT ALLOWED BY APPLICABLE LAW.

## 15. TERMINATION

This EULA, with respect to the Enterprise Package, terminates automatically upon
the Subscriber's material breach of Sections 4, 4A, 5, 10, or 11. On termination for
breach, the Subscriber must cease all use of the Enterprise Package, remove it
from development environments, and stop deploying new versions of any application
that depends on it. Existing copies already deployed to production may continue to
operate, but no new deployments are permitted. License fees for licenses
cancelled due to violation of this EULA are non-refundable. Any provision
intended to survive termination will survive. Termination of the Enterprise
license does not affect rights granted for the Community Edition under the MIT
License.

## 16. SEVERABILITY

If any provision of this EULA is held invalid or unenforceable, that provision
will be enforced to the maximum extent permissible and the remaining provisions
will remain in full force and effect.

## 17. EXPORT REGULATIONS

The Software may be subject to export or import regulations, and you agree to
comply strictly with all such laws and regulations.

## 18. GOVERNING LAW

This EULA is governed by the laws of the jurisdiction in which the Author is
registered, and any dispute arising out of or related to it will be handled
there.

## 19. CONTACT

- Sales and licensing: sales@jqwidgets.com
- Support: support@jqwidgets.com
- General: info@jqwidgets.com
- Pricing: https://svgrid.com/pricing/

END OF AGREEMENT
