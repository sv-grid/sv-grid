# Quick start: the grid in any page

`@svgrid/grid-wc` is a prebuilt custom element. One `<script>` tag, one HTML
element, no bundler and no Svelte in your app.

```html
<script type="module" src="https://unpkg.com/@svgrid/grid-wc"></script>

<sv-grid id="grid" sortable filterable style="display:block;height:420px"></sv-grid>

<script type="module">
  const grid = document.getElementById('grid')
  grid.columns = [{ field: 'name', header: 'Name' }, { field: 'role', header: 'Role' }]
  grid.data = [{ name: 'Ada', role: 'Engineering' }, { name: 'Alan', role: 'Research' }]
</script>
```

Or from npm:

```bash
npm install @svgrid/grid-wc
```

```js
import '@svgrid/grid-wc' // side effect: registers <sv-grid>
```


## The one rule worth learning first

The grid the element wraps. Everything below configures this.

<div data-docs-demo="01-quick-start" data-height="460"></div>

**Attributes are strings; everything else is a property.**

```html
<!-- Primitives: attribute or property, both fine -->
<sv-grid sortable page-size="25" row-height="32"></sv-grid>
```

```js
// Arrays, objects and functions: property only. There is no string form.
grid.columns = [{ field: 'name', header: 'Name' }]
grid.data = rows
grid.groupBy = ['country']
grid.getRowId = (row) => row.id
```

Setting `columns` as an attribute produces `columns="[object Object]"` and an
empty grid. That is the single most common mistake with any custom element, and
the [reference](./sv-grid.md) marks which props can be which.


## Turning features on

What `sortable`, `filterable`, `pageable` and `page-size` produce.

<div data-docs-demo="02-sort-filter-paginate" data-height="480"></div>

Every one of the grid's props is reachable. The 72 primitive ones have
attributes, so a lot is configurable without any script at all:

```html
<sv-grid
  sortable
  filterable
  pageable
  page-size="25"
  show-row-numbers
  zebra-rows
  enable-inline-editing
  show-filter-row
  group-display-mode="singleColumn"
  style="display:block;height:480px"
></sv-grid>
```

Anything array- or object-shaped goes through a property:

```js
grid.groupBy = ['country', 'city']
grid.pinnedTopRows = [totalsRow]
grid.initialSorting = [{ id: 'amount', desc: true }]
grid.conditionalFormats = [{ when: { field: 'amount', op: 'gt', value: 1000 }, style: 'ok' }]
```


## Listening for changes

Editing is where most events come from - `cellvaluechange` fires on every commit here.

<div data-docs-demo="05-inline-editing" data-height="460"></div>

Every grid callback is a DOM `CustomEvent`, so any host listens the standard
way. `detail` is the callback's argument:

```js
grid.addEventListener('cellvaluechange', (e) => {
  const { rowIndex, columnId, oldValue, newValue } = e.detail
  save(rowIndex, columnId, newValue)
})

grid.addEventListener('sortingchange', (e) => console.log(e.detail))
```

## Calling the grid

```js
grid.addEventListener('apiready', (e) => e.detail.exportCsv())

// The handle is also on the element, so binding late still works:
grid.api.exportCsv()
```

## Two elements

`<sv-grid>` renders in the light DOM, so your page's CSS applies to it. If you
are dropping the grid into a page whose CSS you do not control, use
[`<sv-grid-shadow>`](./shadow-dom.md) instead - same API, style-isolated.

## Next

- [`<sv-grid>` reference](./sv-grid.md) - every property, attribute and event.
- [React](./react.md), [Vue](./vue.md), [Angular](./angular.md).
- [TypeScript](./typescript.md) - typing the element in TSX and TS.
- [Limitations](./limitations.md) - what cannot cross the boundary.
