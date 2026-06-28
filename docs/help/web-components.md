# Web Components & Custom Elements

Ship SvGrid as a framework-agnostic web component (custom element) and use
the Svelte 5 data grid in React, Vue, Angular, or plain HTML - no Svelte
required in the host app.

SvGrid is authored in Svelte 5, but Svelte compiles to standards-based
[custom elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_components).
That means you can wrap `<SvGrid>` once, build it to a single `.js` file, and
drop `<sv-grid>` into any page or framework - the same way you'd use a native
HTML element. If you searched for a "web component data grid" or a
"framework-agnostic Svelte table," this is the integration path.

## Why a custom element

- **Use it anywhere.** React, Vue, Angular, Solid, Astro, Rails/Laravel
  server-rendered pages, or a plain `<script>` tag. The browser treats
  `<sv-grid>` like any built-in element.
- **One bundle, no framework lock-in.** Ship a single file to a CDN; consumers
  add one `<script type="module">` and a tag.
- **Same engine.** The custom element wraps the real grid - virtualization,
  Excel-style filters, inline editing, grouping, sorting, pagination all come
  along.

If your team *is* on Svelte 5, use the component directly
([First grid](../getting-started/2-first-grid.md)) - the custom element only
exists to reach non-Svelte hosts.

## Quick start (no build)

We publish a prebuilt, self-contained element as
[`@svgrid/grid-wc`](https://www.npmjs.com/package/@svgrid/grid-wc). Drop it in from a CDN
and you're done - no bundler, no Svelte in your app:

```html
<script type="module" src="https://unpkg.com/@svgrid/grid-wc"></script>

<sv-grid id="grid" sortable filterable style="display:block;height:420px"></sv-grid>

<script type="module">
  const grid = document.getElementById('grid')
  grid.columns = [{ field: 'name', header: 'Name' }, { field: 'role', header: 'Role' }]
  grid.data = [{ name: 'Ada', role: 'Engineering' }, { name: 'Alan', role: 'Research' }]
</script>
```

Or via npm:

```bash
npm install @svgrid/grid-wc
```

```js
import '@svgrid/grid-wc' // registers <sv-grid> globally
```

The rest of this page shows how that package is built, so you can fork it,
trim it, or extend the attribute surface for your own element.

## 1. The wrapper component

Create one Svelte file that declares the custom element and maps its
properties onto `<SvGrid>`. Complex inputs (`data`, `columns`) are passed as
JavaScript **properties**; simple toggles are exposed as **attributes**.

```svelte
<!-- src/sv-grid-element.svelte -->
<svelte:options
  customElement={{
    tag: 'sv-grid',
    shadow: 'none',
    props: {
      data: { type: 'Array' },
      columns: { type: 'Array' },
      sortable: { type: 'Boolean', attribute: 'sortable' },
      filterable: { type: 'Boolean', attribute: 'filterable' },
      selectable: { type: 'Boolean', attribute: 'selectable' },
      editable: { type: 'Boolean', attribute: 'editable' },
      rowHeight: { type: 'Number', attribute: 'row-height' },
    },
  }}
/>

<script lang="ts">
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
  } from '@svgrid/grid'

  let {
    data = [],
    columns = [],
    sortable = true,
    filterable = true,
    selectable = false,
    editable = false,
    rowHeight = 36,
  } = $props()

  // Build the feature set from the boolean attributes.
  const features = $derived(
    tableFeatures({
      ...(sortable ? { rowSortingFeature } : {}),
      ...(filterable ? { columnFilteringFeature } : {}),
      ...(selectable ? { rowSelectionFeature } : {}),
    }),
  )

  // Re-emit grid callbacks as DOM CustomEvents so non-Svelte hosts can listen
  // with addEventListener('rowclick', ...). $host() is the custom element.
  function emit(name: string, detail: unknown) {
    $host().dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
  }
</script>

<div style="height: 100%; min-height: 320px;">
  <SvGrid
    {data}
    {columns}
    features={features}
    filterMode="menu"
    selectionMode="row"
    showRowSelection={selectable}
    enableInlineEditing={editable}
    {rowHeight}
    containerHeight="100%"
    fitColumns={true}
    onRowClick={(e) => emit('rowclick', e.row)}
    onRowSelectionChange={(_e, sel) => emit('selectionchange', sel)}
  />
</div>
```

`shadow: 'none'` keeps the grid in the light DOM so your page's CSS custom
properties (`--sg-*`) theme it normally. See
[Styling](#styling-and-shadow-dom) for the trade-offs.

## 2. Build it to a single file

Enable custom-element compilation **only** for the wrapper (compiling every
component as a custom element would break the internal grid). With
`@sveltejs/vite-plugin-svelte`:

```js
// vite.config.js
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [
    svelte({
      // Compile ONLY the wrapper as a custom element.
      dynamicCompileOptions({ filename }) {
        if (filename.endsWith('sv-grid-element.svelte')) {
          return { customElement: true }
        }
      },
    }),
  ],
  build: {
    lib: {
      entry: 'src/sv-grid-element.svelte',
      formats: ['es'],
      fileName: 'sv-grid-element',
    },
  },
})
```

```bash
npm run build   # -> dist/sv-grid-element.js
```

Host the resulting `dist/sv-grid-element.js` on your own server or a CDN.

## 3. Use it in plain HTML

```html
<script type="module" src="/sv-grid-element.js"></script>

<sv-grid id="grid" sortable filterable style="display:block;height:420px"></sv-grid>

<script type="module">
  const grid = document.getElementById('grid')
  // Arrays/objects are set as properties, not attributes:
  grid.columns = [
    { field: 'name', header: 'Name', editorType: 'text', width: 200 },
    { field: 'role', header: 'Role', width: 160 },
    { field: 'salary', header: 'Salary', align: 'right',
      format: { type: 'currency', currency: 'USD' } },
  ]
  grid.data = [
    { name: 'Ada Lovelace', role: 'Engineering', salary: 145000 },
    { name: 'Alan Turing', role: 'Research', salary: 160000 },
  ]
  grid.addEventListener('rowclick', (e) => console.log('clicked row', e.detail))
</script>
```

## 4. Use it in React, Vue, Angular

The element is registered globally once you import the bundle. Each framework
passes object props slightly differently:

**React 19+** passes objects/arrays to custom elements directly:

```jsx
import '/sv-grid-element.js'

export function Grid({ rows, columns }) {
  return <sv-grid sortable filterable .data={rows} .columns={columns} />
}
```

On React 18 and earlier, set the properties via a `ref` instead
(`ref.current.data = rows`), since older React serializes props to attributes.

**Vue 3** - bind as a property with `.prop`, and tell Vue it's a custom
element (`compilerOptions.isCustomElement` / `app.config` for `sv-`):

```vue
<sv-grid sortable filterable :data.prop="rows" :columns.prop="columns" />
```

**Angular** - add `CUSTOM_ELEMENTS_SCHEMA` to the module/component, then bind
properties:

```html
<sv-grid [data]="rows" [columns]="columns" sortable filterable></sv-grid>
```

## Styling and shadow DOM

| Mode | What happens | When to use |
| --- | --- | --- |
| `shadow: 'none'` (recommended) | Grid renders in the light DOM. Page CSS and `--sg-*` theme tokens apply normally. | Almost always - a data grid wants to inherit your app theme. |
| `shadow: 'open'` (Svelte default) | Grid is encapsulated in a shadow root. Set `--sg-*` tokens on the `sv-grid` host; outside CSS won't leak in. | Strict style isolation / embedding in third-party pages. |

Theme either mode with the same custom properties:

```css
sv-grid {
  --sg-bg: #fff;
  --sg-header-bg: #f8fafc;
  --sg-border: #e2e8f0;
}
```

See [Tailwind integration](./tailwind.md) for the full `--sg-*` token list.

## Events

The wrapper above re-emits grid callbacks as DOM `CustomEvent`s, so any host
listens the standard way:

```js
grid.addEventListener('rowclick', (e) => { /* e.detail = the row */ })
grid.addEventListener('selectionchange', (e) => { /* e.detail = selected rows */ })
```

Add more by calling `emit('yourevent', detail)` from any SvGrid callback.

## Caveats

- **Objects go through properties, not attributes.** `data` and `columns` are
  arrays - set `el.data = [...]`, not `data="..."`. Only primitive toggles
  (`sortable`, `row-height`) work as HTML attributes.
- **Custom cell snippets** (`renderSnippet`) are a Svelte authoring feature.
  Across the custom-element boundary, prefer column `format` options and
  `accessorFn` for display, or build the snippet logic inside the wrapper.
- **Bundle size.** The custom element ships the grid plus the Svelte runtime in
  one file. That's expected for a self-contained drop-in element; native Svelte
  consumers share the runtime and ship less.
- **Enterprise features.** `installEnterprise` works the same inside the wrapper - import it
  and augment the api in `onApiReady`. The license check is unchanged.

## Frequently asked questions

### Can I use SvGrid without Svelte?

Yes. Compile it to a custom element (web component) and use `<sv-grid>` in
React, Vue, Angular, or plain HTML. The host app does not need Svelte
installed - the element ships the runtime inside its own bundle.

### Does SvGrid work as a web component / custom element?

Yes. Svelte 5 compiles components to standards-based custom elements. Wrap
`<SvGrid>` in a file with `<svelte:options customElement="sv-grid">`, build it
to a single `.js`, and register `<sv-grid>` globally.

### How do I use SvGrid in React, Vue, or Angular?

Build the custom element, import the bundle once, then render `<sv-grid>` and
set `data` / `columns` as properties. React 19, Vue (`:data.prop`), and Angular
(`CUSTOM_ELEMENTS_SCHEMA`) all support binding object properties to custom
elements.

### Should I use shadow DOM?

For a data grid, usually no - build with `shadow: 'none'` so your app's CSS and
`--sg-*` theme tokens apply. Use shadow DOM only when you need strict style
isolation.

### How do I pass columns and data to the `<sv-grid>` element?

As JavaScript properties: `el.columns = [...]; el.data = [...]`. HTML
attributes only carry strings, so arrays and objects must be set on the element
instance.

## See also

- [First grid](../getting-started/2-first-grid.md) - using SvGrid directly in Svelte
- [Starters & scaffolding](../getting-started/starters.md) - `npm create @svgrid`
- [Tailwind integration](./tailwind.md) - the `--sg-*` theme tokens
- [Architecture](./architecture.md) - headless core vs. render component
