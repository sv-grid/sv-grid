# Layout & composite

## SvTabs

A WAI-ARIA tabs widget with roving tabindex and arrow-key navigation. The active
panel is rendered through the `panel` snippet (receives the active id).

```svelte
<SvTabs tabs={[{id:'a',label:'Overview'},{id:'b',label:'Activity'}]}
  value={tab} onChange={(id) => (tab = id)} variant="line">
  {#snippet panel(active)}
    {#if active === 'a'}…{:else}…{/if}
  {/snippet}
</SvTabs>
```

Props: `tabs` ({ id, label, disabled? }), `value`, `onChange(id)`, `orientation`
(`horizontal` | `vertical`), `variant` (`line` | `pill`), `activation`
(`automatic` | `manual`), `panel` snippet. Keyboard: arrows (skip disabled),
Home/End.

## SvTree

A WAI-ARIA tree view: expand/collapse, single-select highlight, and optional
cascading tri-state checkboxes. The visible tree is flattened internally so
keyboard nav stays simple.

```svelte
<SvTree nodes={tree} selected={sel} expandedIds={['root']}
  onSelect={(id) => (sel = id)} />

<!-- with checkboxes -->
<SvTree nodes={tree} checkable checked={checked} onCheck={(ids) => (checked = ids)} />
```

Node shape: `{ id, label, children?, disabled? }` (exported as `SvTreeNode`).
Props: `nodes`, `selected`, `onSelect(id)`, `expandedIds`, `onToggle(id, open)`,
`checkable`, `checked` (string[]), `onCheck(ids)`. Keyboard: up/down move,
right expands / into children, left collapses / to parent, Enter selects,
Space checks.

## SvForm

A schema-driven form that renders the UI-kit controls with labels, required +
custom validation, and a submit handler. Emits `onSubmit(values)` only when valid.

```svelte
<script>
  const fields = [
    { name: 'name', label: 'Name', required: true },
    { name: 'email', label: 'Email', type: 'email',
      validate: (v) => (v && !v.includes('@') ? 'Invalid email' : null) },
    { name: 'plan', label: 'Plan', type: 'select',
      options: [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }] },
    { name: 'starts', label: 'Start', type: 'date' },
    { name: 'notes', label: 'Notes', type: 'textarea', full: true },
  ]
</script>

<SvForm {fields} columns={2} initial={{ plan: 'pro' }}
  onSubmit={(values) => save(values)} submitLabel="Create" />
```

Field types: `text` `email` `tel` `textarea` `number` `password` `select`
`checkbox` `switch` `date` `color` `rating`. Field shape:
`{ name, label, type?, required?, placeholder?, options?, validate?, full? }`.
Props: `fields`, `initial`, `onSubmit(values)`, `onChange(values)`, `columns`,
`submitLabel`, `disabled`.
