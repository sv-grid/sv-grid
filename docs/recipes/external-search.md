# External search box with highlighted matches

> Live in [demo 69-highlighted-search](https://svgrid.com/demos/69-highlighted-search/).

<div data-docs-demo="69-highlighted-search" data-height="480"></div>


## When

A search input outside the grid filters the visible rows AND highlights matched substrings inline.

## How

Key API surface:

- `derived visibleRows`
- `custom cell snippet wraps matches in <mark>`

See the demo source for the full implementation; this recipe pins the
pattern + the surface so you can copy-paste it confidently. The doc
page that explains the underlying feature in depth is linked from the
[recipes index](./index.md).

## See also

- [Demo 69-highlighted-search source](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/69-highlighted-search.svelte)
- [Demo 69-highlighted-search prompt sidecar](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/prompts/69-highlighted-search.md) - drop into an LLM context window
- [Recipes index](./index.md)
