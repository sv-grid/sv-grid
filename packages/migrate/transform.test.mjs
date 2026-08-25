import { test, expect, describe } from 'vitest'
import { migrate } from './transform.mjs'

const BASIC = `<script lang="ts">
  import { readable } from 'svelte/store';
  import { createTable, Subscribe, Render } from 'svelte-headless-table';
  import { addSortBy, addPagination } from 'svelte-headless-table/plugins';

  const data = readable([
    { name: 'Ada Lovelace', age: 21 },
    { name: 'Barbara Liskov', age: 52 },
  ]);

  const table = createTable(data, {
    sort: addSortBy(),
    page: addPagination({ initialPageSize: 20 }),
  });

  const columns = table.createColumns([
    table.column({ header: 'Name', accessor: 'name' }),
    table.column({ header: 'Age', accessor: 'age' }),
  ]);

  const { headerRows, rows, tableAttrs, tableBodyAttrs } = table.createViewModel(columns);
</script>

<table {...$tableAttrs}>
  <thead>
    {#each $headerRows as headerRow (headerRow.id)}
      <Subscribe rowAttrs={headerRow.attrs()} let:rowAttrs>
        <tr {...rowAttrs}>
          {#each headerRow.cells as cell (cell.id)}
            <th><Render of={cell.render()} /></th>
          {/each}
        </tr>
      </Subscribe>
    {/each}
  </thead>
  <tbody {...$tableBodyAttrs}>
    {#each $rows as row (row.id)}
      <tr><td>x</td></tr>
    {/each}
  </tbody>
</table>
`

describe('migrate', () => {
  test('translates the quick-start shape end to end', () => {
    const r = migrate(BASIC)
    expect(r.applicable).toBe(true)
    // Columns carry over as field/header pairs.
    expect(r.code).toContain("field: 'name'")
    expect(r.code).toContain("header: 'Name'")
    expect(r.code).toContain("field: 'age'")
    // Plugins become the verified SvGrid props.
    expect(r.code).toContain('sortable')
    expect(r.code).toContain('pageable')
    expect(r.code).toContain('pageSize={20}')
    // The store wrapper is unwrapped to a plain array.
    expect(r.code).toContain("{ name: 'Ada Lovelace', age: 21 }")
    expect(r.code).not.toContain('readable(')
    // The scaffolding is gone.
    expect(r.code).not.toContain('Subscribe')
    expect(r.code).not.toContain('createViewModel')
    expect(r.code).not.toContain('<table')
    expect(r.code).toContain('<SvGrid')
    expect(r.code).toContain("from '@svgrid/grid'")
  })

  test('emits a TS type annotation only for lang="ts"', () => {
    expect(migrate(BASIC).code).toContain('const columns: GridColumns<(typeof data)[number]> =')
    const js = BASIC.replace('<script lang="ts">', '<script>')
    const r = migrate(js)
    expect(r.code).toContain('const columns =')
    expect(r.code).not.toContain('GridColumns')
    expect(r.code).toContain("import { SvGrid } from '@svgrid/grid'")
  })

  test('is a no-op on a file that does not use the library', () => {
    const src = '<script>\n  const a = 1;\n</script>\n<p>hi</p>\n'
    const r = migrate(src)
    expect(r.applicable).toBe(false)
    expect(r.code).toBe(src)
  })

  test('maps every documented plugin or explains why it cannot', () => {
    const plugins = [
      ['addSortBy', 'sortable'],
      ['addTableFilter', 'showGlobalFilter'],
      ['addColumnFilters', 'showColumnFilters'],
      ['addPagination', 'pageable'],
      ['addSelectedRows', 'showRowSelection'],
      ['addGroupBy', 'groupable'],
      ['addSubRows', 'treeData'],
      ['addColumnOrder', 'enableColumnReorder'],
    ]
    for (const [plugin, prop] of plugins) {
      const src = BASIC.replace('sort: addSortBy(),', `p: ${plugin}(),`)
        .replace('page: addPagination({ initialPageSize: 20 }),', '')
      const r = migrate(src)
      expect(r.code, `${plugin} -> ${prop}`).toContain(prop)
    }
  })

  test('plugins with no prop equivalent produce a note, not a silent drop', () => {
    for (const plugin of ['addGridLayout', 'addResizedColumns', 'addHiddenColumns', 'addExpandedRows']) {
      const src = BASIC.replace('sort: addSortBy(),', `p: ${plugin}(),`)
      const r = migrate(src)
      expect(r.notes.join(' '), plugin).toContain(plugin)
    }
  })

  test('warns on an unrecognised plugin instead of ignoring it', () => {
    const src = BASIC.replace('sort: addSortBy(),', 'p: addSomethingCustom(),')
    const r = migrate(src)
    expect(r.warnings.join(' ')).toContain('addSomethingCustom')
  })

  test('preserves a custom cell renderer as a TODO rather than dropping it', () => {
    const src = BASIC.replace(
      "table.column({ header: 'Name', accessor: 'name' }),",
      "table.column({ header: 'Name', accessor: 'name', cell: ({ value }) => value.toUpperCase() }),",
    )
    const r = migrate(src)
    expect(r.code).toContain('TODO port')
    expect(r.warnings.join(' ')).toContain('cell')
  })

  test('handles a function accessor as fieldFn', () => {
    const src = BASIC.replace(
      "table.column({ header: 'Age', accessor: 'age' }),",
      "table.column({ header: 'Age', accessor: (row) => row.age * 2 }),",
    )
    const r = migrate(src)
    expect(r.code).toContain('fieldFn: (row) => row.age * 2')
    expect(r.warnings.join(' ')).toContain('accessor')
  })

  test('translates nested column groups', () => {
    const src = BASIC.replace(
      "table.column({ header: 'Name', accessor: 'name' }),",
      "table.group({ header: 'Person', columns: [table.column({ header: 'Name', accessor: 'name' })] }),",
    )
    const r = migrate(src)
    expect(r.code).toContain("header: 'Person'")
    expect(r.code).toContain('columns: [')
    expect(r.code).toContain("field: 'name'")
  })

  test('a comma inside a string does not split a column entry', () => {
    const src = BASIC.replace(
      "table.column({ header: 'Name', accessor: 'name' }),",
      "table.column({ header: 'Last, First', accessor: 'name' }),",
    )
    const r = migrate(src)
    expect(r.code).toContain("header: 'Last, First'")
    expect(r.code).toContain("field: 'name'")
  })

  test('recognises the maintained Svelte 5 fork too', () => {
    const src = BASIC.replace(/svelte-headless-table/g, '@humanspeak/svelte-headless-table')
    const r = migrate(src)
    expect(r.applicable).toBe(true)
    expect(r.code).toContain('<SvGrid')
  })

  test('reports rather than guesses when createTable is absent', () => {
    const src = "<script>\n  import { Render } from 'svelte-headless-table';\n</script>\n<p>x</p>\n"
    const r = migrate(src)
    expect(r.applicable).toBe(false)
    expect(r.warnings.join(' ')).toContain('createTable')
  })
})
