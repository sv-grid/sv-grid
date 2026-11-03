<script lang="ts">
  /**
   * 714. SvGrid Base: the <sv-base> web component
   * ---------------------------------------------
   * SvGrid Base as a custom element, for a page or an app with no Svelte in
   * it: React, Vue, Angular, or a plain `<script>` tag. Everything below the
   * import is plain DOM code, the same calls a non-Svelte page makes: create
   * the element, set its attributes, assign `tables`, `users` and
   * `currentUser` as properties, and listen to `tableschange`.
   *
   * Edit a cell, add a record, a field, a view or a table: every change
   * arrives as one `tableschange` event with the whole list, which is what
   * an app stores. The log names what changed. "Load the seed data" assigns
   * a fresh list, which the element loads in place of the edited one.
   *
   * The code block is what a page with no build step writes.
   */
  import { onMount } from 'svelte'
  import '@svgrid/enterprise/wc/base'
  import type { SvBaseElement, SvBaseTable } from '@svgrid/enterprise/wc/base'
  import { PEOPLE } from '../shared/base-people'

  const day = (offset: number) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const STATUS = [
    { value: 'To do', color: '#94a3b8' },
    { value: 'Doing', color: '#2d7ff9' },
    { value: 'Done', color: '#20c933' },
  ]

  /** A fresh copy each time: the element owns the list it is given. */
  function seed(): SvBaseTable[] {
    return [
      {
        id: 'wc-tasks',
        name: 'Tasks',
        primaryField: 'title',
        columns: [
          { field: 'title', header: 'Task', width: 240, fieldType: 'text' },
          { field: 'status', header: 'Status', width: 120, fieldType: 'singleSelect', fieldProps: { options: STATUS } },
          { field: 'owner', header: 'Owner', width: 150, fieldType: 'user' },
          { field: 'due', header: 'Due', width: 160, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
          { field: 'milestone', header: 'Milestone', width: 170, fieldType: 'link', fieldProps: { table: 'wc-milestones', multiple: false, inverse: 'tasks' } },
        ],
        data: [
          { id: 't1', title: 'Draft the launch post', status: 'Doing', owner: 'u1', due: day(2), milestone: ['m1'] },
          { id: 't2', title: 'Record the product tour', status: 'To do', owner: 'u3', due: day(5), milestone: ['m1'] },
          { id: 't3', title: 'Pricing page review', status: 'Done', owner: 'u2', due: day(-1), milestone: ['m2'] },
          { id: 't4', title: 'Email the beta list', status: 'To do', owner: 'u4', due: day(8), milestone: ['m2'] },
        ],
        views: [
          { id: 'all', name: 'All tasks', type: 'grid' },
          { id: 'board', name: 'By status', type: 'kanban', stackBy: 'status' },
        ],
      },
      {
        id: 'wc-milestones',
        name: 'Milestones',
        primaryField: 'name',
        columns: [
          { field: 'name', header: 'Milestone', width: 200, fieldType: 'text' },
          { field: 'date', header: 'Date', width: 130, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
          { field: 'tasks', header: 'Tasks', width: 320, fieldType: 'link', fieldProps: { table: 'wc-tasks', multiple: true, inverse: 'milestone' } },
        ],
        data: [
          { id: 'm1', name: 'Public beta', date: day(7), tasks: ['t1', 't2'] },
          { id: 'm2', name: 'General availability', date: day(21), tasks: ['t3', 't4'] },
        ],
      },
    ]
  }

  // What each table looked like at the last event, to say what changed.
  type Snapshot = { name: string; fields: string; views: string; data: string; records: number }
  const snap = (t: SvBaseTable): Snapshot => ({
    name: t.name,
    fields: JSON.stringify(t.columns),
    views: JSON.stringify(t.views ?? []),
    data: JSON.stringify(t.data),
    records: t.data.length,
  })
  let seen = new Map<string, Snapshot>()
  const remember = (list: SvBaseTable[]) => (seen = new Map(list.map((t) => [t.id, snap(t)])))

  function describe(list: SvBaseTable[]): string {
    const parts: string[] = []
    for (const t of list) {
      const was = seen.get(t.id)
      const now = snap(t)
      if (!was) { parts.push(`table "${t.name}" added`); continue }
      if (was.name !== now.name) parts.push(`"${was.name}" renamed to "${now.name}"`)
      if (was.fields !== now.fields) parts.push(`${t.name}: fields`)
      if (was.views !== now.views) parts.push(`${t.name}: views`)
      if (was.records !== now.records) parts.push(`${t.name}: ${now.records} records`)
      else if (was.data !== now.data) parts.push(`${t.name}: a record changed`)
    }
    for (const [id, was] of seen) if (!list.some((t) => t.id === id)) parts.push(`table "${was.name}" deleted`)
    remember(list)
    return parts.join(', ') || 'same content'
  }

  type Entry = { id: number; time: string; event: string; text: string }
  let log = $state<Entry[]>([])
  let n = 0
  function note(event: string, text: string) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    log = [{ id: ++n, time, event, text }, ...log].slice(0, 12)
  }

  let host: HTMLDivElement
  let base: SvBaseElement | null = null

  function load() {
    const tables = seed()
    remember(tables)
    if (base) base.tables = tables
    note('tables', 'assigned a fresh list')
  }

  onMount(() => {
    // Plain DOM from here on.
    const el = document.createElement('sv-base') as SvBaseElement
    for (const name of ['editable', 'sortable', 'show-row-numbers', 'column-adder', 'field-menu', 'expand-rows']) el.setAttribute(name, '')
    el.setAttribute('height', '440')
    el.users = PEOPLE
    el.currentUser = PEOPLE[0]!
    el.addEventListener('tableschange', (e) => note('tableschange', describe((e as CustomEvent<SvBaseTable[]>).detail)))
    el.addEventListener('ready', () => note('ready', 'a table\'s grid is up; el.api is its api'))
    base = el
    load()
    host.append(el)
    return () => {
      el.remove()
      base = null
    }
  })

  const SNIPPET = `<script type="module" src="https://cdn.jsdelivr.net/npm/@svgrid/enterprise/dist/wc/sv-base-element.js"><\/script>

<sv-base id="base" height="440" editable sortable show-row-numbers
         column-adder field-menu expand-rows></sv-base>

<script type="module">
  const base = document.getElementById('base')
  base.users = [{ id: 'u1', name: 'Ana Ruiz' }, { id: 'u2', name: 'Ben Okafor' }]
  base.currentUser = base.users[0]
  base.tables = [
    {
      id: 'tasks', name: 'Tasks', primaryField: 'title',
      columns: [
        { field: 'title', header: 'Task', fieldType: 'text' },
        { field: 'owner', header: 'Owner', fieldType: 'user' },
        { field: 'due', header: 'Due', fieldType: 'date' },
      ],
      data: [{ id: 't1', title: 'Draft the launch post', owner: 'u1', due: '2026-11-04' }],
    },
  ]
  // Every change, with the whole list: store it.
  base.addEventListener('tableschange', (e) => {
    localStorage.setItem('base', JSON.stringify(e.detail))
  })
<\/script>`
</script>

<section class="wcb-demo">
  <div class="wcb-host" bind:this={host}></div>
  <div class="wcb-panels">
    <div class="wcb-panel">
      <div class="wcb-head">
        <h3>Events</h3>
        <button type="button" class="wcb-btn" onclick={load}>Load the seed data</button>
      </div>
      {#if log.length}
        <ol class="wcb-log">
          {#each log as entry (entry.id)}
            <li>
              <span class="wcb-time">{entry.time}</span>
              <code>{entry.event}</code>
              <span>{entry.text}</span>
            </li>
          {/each}
        </ol>
      {:else}
        <p class="wcb-empty">Edit a cell to see a tableschange event.</p>
      {/if}
    </div>
    <div class="wcb-panel">
      <div class="wcb-head"><h3>The same page in plain HTML</h3></div>
      <pre class="wcb-code">{SNIPPET}</pre>
    </div>
  </div>
</section>

<style>
  .wcb-demo { display: flex; flex-direction: column; gap: 12px; flex: 1; min-height: 480px; }
  .wcb-host { min-width: 0; }
  .wcb-panels { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: 12px; }
  .wcb-panel {
    display: flex; flex-direction: column; gap: 8px; min-width: 0; padding: 12px;
    color: var(--sg-fg); background: var(--sg-bg); border: 1px solid var(--sg-border); border-radius: var(--sg-radius, 6px);
  }
  .wcb-head { display: flex; align-items: center; gap: 8px; }
  .wcb-head h3 { margin: 0; font-size: 14px; }
  .wcb-btn {
    margin-inline-start: auto; height: 28px; padding: 0 10px; font: inherit; font-size: 12px; cursor: pointer;
    color: var(--sg-fg); background: var(--sg-bg); border: 1px solid var(--sg-border); border-radius: var(--sg-radius, 6px);
  }
  .wcb-btn:hover { border-color: var(--sg-muted); }
  .wcb-btn:focus-visible { outline: 2px solid var(--sg-focus-ring); outline-offset: 1px; }
  .wcb-log { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0; list-style: none; max-height: 260px; overflow: auto; font-size: 12px; }
  .wcb-log li { display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; }
  .wcb-log code { font-size: 11px; padding: 0 4px; border-radius: 4px; background: color-mix(in srgb, var(--sg-fg) 6%, var(--sg-bg)); }
  .wcb-time { color: var(--sg-muted); font-variant-numeric: tabular-nums; }
  .wcb-empty { margin: 0; font-size: 12px; color: var(--sg-muted); }
  .wcb-code {
    margin: 0; padding: 10px; max-height: 260px; overflow: auto; font-size: 11px; line-height: 1.5; white-space: pre;
    color: var(--sg-fg); background: color-mix(in srgb, var(--sg-fg) 4%, var(--sg-bg)); border-radius: var(--sg-radius, 6px);
  }
  @media (max-width: 760px) {
    .wcb-panels { grid-template-columns: minmax(0, 1fr); }
  }
</style>
