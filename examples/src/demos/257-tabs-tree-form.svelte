<script lang="ts">
  /**
   * Layout & composite - SvTabs, SvTree and SvForm. The form is schema-driven
   * and wires the rest of the UI kit (inputs, select, switch, date, rating).
   */
  import { SvTabs, SvTree, SvForm } from '@svgrid/grid'
  import type { SvTreeNode, FormField } from '@svgrid/grid'

  let tab = $state('form')

  const tree: SvTreeNode[] = [
    { id: 'src', label: 'src', children: [
      { id: 'comp', label: 'components', children: [
        { id: 'a', label: 'SvCalendar.svelte' },
        { id: 'b', label: 'SvTree.svelte' },
        { id: 'c', label: 'SvForm.svelte' },
      ] },
      { id: 'lib', label: 'lib', children: [{ id: 'd', label: 'popover.ts' }, { id: 'e', label: 'date-core.ts' }] },
      { id: 'idx', label: 'index.ts' },
    ] },
    { id: 'pkg', label: 'package.json' },
  ]
  let treeSel = $state<string | null>('a')
  let checked = $state<string[]>([])

  const fields: FormField[] = [
    { name: 'name', label: 'Full name', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true, validate: (v) => (v && !String(v).includes('@') ? 'Enter a valid email' : null) },
    { name: 'plan', label: 'Plan', type: 'select', options: [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }, { value: 'ent', label: 'Enterprise' }] },
    { name: 'seats', label: 'Seats', type: 'number' },
    { name: 'starts', label: 'Start date', type: 'date' },
    { name: 'newsletter', label: 'Subscribe to the newsletter', type: 'switch', full: true },
    { name: 'notes', label: 'Notes', type: 'textarea', full: true },
  ]
  let submitted = $state<Record<string, any> | null>(null)
</script>

<div class="wrap">
  <header>
    <h2>Layout &amp; composite</h2>
    <p>SvTabs, SvTree and a schema-driven SvForm - the last wires the rest of the kit. All theme from <code>--sg-*</code>.</p>
  </header>

  <SvTabs
    tabs={[{ id: 'form', label: 'Form' }, { id: 'tree', label: 'Tree' }, { id: 'pill', label: 'Pill tabs' }]}
    value={tab}
    onChange={(id) => (tab = id)}
  >
    {#snippet panel(active)}
      {#if active === 'form'}
        <div class="pane">
          <SvForm {fields} columns={2} initial={{ plan: 'pro', seats: 5 }} onSubmit={(v) => { submitted = v }} submitLabel="Create account" />
          {#if submitted}<pre class="result">{JSON.stringify(submitted, null, 2)}</pre>{/if}
        </div>
      {:else if active === 'tree'}
        <div class="pane trees">
          <div>
            <h4>Single select</h4>
            <SvTree nodes={tree} selected={treeSel} expandedIds={['src', 'comp']} onSelect={(id) => (treeSel = id)} />
            <p class="muted">Selected: <strong>{treeSel}</strong></p>
          </div>
          <div>
            <h4>Cascading checkboxes</h4>
            <SvTree nodes={tree} checkable checked={checked} expandedIds={['src', 'comp', 'lib']} onCheck={(ids) => (checked = ids)} />
            <p class="muted">{checked.length} checked</p>
          </div>
        </div>
      {:else}
        <div class="pane">
          <SvTabs variant="pill" tabs={[{ id: '1', label: 'Overview' }, { id: '2', label: 'Activity' }, { id: '3', label: 'Settings' }]}>
            {#snippet panel(a)}
              <p class="muted">Pill-style tab panel: <strong>{a}</strong>. Arrow keys navigate; Home/End jump.</p>
            {/snippet}
          </SvTabs>
        </div>
      {/if}
    {/snippet}
  </SvTabs>
</div>

<style>
  .wrap { padding: 22px; max-width: 820px; display: flex; flex-direction: column; gap: 12px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .pane { padding-top: 6px; }
  .trees { display: flex; gap: 40px; flex-wrap: wrap; }
  .trees h4 { margin: 0 0 8px; font-size: 13px; }
  .muted { color: var(--sg-muted, #64748b); font-size: 12.5px; }
  .result { margin-top: 14px; background: var(--sg-header-bg, #f8fafc); border: 1px solid var(--sg-border, #e2e8f0); border-radius: 8px; padding: 10px 12px; font-size: 12px; overflow: auto; }
</style>
