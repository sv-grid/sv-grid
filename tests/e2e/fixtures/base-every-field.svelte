<script lang="ts">
  /**
   * A base with a field of every type, for the specs that go through them one by
   * one (base-values.spec.ts). Not a demo: the spec loads it into a page itself.
   * The stored records are read back through `window.__base`, so a test can say
   * what a cell holds as well as what it shows.
   */
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, enableBase, setCurrentUser, setFieldUsers, type BaseTable } from '@svgrid/enterprise/base'

  let { toaster = false, grouped = false }: { toaster?: boolean; grouped?: boolean } = $props()

  enableBase()
  const people = [
    { id: 'u1', name: 'Ana Ruiz', email: 'ana@example.com' },
    { id: 'u2', name: 'Ben Okafor', email: 'ben@example.com' },
    { id: 'u3', name: 'Cleo Park', email: 'cleo@example.com' },
    // The same name as u2, on another person: only the stored id tells them apart.
    { id: 'u4', name: 'Ben Okafor', email: 'ben.o@example.com' },
    { id: 'u5', name: 'Chen, Maya', email: 'maya@example.com' },
  ]
  setFieldUsers(people)
  setCurrentUser(people[0]!)

  const steps = (...items: Array<[string, boolean]>) => items.map(([text, done], i) => ({ id: `s${i}`, text, done }))
  const file = (name: string) => ({ id: `f-${name}`, name, url: `https://files.example.com/${name}`, type: 'application/pdf', size: 1200 })

  const first = {
    id: 'r1', name: 'Alpha 1', notes: 'line one\nline two', rich: '<p><strong>Bold</strong> words</p>', files: [file('brief.pdf')], done: true,
    stage: 'p1', tags: ['t1', 't3'], owner: 'u4', team: ['u2', 'u5'], due: '2026-10-09', at: '2026-10-09T12:30:45.000Z', phone: '+1 415 555 0123',
    email: 'ann@example.com', site: 'https://example.com/a', code: { text: 'ABC-123', type: 'code128' }, todo: steps(['Draft', true], ['Review', false]),
    tint: '#336699', qty: 3, ratio: 1.25, price: 1234.567, share: 0.125, oldPrice: 10.5, oldShare: 0.5, points: 40, spent: 5415, starts: '14:30', stars: 4,
    votes: ['u2', 'u3'], trend: [3, 7, 4, 9], account: ['a1'], ai: 'Written once',
  }
  const rest = [2, 3, 4, 5, 6, 7, 8].map((n) => ({ id: `r${n}`, name: `Row ${n}`, keep: `keep ${n}` }))

  let tables = $state.raw<BaseTable[]>([
    {
      id: 'items',
      name: 'Items',
      primaryField: 'name',
      data: [{ ...first, keep: 'keep 1' }, ...rest],
      columns: [
        { field: 'name', header: 'Name', width: 140, fieldType: 'text' },
        { field: 'keep', header: 'Keep', width: 90, fieldType: 'text' },
        { field: 'notes', header: 'Notes', width: 120, fieldType: 'longText' },
        { field: 'rich', header: 'Rich', width: 120, fieldType: 'richText' },
        { field: 'files', header: 'Files', width: 120, fieldType: 'attachment' },
        { field: 'done', header: 'Done', width: 80, fieldType: 'checkbox' },
        { field: 'stage', header: 'Stage', width: 110, fieldType: 'singleSelect', fieldProps: { options: [{ value: 'p1', label: 'P1' }, { value: 'p2', label: 'P2' }] } },
        { field: 'tags', header: 'Tags', width: 140, fieldType: 'multiSelect', fieldProps: { options: [{ value: 't1', label: 'Red, dark' }, { value: 't2', label: 'Blue' }, { value: 't3', label: 'Green' }] } },
        { field: 'owner', header: 'Owner', width: 130, fieldType: 'user' },
        { field: 'team', header: 'Team', width: 160, fieldType: 'user', fieldProps: { multiple: true } },
        { field: 'due', header: 'Due', width: 120, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
        { field: 'at', header: 'At', width: 170, fieldType: 'date', fieldProps: { dateFormat: 'iso', time: true, timeFormat: '24hour' } },
        { field: 'phone', header: 'Phone', width: 130, fieldType: 'phone' },
        { field: 'email', header: 'Email', width: 150, fieldType: 'email' },
        { field: 'site', header: 'Site', width: 150, fieldType: 'url' },
        { field: 'code', header: 'Code', width: 130, fieldType: 'barcode' },
        { field: 'act', header: 'Act', width: 90, fieldType: 'button', fieldProps: { label: 'Go', url: 'https://example.com/go/{Name}' } },
        { field: 'todo', header: 'Todo', width: 130, fieldType: 'checklist' },
        { field: 'tint', header: 'Tint', width: 120, fieldType: 'color' },
        { field: 'qty', header: 'Qty', width: 80, fieldType: 'number', fieldProps: { format: 'integer', allowNegative: false } },
        { field: 'ratio', header: 'Ratio', width: 90, fieldType: 'number', fieldProps: { format: 'decimal', precision: 1 } },
        { field: 'price', header: 'Price', width: 110, fieldType: 'number', fieldProps: { format: 'currency', symbol: '$', precision: 2 } },
        { field: 'share', header: 'Share', width: 90, fieldType: 'number', fieldProps: { format: 'percent', precision: 0 } },
        { field: 'oldPrice', header: 'Old price', width: 100, fieldType: 'currency' },
        { field: 'oldShare', header: 'Old share', width: 100, fieldType: 'percent' },
        { field: 'points', header: 'Points', width: 90, fieldType: 'number', fieldProps: { format: 'percent', points: true, precision: 0 } },
        { field: 'spent', header: 'Spent', width: 100, fieldType: 'duration', fieldProps: { durationFormat: 'h:mm' } },
        { field: 'starts', header: 'Starts', width: 100, fieldType: 'timeOfDay', fieldProps: { timeFormat: '12hour' } },
        { field: 'stars', header: 'Stars', width: 120, fieldType: 'rating', fieldProps: { max: 5 } },
        { field: 'votes', header: 'Votes', width: 90, fieldType: 'vote' },
        { field: 'trend', header: 'Trend', width: 130, fieldType: 'sparkline' },
        { field: 'account', header: 'Account', width: 150, fieldType: 'link', fieldProps: { table: 'accounts', inverse: 'items' } },
        { field: 'city', header: 'City', width: 110, fieldType: 'lookup', fieldProps: { linkField: 'account', field: 'city' } },
        { field: 'ai', header: 'Ai', width: 120, fieldType: 'ai', fieldProps: { prompt: 'Sum up {Name}' } },
        { field: 'calc', header: 'Calc', width: 100, fieldType: 'formula', fieldProps: { formula: '{Qty} * 2', result: 'number', precision: 0 } },
        { field: 'made', header: 'Made', width: 170, fieldType: 'createdTime' },
        { field: 'changed', header: 'Changed', width: 170, fieldType: 'lastModifiedTime' },
        { field: 'maker', header: 'Maker', width: 130, fieldType: 'createdBy' },
        { field: 'changer', header: 'Changer', width: 130, fieldType: 'lastModifiedBy' },
        { field: 'serial', header: 'Serial', width: 80, fieldType: 'autoNumber' },
      ],
      views: [
        grouped
          ? { id: 'by-stage', name: 'By stage', type: 'grid', state: { grouping: ['keep'] } }
          : { id: 'all', name: 'All items', type: 'grid', state: {} },
      ],
      props: { rowAdder: { label: 'Add item' } },
    },
    {
      id: 'accounts',
      name: 'Accounts',
      primaryField: 'name',
      data: [
        { id: 'a1', name: 'Contoso', city: 'Oslo', items: ['r1'] },
        { id: 'a2', name: 'Acme, Inc.', city: 'Lima', items: [] },
        { id: 'a3', name: 'Contoso', city: 'Bern', items: [] },
      ],
      columns: [
        { field: 'name', header: 'Name', width: 180, fieldType: 'text' },
        { field: 'city', header: 'City', width: 120, fieldType: 'text' },
        { field: 'items', header: 'Items', width: 180, fieldType: 'link', fieldProps: { table: 'items', inverse: 'account' } },
        { field: 'count', header: 'Count', width: 90, fieldType: 'count', fieldProps: { linkField: 'items' } },
        { field: 'total', header: 'Total', width: 120, fieldType: 'rollup', fieldProps: { linkField: 'items', field: 'price', aggregation: 'SUM' } },
      ],
      views: [{ id: 'accounts-all', name: 'All accounts', type: 'grid', state: {} }],
    },
  ])

  // The spec reads what the base stores, not only what the page shows.
  ;(window as unknown as Record<string, unknown>).__base = {
    rows: (table = 'items') => JSON.parse(JSON.stringify(tables.find((t) => t.id === table)?.data ?? [])),
  }
</script>

<div style="position: fixed; inset: 0; display: flex; flex-direction: column;">
  <SvBase
    bind:tables
    editable
    sortable
    showRowNumbers
    expandRows
    rowNumberWidth={64}
    showRowSelection={false}
    rowHeight={36}
    containerHeight="100%"
    columnAdder
    fieldMenu
  />
  {#if toaster}<SvToaster />{/if}
</div>
