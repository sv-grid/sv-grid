/**
 * The version of this package, as a value the pure (browser-safe) generator can
 * read - it cannot open `package.json` at runtime.
 *
 * Generated apps depend on `^SVGRID_VERSION` rather than `latest`, so an app
 * always installs a runtime at least as new as the generator that wrote it.
 * `latest` made that a coin toss: an app scaffolded today and the same app
 * scaffolded tomorrow could resolve different runtimes, and an unrelated publish
 * could break an app nobody had touched.
 *
 * `version.test.ts` asserts this matches `package.json`, so the two cannot drift.
 */
export const SVGRID_VERSION = '3.1.6'

/**
 * The version of `@svgrid/grid`, which releases on its own line: enterprise is
 * on 3.1.x while the grid is on 3.0.x.
 *
 * A scaffolded app depends on BOTH packages, and pinning the grid to this
 * package's version asked npm for `@svgrid/grid@^3.1.1`, which has never been
 * published. Every `svgrid-studio init` therefore produced an app whose very
 * next step, `npm install`, failed with ERESOLVE. Found 2026-10-05 by
 * scaffolding one and running the install.
 *
 * `version.test.ts` asserts this matches packages/grid/package.json.
 */
export const GRID_VERSION = '3.0.10'
