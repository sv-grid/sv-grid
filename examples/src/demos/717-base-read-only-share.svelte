<script lang="ts">
  /**
   * 717. SvGrid Base: a read-only share
   * -----------------------------------
   * The same tables twice: as the team edits them, and as a client sees them
   * through a share link. `readOnly` turns every way to change the base off:
   * cells, the record view, card drags, calendar drags, the record and field
   * menus, "+ Add", the tab bar's table menu, import, trash, undo and the
   * comment box. A form view is not shared.
   *
   * The client can still switch tables and views, search, filter, sort,
   * group and open records. What they change in a view stays in their page;
   * the app's `onTablesChange` never hears of it.
   *
   * Comments are kept by table id and record id, not by base, so a comment
   * the team writes shows in the client's link too (read, with no box to
   * answer). An app that saves comments hands its store to
   * `setRecordComments`, and both read from that.
   *
   * `readOnly={{ hideFields: ['budget'] }}` leaves Budget out, and with it
   * the fields that would show it: the rollup of it on Clients and the
   * formula that reads it. Hiding is for display; a share of something
   * secret is a copy the server builds without it.
   */
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, enableBase, type BaseTable } from '@svgrid/enterprise/base'
  import { usePeople } from '../shared/base-people'

  enableBase()
  usePeople()

  const STATUS = [
    { value: 'Planned', color: '#94a3b8' },
    { value: 'In progress', color: '#2d7ff9' },
    { value: 'Review', color: '#ff9f0a' },
    { value: 'Done', color: '#20c933' },
  ]
  const PROJECTS: Array<[string, string, string, string, number, string, string]> = [
    ['Spring campaign site', 'c1', 'In progress', 'u1', 18000, '2026-11-04', '2026-11-21'],
    ['Product photo shoot', 'c1', 'Planned', 'u3', 6500, '2026-11-12', '2026-11-14'],
    ['Checkout redesign', 'c2', 'Review', 'u2', 24000, '2026-10-27', '2026-11-10'],
    ['Loyalty app onboarding', 'c2', 'In progress', 'u5', 14500, '2026-11-02', '2026-11-28'],
    ['Annual report layout', 'c3', 'Done', 'u6', 9000, '2026-10-06', '2026-10-31'],
    ['Brand guidelines refresh', 'c3', 'Planned', 'u4', 11000, '2026-11-17', '2026-12-05'],
  ]
  const projects = PROJECTS.map(([name, client, status, lead, budget, start, end], i) => ({ id: `pr${i + 1}`, name, client: [client], status, lead, budget, start, end }))
  const clients = [
    { id: 'c1', name: 'Northwind Outdoors', contact: 'Ana Ruiz' },
    { id: 'c2', name: 'Fabrikam Retail', contact: 'Ben Okafor' },
    { id: 'c3', name: 'Litware Foundation', contact: 'Farah Haddad' },
  ].map((c) => ({ ...c, projects: projects.filter((p) => p.client[0] === c.id).map((p) => p.id) }))

  // The team's tables. Edit them, then look at the shared link: it shows the change.
  let tables = $state.raw<BaseTable[]>([
    {
      id: 'share-projects',
      name: 'Projects',
      primaryField: 'name',
      data: projects,
      columns: [
        { field: 'name', header: 'Project', width: 230, fieldType: 'text' },
        { field: 'client', header: 'Client', width: 180, fieldType: 'link', fieldProps: { table: 'share-clients', multiple: false, inverse: 'projects' } },
        { field: 'status', header: 'Status', width: 130, fieldType: 'singleSelect', fieldProps: { options: STATUS } },
        { field: 'lead', header: 'Lead', width: 150, fieldType: 'user' },
        { field: 'start', header: 'Start', width: 120, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
        { field: 'end', header: 'Due', width: 120, fieldType: 'date', fieldProps: { dateFormat: 'friendly' } },
        { field: 'budget', header: 'Budget', width: 120, fieldType: 'currency', fieldProps: { precision: 0 } },
        { field: 'weekly', header: 'Per week', width: 120, fieldType: 'formula', fieldProps: { formula: 'ROUND({Budget} / 4, 0)' } },
      ],
      views: [
        { id: 'all', name: 'All projects', type: 'grid', color: { mode: 'field', field: 'status' } },
        { id: 'board', name: 'By status', type: 'kanban', stackBy: 'status' },
        { id: 'calendar', name: 'Schedule', type: 'calendar', dateField: 'start', endField: 'end', color: { mode: 'field', field: 'status' } },
        { id: 'brief', name: 'New project brief', type: 'form' },
      ],
    },
    {
      id: 'share-clients',
      name: 'Clients',
      primaryField: 'name',
      data: clients,
      columns: [
        { field: 'name', header: 'Client', width: 210, fieldType: 'text' },
        { field: 'contact', header: 'Contact', width: 160, fieldType: 'text' },
        { field: 'projects', header: 'Projects', width: 320, fieldType: 'link', fieldProps: { table: 'share-projects', multiple: true, inverse: 'client' } },
        { field: 'total', header: 'Total budget', width: 140, fieldType: 'rollup', fieldProps: { linkField: 'projects', field: 'budget', aggregation: 'SUM' } },
      ],
      views: [{ id: 'all', name: 'All clients', type: 'grid' }],
    },
  ])

  let mode = $state<'edit' | 'share'>('share')
  let hideBudget = $state(true)
  // The app's own record of saves: a client's view changes never land here.
  let saves = $state(0)
</script>

<section class="share-demo">
  <div class="share-demo-bar">
    <div class="share-demo-switch" role="group" aria-label="Show the base as">
      <button type="button" aria-pressed={mode === 'edit'} onclick={() => (mode = 'edit')}>Team (editing)</button>
      <button type="button" aria-pressed={mode === 'share'} onclick={() => (mode = 'share')}>Client (share link)</button>
    </div>
    {#if mode === 'share'}
      <label class="share-demo-check"><input type="checkbox" bind:checked={hideBudget} /> Hide Budget from the client</label>
    {/if}
    <span class="share-demo-saves" aria-live="polite">Share link onTablesChange: {saves} {saves === 1 ? 'call' : 'calls'}</span>
  </div>
  <p class="share-demo-tip">
    {#if mode === 'share'}
      Try to change something: double-click a cell, drag a card on By status, right-click a record. Sorting, filtering and switching views work, and stay in this page.
    {:else}
      Edit a status or a date here, or open a record and comment on it, then switch to the client's link: it shows the change and the comment.
    {/if}
  </p>
  {#key mode === 'share' ? `share-${hideBudget}` : 'edit'}
    {#if mode === 'share'}
      <SvBase
        {tables}
        readOnly={hideBudget ? { hideFields: ['budget'] } : true}
        onTablesChange={() => (saves += 1)}
        sortable
        showRowNumbers
        expandRows
        rowNumberWidth={64}
        showRowSelection={false}
        rowHeight={40}
        containerHeight="100%"
        fieldMenu
      />
    {:else}
      <SvBase
        bind:tables
        editable
        sortable
        showRowNumbers
        expandRows
        rowNumberWidth={64}
        showRowSelection={false}
        rowHeight={40}
        containerHeight="100%"
        columnAdder
        fieldMenu
      />
    {/if}
  {/key}
  <SvToaster />
</section>

<style>
  .share-demo { display: flex; flex-direction: column; flex: 1; min-height: 520px; height: 100%; gap: 10px; }
  .share-demo-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; font-size: 13px; color: var(--sg-fg, #0f172a); }
  .share-demo-switch { display: inline-flex; padding: 2px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 6px); background: var(--sg-muted-bg, var(--sg-header-bg, #f8fafc)); }
  .share-demo-switch button {
    height: 28px; padding: 0 12px; border: 0; border-radius: calc(var(--sg-radius, 6px) - 2px);
    background: none; color: var(--sg-muted, #64748b); font: inherit; cursor: pointer;
  }
  .share-demo-switch button[aria-pressed='true'] { background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-weight: 600; box-shadow: 0 0 0 1px var(--sg-border, #e2e8f0); }
  .share-demo-switch button:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: -2px; }
  .share-demo-check { display: inline-flex; align-items: center; gap: 6px; }
  .share-demo-check input { accent-color: var(--sg-accent, #2563eb); }
  .share-demo-saves { margin-left: auto; font-size: 12px; color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }
  .share-demo-tip { margin: 0; font-size: 13px; line-height: 1.5; color: var(--sg-muted, #64748b); }
</style>
