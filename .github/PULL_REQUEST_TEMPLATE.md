<!--
Contributing from outside the team? Pull requests are accepted for community
demos only (examples/src/demos/community/). Fill in the "Community demo"
section and delete the rest. For anything else, open an issue instead:
the maintainers write the package code. See CONTRIBUTING.md.
-->

## Community demo

<!-- Delete this section if you are a maintainer changing something else. -->

- Demo file: `examples/src/demos/community/<slug>.svelte`
- What it shows:

- [ ] Copied from `example-status-board.svelte` and filled in the header (title, author, github, tags)
- [ ] `discussion: 0` left as is
- [ ] One file, inline data, imports only from `@svgrid/grid` (or `@svgrid/enterprise` for a Pro feature)
- [ ] Runs in the [playground](https://svgrid.com/demos/) without errors

---

<!-- Maintainers: the sections below. -->

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
