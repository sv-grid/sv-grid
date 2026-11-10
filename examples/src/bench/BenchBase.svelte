<script lang="ts">
  /**
   * SvGrid Base in the comparison harness: a table with a column of every
   * built-in field type (base-bench.ts), mounted the way the Base demos mount
   * one (enableBase, the shared people, SvBase with editable + sortable + row
   * numbers). `mode` picks where the rows live: 'page' holds them in `data`,
   * 'server' pages them in through baseSource(..., { serverRows }) as demo
   * 723 does.
   */
  import { SvBase, enableBase, baseSource, type BaseTable } from '@svgrid/enterprise/base'
  import { usePeople } from '../shared/base-people'
  import { BASE_COLUMNS, accountRows, memorySource } from './base-bench'

  type Row = Record<string, unknown>
  type Props = {
    rows: Row[]
    mode: 'page' | 'server'
    handle: { scroller?: () => HTMLElement | null }
    /** The per-type ablation's columns (scroll-run.ts 'base.<type>'); every type when absent. */
    columns?: Array<Record<string, unknown>>
  }
  const { rows, mode, handle, columns }: Props = $props()

  enableBase()
  usePeople()

  let tables = $state.raw<BaseTable[]>([
    {
      id: 'records',
      name: 'Records',
      primaryField: 'name',
      data: mode === 'page' ? rows : [],
      ...(mode === 'server' ? { source: baseSource(memorySource(rows), { serverRows: { blockSize: 200 } }) } : {}),
      columns: (columns ?? BASE_COLUMNS) as never,
      views: [{ id: 'all', name: 'All records', type: 'grid' }],
    } as BaseTable,
    {
      id: 'accounts',
      name: 'Accounts',
      primaryField: 'name',
      data: accountRows(),
      columns: [
        { field: 'name', header: 'Account', width: 200, fieldType: 'text' },
        { field: 'tier', header: 'Tier', width: 110, fieldType: 'singleSelect', fieldProps: { options: [{ value: 'Gold' }, { value: 'Silver' }, { value: 'Bronze' }] } },
        { field: 'records', header: 'Records', width: 200, fieldType: 'link', fieldProps: { table: 'records', multiple: true, inverse: 'account' } },
      ],
      views: [{ id: 'all', name: 'All accounts', type: 'grid' }],
    } as BaseTable,
  ])

  let rootEl = $state<HTMLElement | null>(null)
  handle.scroller = () => rootEl?.querySelector<HTMLElement>('.sv-grid-container') ?? null
</script>

<div bind:this={rootEl} style="height:100%">
  <SvBase bind:tables editable sortable showRowNumbers showRowSelection={false} containerHeight="100%" />
</div>
