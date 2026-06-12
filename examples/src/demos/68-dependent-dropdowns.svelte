<script lang="ts">
  /**
   * 68. Smart dependent dropdowns - cascade + typeahead + invalid recovery
   * ---------------------------------------------------------------------
   * Production-quality cascade editor for Country → State → City:
   *
   *   - Typeahead inside each combobox. Filter narrows the option list
   *     as you type; arrow keys + Enter pick a value.
   *   - Editing Country resets State + City to a sensible default
   *     (the first valid option). Editing State resets City.
   *   - If the cascade is left in an inconsistent state (e.g. seed data
   *     where the city no longer belongs to the country), the cell turns
   *     amber and a one-click "Fix" repair button suggests a valid value.
   *
   * The combobox itself is rendered as a custom `cell` snippet so the
   * editor and the display are the same element - no edit-mode flicker.
   */
  import { tick } from 'svelte'
  import { portal } from '../shared/portal'
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    renderSnippet,
    type ColumnDef,
    type SvGridApi,
  } from 'sv-grid-community'

  type Region = { id: string; country: string; state: string; city: string; rep: string }

  /** Full taxonomy. Real apps would fetch this on demand. */
  const REGIONS: Record<string, Record<string, string[]>> = {
    USA: {
      California: ['San Francisco', 'Los Angeles', 'San Diego', 'San Jose', 'Sacramento'],
      Texas:      ['Austin', 'Dallas', 'Houston', 'San Antonio', 'Fort Worth'],
      'New York': ['New York City', 'Buffalo', 'Albany', 'Rochester'],
      Florida:    ['Miami', 'Orlando', 'Tampa', 'Jacksonville'],
      Washington: ['Seattle', 'Spokane', 'Tacoma'],
    },
    Germany: {
      Bavaria:                 ['Munich', 'Nuremberg', 'Augsburg', 'Würzburg'],
      'North Rhine-Westphalia':['Cologne', 'Düsseldorf', 'Dortmund', 'Essen'],
      Berlin:                  ['Berlin'],
      Hamburg:                 ['Hamburg'],
      Hessen:                  ['Frankfurt', 'Wiesbaden', 'Kassel'],
    },
    Japan: {
      Kanto:  ['Tokyo', 'Yokohama', 'Saitama', 'Chiba'],
      Kansai: ['Osaka', 'Kyoto', 'Kobe', 'Nara'],
      Chubu:  ['Nagoya', 'Shizuoka', 'Niigata'],
    },
    UK: {
      England:  ['London', 'Manchester', 'Birmingham', 'Liverpool', 'Leeds'],
      Scotland: ['Edinburgh', 'Glasgow', 'Aberdeen'],
      Wales:    ['Cardiff', 'Swansea'],
    },
  }
  const COUNTRIES = Object.keys(REGIONS)
  const statesOf  = (c: string) => Object.keys(REGIONS[c] ?? {})
  const citiesOf  = (c: string, s: string) => REGIONS[c]?.[s] ?? []

  let rows = $state<Region[]>([
    { id: 'r1', country: 'USA',     state: 'California',             city: 'San Francisco', rep: 'Ada Lovelace' },
    { id: 'r2', country: 'Germany', state: 'Bavaria',                city: 'Munich',        rep: 'Linda Petersen' },
    { id: 'r3', country: 'Japan',   state: 'Kanto',                  city: 'Tokyo',         rep: 'Yuki Tanaka' },
    { id: 'r4', country: 'USA',     state: 'Texas',                  city: 'Austin',        rep: 'Linus Torvalds' },
    { id: 'r5', country: 'Germany', state: 'North Rhine-Westphalia', city: 'Cologne',       rep: 'Sven Andersson' },
    // Intentionally inconsistent seed row: city doesn't belong to the
    // state, state doesn't belong to the country. Demo-fixable in one click.
    { id: 'r6', country: 'UK',      state: 'California',             city: 'San Francisco', rep: '- vacant -' },
  ])

  function isValid(r: Region): { country: boolean; state: boolean; city: boolean } {
    return {
      country: COUNTRIES.includes(r.country),
      state:   statesOf(r.country).includes(r.state),
      city:    citiesOf(r.country, r.state).includes(r.city),
    }
  }

  const features = tableFeatures({ rowSortingFeature })
  let api = $state<SvGridApi<typeof features, Region> | null>(null)

  function update<K extends keyof Region>(rowIndex: number, field: K, value: Region[K]) {
    if (!api) return
    api.setCellValue(rowIndex, field as string, value)
  }

  /**
   * Set a downstream field to a valid value based on the upstream change.
   * Called on every change to country / state.
   */
  function cascade(rowIndex: number, level: 'country' | 'state', value: string) {
    if (!api) return
    if (level === 'country') {
      const firstState = statesOf(value)[0] ?? ''
      const firstCity  = citiesOf(value, firstState)[0] ?? ''
      update(rowIndex, 'country', value)
      update(rowIndex, 'state',   firstState)
      update(rowIndex, 'city',    firstCity)
    } else {
      const r = rows[rowIndex]
      if (!r) return
      const firstCity = citiesOf(r.country, value)[0] ?? ''
      update(rowIndex, 'state', value)
      update(rowIndex, 'city',  firstCity)
    }
  }

  function repair(rowIndex: number) {
    const r = rows[rowIndex]
    if (!r || !api) return
    // Bring everything below the first invalid level back to a valid default.
    const v = isValid(r)
    if (!v.country) cascade(rowIndex, 'country', COUNTRIES[0]!)
    else if (!v.state) cascade(rowIndex, 'state', statesOf(r.country)[0] ?? '')
    else if (!v.city) update(rowIndex, 'city', citiesOf(r.country, r.state)[0] ?? '')
  }

  // ---- Combobox component (inline) -------------------------------------
  type ComboState = {
    rowIndex: number
    field: 'country' | 'state' | 'city'
    value: string
    anchor: DOMRect
    query: string
    activeIndex: number
    options: string[]
  }
  let combo = $state<ComboState | null>(null)

  function openCombo(
    e: MouseEvent,
    rowIndex: number,
    field: ComboState['field'],
    value: string,
    options: string[],
  ) {
    const el = e.currentTarget as HTMLElement
    combo = {
      rowIndex, field, value,
      anchor: el.getBoundingClientRect(),
      query: '',
      activeIndex: Math.max(0, options.indexOf(value)),
      options,
    }
    tick().then(() => {
      const input = document.querySelector('.combo-input') as HTMLInputElement | null
      input?.focus()
      input?.select()
    })
  }
  function closeCombo() { combo = null }

  const filteredOptions = $derived.by(() => {
    if (!combo) return []
    const q = combo.query.trim().toLowerCase()
    if (!q) return combo.options
    return combo.options.filter((o) => o.toLowerCase().includes(q))
  })

  function pick(value: string) {
    if (!combo) return
    const { rowIndex, field } = combo
    closeCombo()
    if (field === 'country' || field === 'state') cascade(rowIndex, field, value)
    else update(rowIndex, 'city', value)
  }

  function onComboKey(e: KeyboardEvent) {
    if (!combo) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      combo.activeIndex = Math.min(filteredOptions.length - 1, combo.activeIndex + 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      combo.activeIndex = Math.max(0, combo.activeIndex - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const v = filteredOptions[combo.activeIndex]
      if (v) pick(v)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeCombo()
    }
  }

  // Highlight matched substring in each option row.
  function splitHighlight(text: string, q: string): Array<{ s: string; hit: boolean }> {
    if (!q) return [{ s: text, hit: false }]
    const lower = text.toLowerCase()
    const needle = q.toLowerCase()
    const idx = lower.indexOf(needle)
    if (idx === -1) return [{ s: text, hit: false }]
    return [
      { s: text.slice(0, idx), hit: false },
      { s: text.slice(idx, idx + needle.length), hit: true },
      { s: text.slice(idx + needle.length), hit: false },
    ]
  }

  const columns: ColumnDef<typeof features, Region>[] = [
    {
      field: 'country', header: 'Country', editorType: 'text', width: 180,
      cell: (ctx) => renderSnippet(ComboCell, {
        rowIndex: ctx.row.index, field: 'country', row: ctx.row.original, options: COUNTRIES,
      }),
    },
    {
      field: 'state', header: 'State / region', editorType: 'text', width: 220,
      cell: (ctx) => renderSnippet(ComboCell, {
        rowIndex: ctx.row.index, field: 'state', row: ctx.row.original,
        options: statesOf(ctx.row.original.country),
      }),
    },
    {
      field: 'city', header: 'City', editorType: 'text', width: 220,
      cell: (ctx) => renderSnippet(ComboCell, {
        rowIndex: ctx.row.index, field: 'city', row: ctx.row.original,
        options: citiesOf(ctx.row.original.country, ctx.row.original.state),
      }),
    },
    { field: 'rep', header: 'Sales rep', editorType: 'text', width: 200 },
  ]
</script>

{#snippet ComboCell(props: {
  rowIndex: number
  field: 'country' | 'state' | 'city'
  row: Region
  options: string[]
})}
  {@const v = props.row[props.field]}
  {@const valid = props.options.includes(v)}
  <span class="combo-cell">
    <button
      type="button"
      class="combo-trigger"
      class:invalid={!valid}
      onclick={(e) => openCombo(e, props.rowIndex, props.field, v, props.options)}
    >
      <span class="combo-value">{v || '-'}</span>
      <span class="combo-caret">▾</span>
    </button>
    {#if !valid}
      <button type="button" class="combo-fix" title="Repair: pick a valid value"
        onclick={() => repair(props.rowIndex)}>Fix</button>
    {/if}
  </span>
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <p class="text-sm text-slate-500 dark:text-slate-400 shrink-0">
    Click a <strong>Country</strong> / <strong>State</strong> / <strong>City</strong> cell. Type to filter, arrow-keys to navigate, Enter to pick.
    The last row is deliberately inconsistent - the amber cells offer a one-click <strong>Fix</strong>.
  </p>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      filterMode="none"
      selectionMode="cell"
      showRowNumbers={true}
      showPagination={false}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={40}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => (api = next)}
    />
  </div>
</section>

{#if combo}
  <div use:portal>
    <button type="button" aria-label="Close picker" class="combo-backdrop" onclick={closeCombo}></button>
    <div role="dialog" class="combo-popover"
      style="left: {combo.anchor.left}px; top: {combo.anchor.bottom + 4}px; min-width: {combo.anchor.width}px;">
      <input
        type="text"
        class="combo-input"
        placeholder="Search…"
        bind:value={combo.query}
        onkeydown={onComboKey}
      />
      <ul class="combo-list">
        {#if filteredOptions.length === 0}
          <li class="combo-empty">No matches</li>
        {:else}
          {#each filteredOptions as opt, i (opt)}
            <li>
              <button type="button"
                class="combo-option"
                class:is-active={i === combo.activeIndex}
                class:is-current={opt === combo.value}
                onmouseenter={() => combo && (combo.activeIndex = i)}
                onclick={() => pick(opt)}
              >
                {#each splitHighlight(opt, combo.query) as part, j (j)}
                  {#if part.hit}<mark>{part.s}</mark>{:else}<span>{part.s}</span>{/if}
                {/each}
              </button>
            </li>
          {/each}
        {/if}
      </ul>
    </div>
  </div>
{/if}

<style>
  .combo-cell      { display: inline-flex; align-items: center; gap: 6px; width: 100%; }
  .combo-trigger {
    flex: 1; min-width: 0;
    display: inline-flex; align-items: center; justify-content: space-between; gap: 8px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 4px 8px;
    color: inherit; cursor: pointer;
    text-align: left;
    font: inherit;
  }
  .combo-trigger:hover, .combo-trigger:focus-visible {
    border-color: var(--sg-border, #cbd5e1);
    background: var(--sg-row-hover-bg, rgba(148,163,184,0.08));
    outline: none;
  }
  .combo-trigger.invalid {
    border-color: #f59e0b;
    background: rgba(245, 158, 11, 0.08);
    color: #b45309;
  }
  .combo-value     { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .combo-caret     { color: var(--sg-muted, #94a3b8); font-size: 10px; flex: none; }
  .combo-fix {
    border: 1px solid #f59e0b; background: #fff7ed; color: #b45309;
    border-radius: 4px; padding: 1px 6px; font-size: 11px; font-weight: 600; cursor: pointer;
  }
  .combo-fix:hover { background: #fef3c7; }

  :global(.combo-backdrop) {
    position: fixed; inset: 0; z-index: 9998;
    background: transparent;
    border: 0; padding: 0;
  }
  :global(.combo-popover) {
    position: fixed; z-index: 9999;
    width: max-content; max-width: 320px;
    background: #ffffff; color: #0f172a;
    border: 1px solid rgba(15, 23, 42, 0.15);
    border-radius: 8px;
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
    overflow: hidden;
  }
  :global([data-theme="dark"] .combo-popover) { background: #0f172a; color: #f8fafc; border-color: rgba(255,255,255,0.08); }
  :global(.combo-input) {
    display: block; width: 100%;
    background: transparent; color: inherit;
    border: 0; border-bottom: 1px solid rgba(15,23,42,0.08);
    padding: 8px 12px; font-size: 13px; outline: none;
  }
  :global([data-theme="dark"] .combo-input) { border-bottom-color: rgba(255,255,255,0.08); }
  :global(.combo-list) { list-style: none; margin: 0; padding: 4px 0; max-height: 260px; overflow: auto; }
  :global(.combo-option) {
    display: block; width: 100%; text-align: left;
    background: transparent; border: 0; color: inherit;
    padding: 6px 12px; font-size: 13px; cursor: pointer;
  }
  :global(.combo-option:hover), :global(.combo-option.is-active) { background: rgba(99,102,241,0.10); }
  :global(.combo-option.is-current) { font-weight: 600; }
  :global(.combo-option mark) { background: rgba(99,102,241,0.20); color: inherit; border-radius: 2px; padding: 0 1px; }
  :global(.combo-empty) { padding: 8px 12px; font-size: 12px; color: rgba(148,163,184,0.9); }
</style>
