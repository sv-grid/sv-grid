<p align="center">
  <img src="https://svgrid.com/brand/svgrid-logo-icon-1200.png" alt="SvGrid" width="100" height="100" />
</p>

<h1 align="center">@svgrid/grid-wc</h1>

<p align="center"><strong>SvGrid as a framework-agnostic web component.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@svgrid/grid-wc"><img src="https://img.shields.io/npm/v/%40svgrid%2Fgrid-wc.svg?label=%40svgrid%2Fgrid-wc" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@svgrid/grid-wc"><img src="https://img.shields.io/npm/dm/%40svgrid%2Fgrid-wc.svg" alt="npm downloads" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-brightgreen.svg" alt="MIT License" /></a>
</p>

<p align="center">
  <a href="https://svgrid.com">Website</a> ·
  <a href="https://svgrid.com/docs/">Docs</a> ·
  <a href="https://svgrid.com/demos/">Demos</a>
</p>

---

A single, self-contained `<sv-grid>`
[custom element](https://developer.mozilla.org/en-US/docs/Web/API/Web_components)
you can drop into **React, Vue, Angular, or plain HTML** - no build step, no Svelte
required in the host app.

Powered by [SvGrid](https://svgrid.com), the Svelte 5 data grid and data table:
virtual scrolling, Excel-style filters, sorting, inline editing, grouping, and
pagination.

## CDN (zero build)

```html
<script type="module" src="https://unpkg.com/@svgrid/grid-wc"></script>

<sv-grid id="grid" sortable filterable style="display:block;height:420px"></sv-grid>

<script type="module">
  const grid = document.getElementById('grid')
  // Arrays/objects are set as PROPERTIES, not attributes:
  grid.columns = [
    { field: 'name', header: 'Name', editorType: 'text', width: 200 },
    { field: 'salary', header: 'Salary', align: 'right',
      format: { type: 'currency', currency: 'USD' } },
  ]
  grid.data = [
    { name: 'Ada Lovelace', salary: 145000 },
    { name: 'Alan Turing', salary: 160000 },
  ]
  grid.addEventListener('rowclick', (e) => console.log(e.detail))
</script>
```

## npm

```bash
npm install @svgrid/grid-wc
```

```js
import '@svgrid/grid-wc' // registers <sv-grid> globally
```

## Attributes & properties

| Name | Kind | Default | Notes |
| --- | --- | --- | --- |
| `data` | property | `[]` | Array of row objects. Set via `el.data = [...]`. |
| `columns` | property | `[]` | Array of column defs. Set via `el.columns = [...]`. |
| `sortable` | attribute (boolean) | `true` | Enable column sorting. |
| `filterable` | attribute (boolean) | `true` | Enable column filtering. |
| `selectable` | attribute (boolean) | `false` | Row checkboxes + selection. |
| `editable` | attribute (boolean) | `false` | Inline cell editing. |
| `row-height` | attribute (number) | `36` | Row height in px. |

### Events

| Event | `detail` |
| --- | --- |
| `rowclick` | the clicked row object |
| `selectionchange` | array of selected rows |

## Frameworks

- **React 19+**: `<sv-grid sortable .data={rows} .columns={cols} />` (older React: set via a `ref`).
- **Vue 3**: `<sv-grid sortable :data.prop="rows" :columns.prop="cols" />`.
- **Angular**: add `CUSTOM_ELEMENTS_SCHEMA`, then `<sv-grid [data]="rows" [columns]="cols" sortable>`.

Full guide: [svgrid.com/docs/help/web-components](https://svgrid.com/docs/help/web-components/).

## Styling

Built with `shadow: 'none'` (light DOM) so your page CSS and the `--sg-*` theme
tokens apply, and the grid's overlay popups stay styled:

```css
sv-grid {
  --sg-bg: #fff;
  --sg-header-bg: #f8fafc;
  --sg-border: #e2e8f0;
}
```

## Pro

This element ships the free MIT `@svgrid/grid` core. For export, import,
print, pivot, and AI, see [@svgrid/enterprise](https://svgrid.com/pricing/).

SvGrid(TM) is a trademark of jQWidgets Ltd. This package is MIT-licensed.
