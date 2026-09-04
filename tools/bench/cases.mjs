/**
 * The benchmark cases.
 *
 * Chosen to cover exactly the operations docs/help/benchmarks.md quotes, so the
 * published table and this harness describe the same work. Each case declares:
 *
 *   time    - wall-clock, median of N runs after a warm-up. Reported, never gated.
 *   counts  - deterministic work counters. Gated in CI (see counters.mjs).
 *   heap    - retained bytes after a full pipeline build. Gated with a wide band.
 *
 * A case with no `counts` and no `heap` contributes nothing to `--check`.
 */
import { makeRows, makeColumns } from './data.mjs'
import { instrumentStage, countStageRuns, newCounters } from './counters.mjs'

const ROWS = 100_000
const EXPORT_ROWS = 10_000

/** Built once and shared: dataset construction is not what we are measuring. */
let cachedRows = null
let cachedExportRows = null
const rows100k = () => (cachedRows ??= makeRows(ROWS))
const rows10k = () => (cachedExportRows ??= makeRows(EXPORT_ROWS, 999))

export function buildCases(api) {
  const {
    createSvGridCore, createCoreRowModel, createSortedRowModel,
    createFilteredRowModel, createGroupedRowModel,
    tableFeatures, rowSortingFeature, columnFilteringFeature,
    columnGroupingFeature, rowSelectionFeature,
    projectGridRows, serializeDelimited, compileExcelFilter,
  } = api

  const columns = makeColumns()

  /**
   * A table wired for one pipeline, with optional per-stage instrumentation.
   *
   * Only stages marked `instrument: true` get their rows proxied. Wrapping every
   * stage double-counts: stage N returns the proxies it was handed, stage N+1
   * wraps those again, and a single call downstream is then tallied against both.
   * `runs` is counted on every stage - it costs nothing and the selection case
   * needs it from stages it does not otherwise instrument.
   */
  function table({ stages, state, features, counters, data = rows100k() }) {
    const _rowModels = {}
    for (const [slot, { factory, label, instrument }] of Object.entries(stages)) {
      let f = factory
      if (counters) {
        if (instrument) f = instrumentStage(f, counters, label)
        f = countStageRuns(f, counters, label)
      }
      _rowModels[slot] = f
    }
    return createSvGridCore({
      _features: features,
      _rowModels,
      data,
      columns,
      state,
      onSortingChange: () => {},
      onColumnFiltersChange: () => {},
      onGroupingChange: () => {},
      onRowSelectionChange: () => {},
    })
  }

  const coreStage = { factory: createCoreRowModel(), label: 'core' }
  const sortStages = { coreRowModel: coreStage, sortedRowModel: { factory: createSortedRowModel(), label: 'sort', instrument: true } }
  const filterStages = { coreRowModel: coreStage, filteredRowModel: { factory: createFilteredRowModel(), label: 'filter', instrument: true } }

  return [
    {
      id: 'rowmodel-build',
      label: 'Build row model, 100k x 9, no stages',
      time() {
        const t = table({ stages: { coreRowModel: { factory: createCoreRowModel(), label: 'core' } }, state: {}, features: tableFeatures({}) })
        return () => {
          t.store.setState((p) => ({ ...p, sorting: [] })) // bust the memo
          return t.getRowModel().rows.length
        }
      },
      heap() {
        const t = table({ stages: { coreRowModel: { factory: createCoreRowModel(), label: 'core' } }, state: {}, features: tableFeatures({}) })
        return () => t.getRowModel().rows.length
      },
    },

    {
      id: 'sort-1col',
      label: 'Sort 100k rows by 1 column',
      time() {
        let desc = false
        const t = table({ stages: sortStages, state: { sorting: [{ id: 'amount', desc: false }] }, features: tableFeatures({ rowSortingFeature }) })
        return () => {
          desc = !desc
          t.store.setState((p) => ({ ...p, sorting: [{ id: 'amount', desc }] }))
          return t.getRowModel().rows.length
        }
      },
      counts() {
        const counters = newCounters()
        const t = table({ stages: sortStages, state: { sorting: [{ id: 'amount', desc: false }] }, features: tableFeatures({ rowSortingFeature }), counters })
        t.getRowModel()
        return counters
      },
      // One clause resolved once is the target. Anything proportional to
      // n log n means the lookup is still inside the comparator.
      requires: ['sort.runs'],
      gate: { 'sort.getAllColumns': { max: 8 } },
    },

    {
      id: 'sort-3col',
      label: 'Sort 100k rows by 3 columns',
      time() {
        let desc = false
        const clauses = (d) => [{ id: 'region', desc: d }, { id: 'status', desc: false }, { id: 'amount', desc: true }]
        const t = table({ stages: sortStages, state: { sorting: clauses(false) }, features: tableFeatures({ rowSortingFeature }) })
        return () => {
          desc = !desc
          t.store.setState((p) => ({ ...p, sorting: clauses(desc) }))
          return t.getRowModel().rows.length
        }
      },
      counts() {
        const counters = newCounters()
        const t = table({
          stages: sortStages,
          state: { sorting: [{ id: 'region', desc: false }, { id: 'status', desc: false }, { id: 'amount', desc: true }] },
          features: tableFeatures({ rowSortingFeature }),
          counters,
        })
        t.getRowModel()
        return counters
      },
      requires: ['sort.runs'],
      gate: { 'sort.getAllColumns': { max: 24 } },
    },

    {
      // Added after the browser comparison showed text sorting was the slowest
      // operation for BOTH grids - and that this suite had never measured it.
      // The other sort cases use `amount` (number) and `orderedAt` (date),
      // which take the numeric comparator; a column with no editorType takes
      // `sortFns.auto`, which collates. Very different cost.
      id: 'sort-text',
      label: 'Sort 100k rows by a text column (collated)',
      time() {
        let desc = false
        const t = table({ stages: sortStages, state: { sorting: [{ id: 'name', desc: false }] }, features: tableFeatures({ rowSortingFeature }) })
        return () => {
          desc = !desc
          t.store.setState((p) => ({ ...p, sorting: [{ id: 'name', desc }] }))
          return t.getRowModel().rows.length
        }
      },
    },

    {
      id: 'sort-date',
      label: 'Sort 100k rows by a date column',
      time() {
        let desc = false
        const t = table({ stages: sortStages, state: { sorting: [{ id: 'orderedAt', desc: false }] }, features: tableFeatures({ rowSortingFeature }) })
        return () => {
          desc = !desc
          t.store.setState((p) => ({ ...p, sorting: [{ id: 'orderedAt', desc }] }))
          return t.getRowModel().rows.length
        }
      },
    },

    {
      id: 'filter-1op',
      label: 'Filter 100k rows, 1 operator',
      time() {
        let i = 0
        const t = table({ stages: filterStages, state: { columnFilters: [{ id: 'region', value: 'EMEA' }] }, features: tableFeatures({ columnFilteringFeature }) })
        const values = ['EMEA', 'APAC', 'AMER']
        return () => {
          t.store.setState((p) => ({ ...p, columnFilters: [{ id: 'region', value: values[i++ % values.length] }] }))
          return t.getRowModel().rows.length
        }
      },
      counts() {
        const counters = newCounters()
        const t = table({ stages: filterStages, state: { columnFilters: [{ id: 'region', value: 'EMEA' }] }, features: tableFeatures({ columnFilteringFeature }), counters })
        t.getRowModel()
        return counters
      },
      // Materialising a row's whole Cell[] to read one field defeats the lazy
      // cell cache. The correct count is zero.
      requires: ['filter.runs'],
      gate: { 'filter.getAllCells': { max: 0 } },
    },

    {
      id: 'filter-5op',
      label: 'Filter 100k rows, 5 operators ANDed',
      time() {
        let i = 0
        const build = (n) => [
          { id: 'region', value: ['EMEA', 'APAC', 'AMER'][n % 3] },
          { id: 'status', value: 'o' },
          { id: 'name', value: 'a' },
          { id: 'note', value: 'e' },
          { id: 'active', value: 'true' },
        ]
        const t = table({ stages: filterStages, state: { columnFilters: build(0) }, features: tableFeatures({ columnFilteringFeature }) })
        return () => {
          t.store.setState((p) => ({ ...p, columnFilters: build(++i) }))
          return t.getRowModel().rows.length
        }
      },
      counts() {
        const counters = newCounters()
        const t = table({
          stages: filterStages,
          state: {
            columnFilters: [
              { id: 'region', value: 'EMEA' }, { id: 'status', value: 'o' },
              { id: 'name', value: 'a' }, { id: 'note', value: 'e' }, { id: 'active', value: 'true' },
            ],
          },
          features: tableFeatures({ columnFilteringFeature }),
          counters,
        })
        t.getRowModel()
        return counters
      },
      requires: ['filter.runs'],
      gate: { 'filter.getAllCells': { max: 0 } },
    },

    {
      id: 'group-2col-3agg',
      label: 'Group 100k rows by 2 columns, 3 aggregators',
      time() {
        const cols = makeColumns().map((c) =>
          c.field === 'amount' ? { ...c, aggregate: 'sum' } :
          c.field === 'qty' ? { ...c, aggregate: 'avg' } :
          c.field === 'id' ? { ...c, aggregate: 'count' } : c,
        )
        let i = 0
        const t = createSvGridCore({
          _features: tableFeatures({ columnGroupingFeature }),
          _rowModels: { coreRowModel: createCoreRowModel(), groupedRowModel: createGroupedRowModel() },
          data: rows100k(),
          columns: cols,
          state: { grouping: ['region', 'status'] },
          onGroupingChange: () => {},
        })
        return () => {
          // Alternate the grouping order so the memo cannot serve a cached model.
          t.store.setState((p) => ({ ...p, grouping: ++i % 2 ? ['status', 'region'] : ['region', 'status'] }))
          return t.getRowModel().rows.length
        }
      },
    },

    {
      id: 'selection-toggle',
      label: 'Toggle one row checkbox on a filtered + sorted 100k grid',
      // The headline of this case is not its time, it is `runs`. A selection
      // change must not re-run filtering or sorting; `rowSelection` sitting in
      // the row-model cache key means it currently does.
      time() {
        const t = table({
          stages: { ...filterStages, sortedRowModel: sortStages.sortedRowModel },
          state: { columnFilters: [{ id: 'region', value: 'EMEA' }], sorting: [{ id: 'amount', desc: false }], rowSelection: {} },
          features: tableFeatures({ columnFilteringFeature, rowSortingFeature, rowSelectionFeature }),
        })
        t.getRowModel()
        let i = 0
        return () => {
          t.store.setState((p) => ({ ...p, rowSelection: { [String(++i)]: true } }))
          return t.getRowModel().rows.length
        }
      },
      counts() {
        const counters = newCounters()
        const t = table({
          stages: { ...filterStages, sortedRowModel: sortStages.sortedRowModel },
          state: { columnFilters: [{ id: 'region', value: 'EMEA' }], sorting: [{ id: 'amount', desc: false }], rowSelection: {} },
          features: tableFeatures({ columnFilteringFeature, rowSortingFeature, rowSelectionFeature }),
          counters,
        })
        t.getRowModel() // first build - expected
        const before = { filter: counters['filter.runs'] ?? 0, sort: counters['sort.runs'] ?? 0 }
        for (let i = 1; i <= 5; i++) {
          t.store.setState((p) => ({ ...p, rowSelection: { [String(i)]: true } }))
          t.getRowModel()
        }
        return {
          // Reported so `requires` can prove the pipeline ran at all. Without
          // it, a stage that never executed would show zero re-runs and pass.
          'selection.initialRuns': before.filter + before.sort,
          'selection.filterReruns': (counters['filter.runs'] ?? 0) - before.filter,
          'selection.sortReruns': (counters['sort.runs'] ?? 0) - before.sort,
        }
      },
      requires: ['selection.initialRuns'],
      gate: {
        'selection.filterReruns': { max: 0 },
        'selection.sortReruns': { max: 0 },
      },
    },

    {
      // The filter cases above drive `createFilteredRowModel`, whose default
      // match is a plain `includesString`. That is NOT what <SvGrid> runs: the
      // menu and filter-row surfaces compile through `compileExcelFilter`,
      // which folds every value with `normalizeForFilter` (NFD + diacritic
      // strip + lowercase). A browser profile found that folding was the single
      // most expensive function in a filter, and this suite had no case that
      // touched it - so a 30x difference between the engine number and the real
      // one went unnoticed. This measures the path the grid actually takes.
      id: 'filter-excel-contains',
      label: 'Filter 100k rows via the compiled Excel filter (contains)',
      time() {
        const data = rows100k()
        const needles = ['EMEA', 'APAC', 'AMER']
        let i = 0
        return () => {
          const compiled = compileExcelFilter({ id: 'region', operator: 'contains', value: needles[i++ % needles.length] })
          let kept = 0
          for (let r = 0; r < data.length; r++) if (compiled(data[r].region)) kept++
          return kept
        }
      },
    },

    {
      id: 'filter-excel-accented',
      label: 'Filter 100k accented rows via the compiled Excel filter',
      time() {
        // Every value non-ASCII, so this takes the slow fold path on purpose:
        // it is the case the ASCII fast path must NOT have broken, and the one
        // that shows what folding actually costs when it is needed.
        const data = rows100k().map((r) => ({ region: 'café-' + r.region }))
        const needles = ['café-EMEA', 'café-APAC']
        let i = 0
        return () => {
          const compiled = compileExcelFilter({ id: 'region', operator: 'contains', value: needles[i++ % needles.length] })
          let kept = 0
          for (let r = 0; r < data.length; r++) if (compiled(data[r].region)) kept++
          return kept
        }
      },
    },

    {
      id: 'csv-export',
      label: 'Export CSV, 10k rows x 9 cols',
      async time() {
        const exportCols = makeColumns().map((c) => ({ field: c.field, header: c.header }))
        return async () => {
          const { records, fields } = projectGridRows(rows10k(), exportCols)
          const text = await serializeDelimited(records, fields, { chunkRows: 1e9 })
          return text.length
        }
      },
    },
  ]
}
