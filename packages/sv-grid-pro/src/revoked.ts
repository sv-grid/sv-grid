// Revoked license keys. A key in this set throws on use even if it has the
// valid SVPRO- prefix. Use this to invalidate keys that have been leaked,
// shared outside their seat count, or issued for trials that have expired.
//
// =============================================================================
// MAINTAINER NOTE - DO NOT COMMIT REAL REVOKED KEYS TO THIS FILE
// =============================================================================
//
// The public repo ships this file with an empty Set. The real revoked list
// is maintained privately by the maintainer. Pick one of two override
// patterns:
//
//   A) skip-worktree (recommended for a single maintainer's clone)
//
//      One-time setup on the maintainer's machine:
//
//        git update-index --skip-worktree \
//          packages/sv-grid-pro/src/revoked.ts
//
//      Then edit this file with real keys; git will not track the changes
//      and they will never be pushed. To re-track later:
//
//        git update-index --no-skip-worktree \
//          packages/sv-grid-pro/src/revoked.ts
//
//   B) gitignored sibling file (revoked.local.ts)
//
//      Create packages/sv-grid-pro/src/revoked.local.ts (covered by the
//      package's .gitignore). Export a `REVOKED_LOCAL` Set from it. To
//      have it merged in, replace the export below with:
//
//        // @ts-ignore -- optional, gitignored file
//        import { REVOKED_LOCAL } from './revoked.local'
//        export const REVOKED_KEYS: ReadonlySet<string> = new Set<string>([
//          ...REVOKED_LOCAL,
//        ])
//
//      Note: this only works if the file actually exists at type-check
//      time. For a fresh public clone with no revoked.local.ts, fall back
//      to the empty default.
//
// For npm publication the right long-term answer is a build step that
// inlines the list from an env var or private file. Not wired up yet.
// =============================================================================

export const REVOKED_KEYS: ReadonlySet<string> = new Set<string>([
  // 'SVPRO-EVAL-acme-202506-3F7K9P',  // example - expired ACME trial
  // 'SVPRO-LEAKED-globex-202612-X8N4P', // example - key leaked on GitHub
])
