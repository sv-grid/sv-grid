// SHA-256 of the one @svgrid/enterprise license key, lower-cased and trimmed
// (see license-core.ts). The key itself is never in this repository; this hash
// is what the package compares a key against. Its own module so tests can swap
// in the hash of a test key without knowing the real one, and so
// tools/issue-license.mjs can check the master key it issues against it.
export const LICENSE_KEY_SHA256 = 'dabe98638cdc5760637bb2a741e65680a6ff0fb590d8b1018c9597650486cb10'
