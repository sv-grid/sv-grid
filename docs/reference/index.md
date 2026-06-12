# API reference

The exhaustive surface of the published packages. For walkthroughs +
patterns see [Help](../help/index.md); for first contact see
[Getting started](../getting-started.md).

## sv-grid-community

| Page                          | What's in it                                                          |
| ----------------------------- | --------------------------------------------------------------------- |
| [`<SvGrid>`](./SvGrid.md)     | Every prop and callback on the render component.                      |
| [`SvGridApi`](./SvGridApi.md) | The imperative API: data, columns, sort, filter, group, selection.   |
| [`ColumnDef`](./ColumnDef.md) | Every field on a column definition + the sub-types.                   |
| [Features](./features.md)     | The feature registry + the row-model factory pipeline.                |

## sv-grid-pro

| Page                  | What's in it                                                          |
| --------------------- | --------------------------------------------------------------------- |
| [Pro reference](./pro.md) | Export, print, import, AI helpers, pivot - the full Pro surface.  |

## Conventions

- **Required props** are listed without a default column.
- **Defaults** in the tables are the values the wrapper supplies when
  you omit the prop. `derived` means the value is computed from
  another prop.
- **Callbacks** all take fully-typed payload objects; the type tables
  show the inferred signature.
- **`TFeatures`** is the type produced by `tableFeatures({...})` -
  pass `typeof features` to keep column-level inference honest.
