---
"@svgrid/enterprise": minor
"@svgrid/studio": minor
---

Split the Enterprise license into Grid and Suite editions, and add an OEM tier.

A license key can now name an edition. `SVENTERPRISE-GRID-...` covers the
enterprise grid on its own; `SVENTERPRISE-SUITE-...` adds the spreadsheet and
the Studio. A key issued before editions existed carries no edition segment and
reads as Suite, so nothing an existing customer already ships changes.

`checkLicenseKey` gained an `edition` field, and `editionCovers(edition,
product)` answers whether a key reaches a product. Three new exports sit on top
of it: `licenseCovers(product)` for hiding a Suite-only entry point in your own
UI, `getLicenseEdition()`, and `nudgeEnterpriseFor(product, feature)`, which is
the gate `enableSheet()` and the Studio data sources now use.

The gate stays soft. A Grid key that opens the spreadsheet gets the watermark
and a one-time console notice naming the edition that covers it, and the
feature runs. Nothing is disabled, nothing is hidden, and no network call is
made, which is the same contract the package already had for an unlicensed
build.

Both editions cover unlimited production apps. The old single-app and
multi-app scopes are gone: the line between the two prices is the feature set
now, not the app count.

The EULA and the LICENSE files gained Section 4A (1A in the LICENSE files),
which carves redistribution out of the ordinary grant. Shipping the package to
third parties as a component, an SDK, or an app builder they build with needs
an OEM License. A SaaS product whose own users edit their own data in a grid or
a workbook is unaffected and stays inside the developer-seat grant.

Two statements in the EULA that did not match the code are also fixed. Section
9 claimed keys were "signed against the Author's public key"; they are
classified as strings, with no cryptography, which is what the runtime has
always done and what `docs/enterprise/licensing.md` already said. The Community
Edition list named two packages and now names all seven.
