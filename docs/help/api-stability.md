# API stability & semver policy

The promise SvGrid makes to you about which exports you can lean on,
how breaking changes are communicated, and how long deprecated APIs
stick around.

## Semver, applied

SvGrid follows [semver](https://semver.org/) strictly **for everything
exported from the package root**:

```ts
import { SvGrid, tableFeatures, /* ... */ } from 'sv-grid-core'
```

Anything reached via `'sv-grid-core/internal'` or a deeper path is
**not** covered. We may rename, reshape, or remove those between any
two minor releases.

| Change                                              | Bump      |
| --------------------------------------------------- | --------- |
| Remove or rename a top-level export                 | major     |
| Remove an existing public prop                      | major     |
| Change the meaning of an existing prop / option     | major     |
| Tighten a public TypeScript type (becomes stricter) | major     |
| Add a new optional prop / option / export           | minor     |
| Loosen a TypeScript type (becomes wider)            | minor     |
| Fix a bug that produces a different output value    | patch (documented in the changelog) |
| Internal refactor with no observable change         | patch     |

## Stability tiers

Every public symbol is labelled in its JSDoc. The badges that show up
in the API reference (and at the top of each topic page):

| Badge          | Meaning                                                                            |
| -------------- | ---------------------------------------------------------------------------------- |
| **Stable**     | Covered by the semver promise. We will not break you between majors.               |
| **Stable, accepting feedback** | Same semver protection as Stable. We're collecting feedback on the shape; if it changes it will be in a major. |
| **Experimental** | May change in any minor release. Use only when you can absorb churn.              |
| **Deprecated** | Still works. Will be removed in a future major. The doc + the `@deprecated` JSDoc tag say which release. |
| **Internal**   | Not part of the public API. Imports may break in any release.                      |

The TypeScript types double as the source of truth: every Stable export
has explicit `@public` JSDoc; every Internal one has `@internal`.
Internal symbols are excluded from the published `.d.ts`.

## Current stability map

The package surface as of the current shipping version:

### `sv-grid-core`

| Surface                              | Tier              |
| ------------------------------------ | ----------------- |
| `<SvGrid>` component + every prop on it | Stable           |
| `createSvGrid`, `tableFeatures`      | Stable            |
| `renderSnippet`                      | Stable            |
| `rowSortingFeature`, `columnFilteringFeature`, `rowSelectionFeature`, `columnGroupingFeature`, `rowExpandingFeature` | Stable |
| `SvGridApi` (the imperative API)     | Stable            |
| Header-cell render snippets          | Stable, accepting feedback |
| Column-group multi-row headers       | Stable (since v1.x) |
| `createGridState`                    | Stable            |
| Anything imported via a deep path (`/internal`, `/test-utils`) | Internal |

### `sv-grid-pro`

| Surface                              | Tier              |
| ------------------------------------ | ----------------- |
| `installPro`, `ProGridApi`           | Stable            |
| `exportGrid`, `ExportOptions`        | Stable            |
| `printGrid`, `PrintOptions`          | Stable            |
| `importData`, `ImportOptions`, `ImportResult` | Stable, accepting feedback |
| `setAIProvider`, `AIProvider`        | Stable, accepting feedback |
| `aiFilter`, `aiSmartFill`, `aiSummarize`, `aiClassify` + their option types | Stable, accepting feedback |
| `mockAIProvider`                     | Experimental - we may rename or expand the shape |
| License helpers (`setLicenseKey`, etc.) | Stable          |

## Deprecation lifecycle

When something Stable is about to go away:

1. The JSDoc gets `@deprecated since vX.Y` with a one-line pointer to
   the replacement.
2. The TypeScript declaration starts emitting a deprecation warning
   (most editors render it as struck-through autocomplete).
3. The next **minor** release ships with the deprecation in place but
   the old API still working.
4. The next **major** release removes the old API.
5. The deprecation entry stays in the changelog under a "Removed in
   vN" heading for the version that removed it.

In practice this means **at least one minor release** between marking
something deprecated and removing it - often two.

## Release cadence

- **Patch releases** ship on demand, sometimes weekly, sometimes
  monthly. Every bug fix that doesn't change the shape goes here.
- **Minor releases** ship roughly monthly. Every new feature lands in
  a minor.
- **Major releases** ship at most twice a year. Major version skips
  (jumping from v2 to v4) happen only if a major change is so
  invasive the bridge isn't worth the maintenance cost.

The changelog ([`CHANGELOG.md`](../../CHANGELOG.md)) is canonical.
Every release has a dated entry with three sections: Breaking,
Features, Fixes. Breaking changes carry a migration paragraph.

## What "stable" doesn't promise

- **CSS class names**. We use `.sv-grid-*` consistently, but they're
  not part of the semver contract. Override them at your peril.
- **DOM structure**. The grid emits whatever markup it needs to.
  Querying `tbody tr td:first-child` from your test is your
  responsibility, not ours.
- **Console messages**. Warning text is editorial; we may reword.
  Error class names + types ARE stable - the
  [error reference](./errors.md) is the canonical list.
- **Bundler output paths**. The published package exposes the
  `exports` map; importing from a non-mapped path may break at any
  time.

## Deprecation log

The single source of truth for what's been marked deprecated, when,
why, and what to use instead. Read top-down for newest first; agents
can parse this table directly.

| Symbol                           | Deprecated since | Removal target | Replacement                                              | Reason                                              |
| -------------------------------- | ---------------- | -------------- | -------------------------------------------------------- | --------------------------------------------------- |
| `<SvGrid filterMode="row">`      | v1.4             | v2.0           | `filterMode="menu"` + `showFilterRow={true}` if you really want both | The two modes were mutually exclusive in the type but both rendered when set; the split makes the intent explicit |
| `mockAIProvider` named export    | v1.6             | v2.0           | `import { mockAIProvider } from 'sv-grid-pro/test-utils'` | Test helpers are moving out of the production bundle |
| `ColumnDef.cellClassRules`       | v1.3             | v2.0           | `cellClass: (ctx) => Record<string, boolean>`            | One field is enough; the rules format was unnecessary indirection |
| `<SvGrid onCellClick>`           | v1.5             | v2.0           | `onActiveCellChange` + your own click handler            | The grid intercepts click already for selection / editing; surfacing it as a prop double-fires |

Empty section means "no current deprecations" - we'd link the
previous-version deprecation log in the changelog.

### Format your own integrations can parse

Every entry follows the same six-column shape so an LLM or an
upgrade-assistant script can read this table and propose
edits. The pattern is:

```
| <symbol> | <version deprecated> | <version removed> | <replacement> | <reason> |
```

When v2 ships, the "Removed in v2" entries move to the changelog
under a `### Removed` section and out of this table.

## Long-term support

- **Currently shipping major** (v1.x) - all releases supported with bug
  fixes + security patches.
- **Previous major** (when v2 ships, v1 enters LTS) - security
  patches only, for **12 months** after v2.0.0.
- **Older majors** - no support.

For Pro customers, our support contract may extend LTS beyond 12
months on a case-by-case basis - contact `sales@jqwidgets.com`.

## See also

- [API reference](./api-reference.md) - every export with its tier
  badge.
- [Error reference](./errors.md) - the stable error class + message
  inventory.
- [Migrating from AG Grid](./migrating-from-ag-grid.md) - if you're
  coming from a previous-generation grid.
