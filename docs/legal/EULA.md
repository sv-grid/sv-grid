# SVGRID END USER LICENSE AGREEMENT

Version 1.0

This End User License Agreement ("EULA") governs your use of SvGrid. Please read
it carefully before downloading, installing, or using any portion of the
Software. By downloading, installing, or using the Software you agree to be bound
by the terms and conditions of this EULA. If you do not agree, you are not
permitted to use the Software or any portion of it.

SvGrid is distributed in two editions under two different sets of terms:

- The **Community Edition** (`@svgrid/grid` and `@svgrid/mcp`) is free and open
  source under the **MIT License**. Sections 2 and 3 apply to it.
- The **Enterprise Package** (`@svgrid/enterprise`) is commercial software
  licensed, not sold, under the terms in Sections 4 through 12.

## 1. DEFINITIONS

- **"Software"** means SvGrid, including its modules, components, program files,
  source code, examples, media, and documentation, as well as any portion of
  them.
- **"Community Edition"** means the `@svgrid/grid` and `@svgrid/mcp` packages and
  any other SvGrid package published under the MIT License.
- **"Enterprise Package"** means the `@svgrid/enterprise` package and any other
  SvGrid package published under this commercial license.
- **"Author"** means jQWidgets Ltd.
- **"Subscriber"** means the individual or organization that has obtained a valid
  Enterprise license.
- **"Developer"** means any individual who writes or modifies source code that
  imports the Enterprise Package. Read-only users and end users are not
  Developers.
- **"License Key"** means a key issued by the Author that activates the
  Enterprise Package for the number of Developer seats covered by the
  Subscriber's order.

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
      distributed and remains under this EULA.

The scope of deployment is determined by the Subscriber's order:

- A **Single Application Developer License** covers one (1) deployed production
  application, plus any number of internal development and staging environments.
- A **Multiple Application Developer License** covers an unlimited number of
  deployed production applications within the Subscriber's organization,
  including subsidiaries and sister products.
- An **Enterprise / Custom (Site or Organization-wide) License** covers the scope
  defined in the separately negotiated order or master agreement.

## 5. ENTERPRISE LICENSE - SEATS

The Enterprise Package is licensed per Developer. The number of Developer seats
is determined by the Subscriber's order. Production seats and end users are
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

The Enterprise Package is soft-gated. All Enterprise features are fully functional
without a License Key for the purpose of evaluation. While unlicensed, the grid
displays a small "Unlicensed @svgrid/enterprise" watermark and emits a one-time
console notice. There is no time limit and no disabled functionality during
evaluation. Setting a valid License Key removes the watermark and the notice.
On request, the Author issues a time-limited evaluation key that removes the
watermark during evaluation. Any sentinel or development key published by the
Author for local development and testing must not be used in production.

## 8. ENTERPRISE LICENSE - OPEN SOURCE PROJECTS

The Author issues a free Enterprise License Key for projects that are open source
under an OSI-approved license, hosted in a public repository, and are not a paid
product. Such keys provide the full Enterprise feature set with no watermark and
are renewable annually for as long as the project remains open source. Requests
are made to the Author with the repository URL.

## 9. ENTERPRISE LICENSE - LICENSE KEY AND VALIDATION

License Key validation is performed entirely client-side, signed against the
Author's public key. No network call is made to validate a License Key, and no
telemetry is sent. Air-gapped deployments are supported. Each License Key embeds
a stable identifier used only to cross-reference the Subscriber's order during
support. The Subscriber must not remove, obscure, or disable the License Key
check.

## 10. ENTERPRISE LICENSE - RESTRICTIONS

The Subscriber may NOT:

  (a) redistribute the Enterprise Package as a standalone package, library, or
      component;
  (b) sublicense, rent, lease, or sell the Enterprise Package to third parties;
  (c) remove, obscure, or disable the License Key check or any copyright or
      proprietary notices;
  (d) use the Enterprise Package to develop a data-grid or table component
      product that competes with the Software for distribution to third parties;
  (e) share License Keys outside of the Developer seats covered by the
      Subscriber's order.

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
the Subscriber's material breach of Sections 4, 5, 10, or 11. On termination for
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
- Pricing: https://svgrid.com/pricing

END OF AGREEMENT
