# Contributing to SvGrid

Thanks for taking the time. This file covers how to get the repo running, what
kinds of contributions we take, and the conventions the codebase follows.

## Before you start

- **Bugs and feature requests** go in [Issues](https://github.com/sv-grid/sv-grid/issues).
- **Questions and ideas** go in [Discussions](https://github.com/sv-grid/sv-grid/discussions).
- **Security vulnerabilities** do not go in either. See [SECURITY.md](SECURITY.md).

Only `packages/grid`, `packages/grid-wc`, `packages/svgrid-ui`, and the two
`create-*` scaffolders are MIT-licensed and open to code contributions. The
Enterprise pack, Studio, the MCP server, and the website are commercial: bug
reports are very welcome, pull requests against them are not.

## Setup

```bash
corepack enable           # picks up the pinned pnpm version
pnpm install
pnpm dev                  # demo gallery at http://localhost:5174
```

Node 18+ is required. The example gallery links the library through the
workspace, so edits in `packages/grid/src/**` hot-reload with no rebuild.

## Before you open a PR

```bash
pnpm test                 # grid test suite
pnpm test:types           # type-check every package
pnpm lint
```

Run the full test suite, not a subset. Some failures only surface when the whole
suite runs together.

If you touched anything that changes bundle output or the demo list, re-derive
the numbers rather than editing them by hand:

```bash
pnpm size                 # gzipped bundle, writes nothing - copy the output
pnpm demos:count          # live demo count
```

## Adding a demo

Demos live in `examples/src/demos/<id>-<slug>.svelte`. Every demo must also be
registered in `website/src/lib/demos.ts` with a matching id, or
`pnpm demos:count` will fail. The website reuses the same `.svelte` files but
keeps its own curated list.

Community demos are a lighter path: see
[examples/src/demos/community/README.md](examples/src/demos/community/README.md).

## Conventions

- **Svelte 5 runes only.** No Svelte 4 stores in new code.
- **Types over casts.** `as` casts inside template expressions type-check but
  break the build; keep casts in `<script>` and re-export types from `.ts` files.
- **No em-dash characters** anywhere in the repo, including docs and comments.
  Use a plain hyphen.
- **Match the surrounding code.** Comment density, naming, and idiom should look
  like the file you are editing.
- **Features are opt-in.** New grid capability registers through the existing
  feature/row-model seams so it tree-shakes out when unused.

## Changesets

User-visible changes need a changeset. See
[.changeset/README.md](.changeset/README.md) for the format this repo uses.

## Licensing of contributions

By submitting a pull request against an MIT-licensed package, you agree that
your contribution is licensed under that package's MIT License.
