# Changesets

This folder holds one markdown file per pending change. Each file
declares the version bump + a user-facing note.

The release workflow consumes these on `pnpm changeset version` to:
- Bump package.json versions correctly
- Stitch the notes into `docs/changelog.md` under the new release
- Empty the folder (changes have been published)

## Authoring a changeset

```bash
pnpm changeset
```

Walks you through:
1. Which packages this change affects (`@svgrid/grid`,
   `@svgrid/enterprise`, both)
2. Whether it's `patch`, `minor`, or `major`
3. A one-paragraph user-facing note

The CLI writes the file as `<adjective>-<noun>-<adjective>.md`. Don't
rename it - the random handle is what stops merge conflicts when
many people add changesets at once.

## File format

```md
---
'@svgrid/grid': minor
'@svgrid/enterprise': minor
---

Added per-column `sortable` and `filterable` properties so individual
columns can opt out of sorting / filtering even when the matching
feature is registered globally. Defaults remain `true` so this is
fully backwards-compatible.
```

The frontmatter is a strict mapping; the body is one or two
paragraphs of release-note prose. Keep it to "what changed for the
consumer" - the technical detail goes in the PR description.

## During a release

```bash
pnpm changeset version    # consumes every .md file in this folder,
                          # bumps versions, updates docs/changelog.md
pnpm install              # picks up new versions in lockfile
git commit -am "release"
pnpm publish -r           # ship to npm
```

The previous changesets disappear from the folder; they live on in
`docs/changelog.md` permanently.

## Why this format

- **Merge-conflict-free.** Each PR drops a uniquely-named file; no
  shared changelog edit to conflict on.
- **Agent-readable.** An LLM upgrade-helper can diff `.changeset/*`
  between commits to summarise "what's coming in the next release"
  without parsing prose changelogs.
- **Per-package bumping.** A change can be `patch` on community and
  `minor` on pro; the frontmatter makes that explicit.

## See also

- [Keep a Changelog](https://keepachangelog.com/)
- [Changesets docs](https://github.com/changesets/changesets)
- [API stability + deprecation log](../docs/help/api-stability.md)
