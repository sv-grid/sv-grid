<script lang="ts">
  /**
   * 69. External search with highlighted matches
   * --------------------------------------------
   * A search input above the grid filters rows AND wraps the matching
   * substring inside each cell with a `<mark>` so the user can see
   * exactly what matched.
   *
   * Implementation: pre-compute the filtered row set in a derived state;
   * render text columns through a snippet that splits the value around
   * the query.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    renderSnippet,
    type ColumnDef,
  } from 'sv-grid-community'
  import { makePeople, type Person } from '../shared/seed'

  const features = tableFeatures({ rowSortingFeature })
  const allRows = makePeople(120)

  let query = $state('')
  const visible = $derived.by(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allRows
    return allRows.filter((r) =>
      `${r.firstName} ${r.lastName} ${r.department} ${r.country}`.toLowerCase().includes(q),
    )
  })

  function decorate(text: string, q: string): Array<{ s: string; hit: boolean }> {
    if (!q) return [{ s: text, hit: false }]
    const out: Array<{ s: string; hit: boolean }> = []
    const lower  = text.toLowerCase()
    const needle = q.toLowerCase()
    let i = 0
    let found = lower.indexOf(needle, i)
    while (found !== -1) {
      if (found > i) out.push({ s: text.slice(i, found), hit: false })
      out.push({ s: text.slice(found, found + needle.length), hit: true })
      i = found + needle.length
      found = lower.indexOf(needle, i)
    }
    if (i < text.length) out.push({ s: text.slice(i), hit: false })
    return out
  }

  function textColumn(field: keyof Person, header: string, width: number): ColumnDef<typeof features, Person> {
    return {
      id: String(field), header, accessorFn: (r) => r[field], width,
      cell: (ctx) => renderSnippet(HighlightCell, {
        text: String(ctx.getValue() ?? ''),
        q: query.trim(),
      }),
    }
  }

  const columns: ColumnDef<typeof features, Person>[] = [
    textColumn('firstName',  'First',      120),
    textColumn('lastName',   'Last',       140),
    textColumn('department', 'Department', 160),
    textColumn('country',    'Country',    110),
    { field: 'age',    header: 'Age',    width: 80,
      format: { type: 'number', options: { maximumFractionDigits: 0 } } },
    { field: 'salary', header: 'Salary', width: 130,
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
  ]
</script>

{#snippet HighlightCell(props: { text: string; q: string })}
  {#each decorate(props.text, props.q) as part, i (i)}
    {#if part.hit}<mark class="hit">{part.s}</mark>{:else}<span>{part.s}</span>{/if}
  {/each}
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <!-- Search bar -->
  <div class="search-bar shrink-0">
    <div class="search-input">
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M9 17a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" stroke="currentColor" stroke-width="1.5" />
        <path d="m19 19-4.35-4.35" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
      <input
        type="search"
        bind:value={query}
        placeholder="Search people by name, department, or country…"
        autocomplete="off"
      />
      {#if query}
        <button type="button" class="search-clear" aria-label="Clear search" onclick={() => (query = '')}>×</button>
      {/if}
    </div>
    <span class="search-meta">
      <strong>{visible.length}</strong>
      <span>of {allRows.length} matches</span>
    </span>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={visible}
      columns={columns}
      features={features}
      filterMode="none"
      selectionMode="cell"
      showRowNumbers={true}
      showPagination={true}
      pageSize={25}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>
</section>

<style>
  .search-bar {
    display: flex; align-items: center; gap: 12px;
  }
  .search-input {
    position: relative;
    flex: 1; max-width: 460px;
    display: flex; align-items: center;
  }
  .search-input svg {
    position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
    width: 16px; height: 16px;
    color: var(--sg-muted, #94a3b8);
    pointer-events: none;
  }
  .search-input input {
    width: 100%;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border-radius: 8px;
    padding: 9px 36px 9px 36px;
    font-size: 14px;
    transition: border-color 100ms, box-shadow 100ms;
  }
  .search-input input::placeholder { color: var(--sg-muted, #94a3b8); }
  .search-input input:focus {
    outline: none;
    border-color: var(--sg-accent, #6366f1);
    box-shadow: var(--sg-focus-ring, 0 0 0 3px rgba(99,102,241,0.18));
  }
  .search-clear {
    position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
    width: 22px; height: 22px;
    border: 0; border-radius: 999px;
    background: transparent;
    color: var(--sg-muted, #94a3b8);
    font-size: 18px; line-height: 1;
    cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .search-clear:hover { background: rgba(148,163,184,0.18); color: var(--sg-fg, #0f172a); }

  .search-meta {
    font-size: 13px; color: var(--sg-muted, #64748b);
    font-variant-numeric: tabular-nums;
  }
  .search-meta strong { color: var(--sg-fg, #0f172a); font-weight: 600; margin-right: 4px; }

  /* Calmer mark - rounded, tonal, no neon yellow */
  :global(mark.hit) {
    background: rgba(99, 102, 241, 0.18);
    color: inherit;
    border-radius: 3px;
    padding: 0 1px;
    font-weight: 600;
  }
</style>
