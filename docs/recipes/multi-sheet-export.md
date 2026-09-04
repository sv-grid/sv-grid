---
noindex: true
---

# Multi-sheet xlsx export

> Live in [demo 59-export-multi-sheet](https://svgrid.com/demos/59-export-multi-sheet/).

<div data-docs-demo="59-export-multi-sheet" data-height="480"></div>


## When

One workbook, multiple tabs - one per group / region / period.

## How

Key API surface:

- `api.exportData({ format: 'xlsx', sheets: [{ label, rows }, ...] })`

See the demo source for the full implementation; this recipe pins the
pattern + the surface so you can copy-paste it confidently. The doc
page that explains the underlying feature in depth is linked from the
[recipes index](./index.md).

## More examples

### Workbook - multi-sheet + formulas

A real spreadsheet: A/B/C columns + many rows you can grow on demand, cross-sheet formulas (=SUM, =VLOOKUP, nested IF) recalculating live, cell + conditional formatting, validation dropdowns, an inline chart, a calendar/scheduler sheet, open .xlsx/.csv, and export every sheet to one multi-tab .xlsx.

<div data-docs-demo="119-workbook-multi-sheet" data-height="460"></div>

## Exporting each group separately

A multi-sheet workbook is one export per slice of the data. Filtering the
array and exporting each result is the portable version - it works with the CSV
exporter in the free package, not just the XLSX one.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = { id: number; name: string; department: string; salary: number }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', salary: 142000 },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', salary: 168000 },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    salary: 155000 },
    { id: 4, name: 'Barbara Liskov', department: 'Platform',    salary: 172000 },
  ]

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 190 },
    { field: 'department', header: 'Department', width: 160 },
    { field: 'salary',     header: 'Salary',     width: 140,
      format: { type: 'currency', currency: 'USD' } },
  ]

  let api = $state<SvGridApi<{}, Person> | null>(null)
  let shown = $state<Person[]>(people)

  const departments = [...new Set(people.map((p) => p.department))]

  // One file per department: narrow the data, let the export follow the view.
  async function exportEach() {
    for (const dept of departments) {
      shown = people.filter((p) => p.department === dept)
      await Promise.resolve()
      await api?.exportCsv({ filename: dept.toLowerCase() })
    }
    shown = people
  }
</script>

<button type="button" onclick={exportEach}>Export one CSV per department</button>

<SvGrid data={shown} {columns} onApiReady={(next) => (api = next)} />
```

## See also

- [Demo 59-export-multi-sheet source](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/59-export-multi-sheet.svelte)
- [Demo 59-export-multi-sheet prompt sidecar](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/prompts/59-export-multi-sheet.md) - drop into an LLM context window
- [Recipes index](./index.md)
