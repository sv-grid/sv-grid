<!--
Pull requests are accepted against the MIT packages only: packages/grid,
packages/grid-wc, packages/svgrid-ui, packages/create-sv-grid,
packages/create-studio. Bug reports against the commercial packages are
welcome, PRs against them are not.
-->

## What this changes

<!-- One or two sentences. Link the issue if there is one. -->

Closes #

## Why

<!-- The problem this solves. Skip if the issue already covers it. -->

## Checklist

- [ ] `pnpm test` passes (the full suite, not a subset)
- [ ] `pnpm test:types` passes
- [ ] `pnpm lint` passes
- [ ] Added or updated tests for the behaviour change
- [ ] Added a changeset if this is user-visible (see `.changeset/README.md`)
- [ ] No em-dash characters anywhere in the diff
- [ ] If a demo was added: registered it in `website/src/lib/demos.ts` and
      `pnpm demos:count` passes
- [ ] If bundle output changed: re-ran `pnpm size` and updated any quoted numbers
