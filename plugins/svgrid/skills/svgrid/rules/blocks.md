# Page blocks (`npx @svgrid/ui add blocks/<group>`)

Components are imports: `import { SvButton } from '@svgrid/grid'`. Blocks are
the one copy-in layer on top. A block is a whole page section (a sign-in
screen, a 404 page, a pricing table) written as a single `.svelte` file that
imports from `@svgrid/grid` only. The `@svgrid/ui` CLI copies it into the
user's project, where it becomes their code.

Blocks are MIT, like the components inside them. They need `@svgrid/grid` and
nothing else; never add `@svgrid/enterprise` for a block.

## When to reach for one

The user asks for a login page, sign-up form, 2FA screen, app shell with a
sidebar, analytics dashboard, pricing section, or another standard page
section in a Svelte 5 / SvelteKit app. Add the block instead of writing the
section from scratch, then edit the copied file to fit:

```sh
npx @svgrid/ui list                 # every block group and its blocks
npx @svgrid/ui add blocks/auth      # the whole group
npx @svgrid/ui add login            # one block
npx @svgrid/ui add login --dir src/lib/blocks
```

Files land in `src/lib/components/ui/` (or `componentsDir` in `svgrid.json`,
or `--dir`). Render the block from a route:

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
  import Login from '$lib/components/ui/login.svelte'
</script>

<Login />
```

## Headless cores

Every block is headless. Its `<script lang="ts" module>` exports a
`create<Name>()` core (state, validation, async flow, prop-getters, no markup);
the styled component in the same file is one render of it. When the user wants
their own markup, take the core and write the markup against it:

```sh
npx @svgrid/ui add auth-forgot-password --headless   # auth-forgot-password.svelte.ts
```

Import it as `./auth-forgot-password.svelte.js`. Block classes are all
`sv-<stem>-*`; keep that prefix when you add classes to a copied block.

## Editing a copied block

- Replace the demo submit (a `toast.promise` around a timer) with the real
  request, or use a SvelteKit form action: give the `<form>` `method="POST"`
  and give each input a `name`.
- Keep colors on the `--sg-*` tokens so the block follows the app theme and
  dark mode. Do not hard-code hex values for chrome.
- The `Sv*` components inside update with `@svgrid/grid`; the block markup
  around them does not. Do not re-run `add --force` over a block the user
  has edited.

## Grounding

The list of groups and blocks changes as blocks ship. Read it from
`npx @svgrid/ui list`, the docs at
<https://svgrid.com/docs/help/ui-blocks/>, or `svgrid_search` with
`kind: "examples"` and the query "block". Do not guess block names.
