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
export const SVGRID_VERSION = '2.6.1'
