# sv-grid-wc

**SvGrid as a framework-agnostic web component.** A single, self-contained
`<sv-grid>` [custom element](https://developer.mozilla.org/en-US/docs/Web/API/Web_components)
you can drop into React, Vue, Angular, or plain HTML - no build step, no Svelte
required in the host app.

Powered by [SvGrid](https://www.svgrid.com), the Svelte 5 data grid:
virtualization, Excel-style filters, sorting, inline editing, grouping, and
pagination.

## CDN (zero build)

```html
<script type="module" src="https://unpkg.com/sv-grid-wc"></script>

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
npm install sv-grid-wc
```

```js
import 'sv-grid-wc' // registers <sv-grid> globally
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

Full guide: [svgrid.com/docs/help/web-components](https://www.svgrid.com/docs/help/web-components).

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

This element ships the free MIT `sv-grid-community` core. For export, import,
print, pivot, and AI, see [sv-grid-pro](https://www.svgrid.com/pricing).

SvGrid(TM) is a trademark of jQWidgets Ltd. This package is MIT-licensed.
