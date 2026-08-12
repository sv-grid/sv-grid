<!-- Documented in: docs/help/headless/styling.md -->
<script lang="ts">
  /**
   * 188. Styling a headless table
   * -----------------------------
   * Headless means YOU own every pixel. Same engine (createSvGrid), same rows -
   * flip the controls to restyle: preset (Minimal / Bordered / Card), density,
   * and zebra striping. All CSS lives in this file; the grid has no opinion. The
   * table uses --sg-* theme tokens, so it tracks the site's light / dark theme.
   */
  import {
    createSvGrid,
    createCoreRowModel,
    createSortedRowModel,
    tableFeatures,
    rowSortingFeature,
    type ColumnDef,
  } from '@svgrid/grid'

  type Person = { name: string; team: string; role: string; salary: number }
  const features = tableFeatures({ rowSortingFeature })
  const columns: ColumnDef<typeof features, Person>[] = [
    { field: 'name', header: 'Name' },
    { field: 'team', header: 'Team' },
    { field: 'role', header: 'Role' },
    { field: 'salary', header: 'Salary' },
  ]
  const data: Person[] = [
    { name: 'Ada Lovelace', team: 'Platform', role: 'Staff Eng', salary: 208000 },
    { name: 'Grace Hopper', team: 'Compilers', role: 'Principal', salary: 235000 },
    { name: 'Linus Torvalds', team: 'Kernel', role: 'Architect', salary: 221000 },
    { name: 'Margaret Hamilton', team: 'Flight SW', role: 'Director', salary: 244000 },
    { name: 'Tim Berners-Lee', team: 'Web', role: 'Fellow', salary: 199000 },
    { name: 'Barbara Liskov', team: 'Languages', role: 'Principal', salary: 231000 },
  ]

  let preset = $state<'minimal' | 'bordered' | 'card'>('bordered')
  let density = $state<'comfortable' | 'compact'>('comfortable')
  let zebra = $state(true)

  type Sort = { id: string; desc: boolean }
  let sorting = $state<Sort[]>([{ id: 'salary', desc: true }])
  const table = $derived.by(() =>
    createSvGrid({
      _features: features,
      _rowModels: { coreRowModel: createCoreRowModel<Person>(), sortedRowModel: createSortedRowModel<Person>() },
      data,
      columns,
      state: { sorting },
      onSortingChange: (u: unknown) =>
        (sorting = typeof u === 'function' ? (u as (s: Sort[]) => Sort[])(sorting) : (u as Sort[])),
      enableSorting: true,
    } as never),
  )
  const headerGroups = $derived(table.getHeaderGroups())
  const rows = $derived(table.getRowModel().rows)
  function toggleSort(id: string) {
    const cur = sorting[0]
    sorting = cur?.id !== id ? [{ id, desc: false }] : cur.desc ? [] : [{ id, desc: true }]
  }
  const ind = (id: string) => (sorting[0]?.id === id ? (sorting[0]!.desc ? '▼' : '▲') : '')
  const money = (n: number) => '$' + n.toLocaleString()
</script>

<section class="hs-wrap">
  <div class="hs-controls">
    <div class="hs-seg">
      {#each ['minimal', 'bordered', 'card'] as const as v}
        <button class:on={preset === v} onclick={() => (preset = v)}>{v}</button>
      {/each}
    </div>
    <div class="hs-seg">
      {#each ['comfortable', 'compact'] as const as d}
        <button class:on={density === d} onclick={() => (density = d)}>{d}</button>
      {/each}
    </div>
    <label class="hs-check"><input type="checkbox" bind:checked={zebra} /> Zebra</label>
  </div>

  <div class={`hs-table hs-${preset} hs-${density}`} class:hs-zebra={zebra}>
    <table>
      <thead>
        {#each headerGroups as hg (hg.id)}
          <tr>
            {#each hg.headers as h (h.id)}
              <th class:num={h.column.id === 'salary'} onclick={() => toggleSort(h.column.id)}>
                {h.column.columnDef.header}<span class="hs-ind">{ind(h.column.id)}</span>
              </th>
            {/each}
          </tr>
        {/each}
      </thead>
      <tbody>
        {#each rows as r (r.id)}
          {@const person = r.original as Person}
          <tr>
            <td class="hs-strong">{person.name}</td>
            <td>{person.team}</td>
            <td>{person.role}</td>
            <td class="num">{money(person.salary)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="hs-note">
    One engine, three looks. Every rule below the table is <strong>yours</strong> -
    swap it for Tailwind classes, a design system, whatever. The tokens
    (<code>--sg-*</code>) keep it in sync with the site theme.
  </p>
</section>

<style>
  .hs-wrap { display: flex; flex-direction: column; gap: 14px; padding: 4px; }
  .hs-controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .hs-seg { display: inline-flex; border: 1px solid var(--sg-border, #cbd5e1); border-radius: 8px; overflow: hidden; }
  .hs-seg button {
    padding: 6px 12px; font-size: 12px; font-weight: 600; text-transform: capitalize;
    background: var(--sg-bg, #fff); color: var(--sg-muted, #64748b); border: 0; cursor: pointer;
    border-right: 1px solid var(--sg-border, #e2e8f0);
  }
  .hs-seg button:last-child { border-right: 0; }
  .hs-seg button.on { background: var(--sg-accent, #6366f1); color: var(--sg-on-accent, #fff); }
  .hs-check { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--sg-fg, #0f172a); }
  .hs-check input { accent-color: var(--sg-accent, #6366f1); }

  /* ---- base table (all presets share this) ---- */
  .hs-table table { border-collapse: collapse; width: 100%; font-size: 13px; color: var(--sg-fg, #0f172a); }
  .hs-table th {
    text-align: left; font-weight: 700; cursor: pointer; user-select: none;
    color: var(--sg-fg, #0f172a); white-space: nowrap;
  }
  .hs-table th:hover { color: var(--sg-accent, #6366f1); }
  .hs-ind { color: var(--sg-accent, #6366f1); margin-left: 6px; font-size: 10px; }
  .hs-table td.num, .hs-table th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .hs-strong { font-weight: 600; }
  /* density */
  .hs-comfortable th, .hs-comfortable td { padding: 10px 14px; }
  .hs-compact th, .hs-compact td { padding: 5px 10px; }
  /* zebra */
  .hs-zebra tbody tr:nth-child(even) td { background: color-mix(in oklab, var(--sg-muted, #94a3b8) 8%, transparent); }
  .hs-table tbody tr:hover td { background: var(--sg-row-hover-bg, color-mix(in oklab, #6366f1 8%, transparent)); }

  /* ---- preset: minimal (underline header only) ---- */
  .hs-minimal th { border-bottom: 2px solid var(--sg-border, #e2e8f0); }
  .hs-minimal td { border-bottom: 1px solid var(--sg-border, #eef2f7); }

  /* ---- preset: bordered (full grid lines) ---- */
  .hs-bordered { border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; overflow: hidden; }
  .hs-bordered th { background: var(--sg-header-bg, #f1f5f9); }
  .hs-bordered th, .hs-bordered td { border: 1px solid var(--sg-border, #e2e8f0); }

  /* ---- preset: card (rows as floating cards) ---- */
  .hs-card table { border-collapse: separate; border-spacing: 0 8px; }
  .hs-card thead th { color: var(--sg-muted, #64748b); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
  .hs-card tbody tr td { background: var(--sg-bg, #fff); border-top: 1px solid var(--sg-border, #e2e8f0); border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .hs-card tbody tr td:first-child { border-left: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px 0 0 10px; }
  .hs-card tbody tr td:last-child { border-right: 1px solid var(--sg-border, #e2e8f0); border-radius: 0 10px 10px 0; }
  .hs-card tbody tr:hover td { box-shadow: 0 2px 10px color-mix(in oklab, var(--sg-accent, #6366f1) 14%, transparent); }

  .hs-note { font-size: 12.5px; color: var(--sg-muted, #64748b); margin: 0; }
  .hs-note strong { color: var(--sg-accent, #6366f1); }
</style>
