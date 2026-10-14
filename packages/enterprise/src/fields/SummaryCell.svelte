<script lang="ts">
  /**
   * A field's cell in the footer summary row (the grid's `summary` prop): the
   * summary it shows, named ("Sum $4,320", "Empty 3"), or a quiet
   * "Summarize" on hover. A click opens the summaries that fit the field
   * (sum, average... for numbers; checked for a checkbox; earliest, latest
   * for dates; empty, filled, unique for all); the choice is kept in the
   * field (`fieldProps.summary`, through onColumnChange). The primary field,
   * until one is picked for it, shows how many records the view holds.
   */
  import { portalToBody } from '@svgrid/grid'
  import { fieldPropsOf } from './registry.svelte'
  import { setFieldSummary } from './field-ops'
  import { summaryChoices, summaryLabel, type SummaryKind } from './summaries'
  import { groupLeaves, leafFilter, primaryIdOf } from './grid-access'

  let { ctrl, column, text }: { ctrl: any; column: { id: string; columnDef: Record<string, any> }; text: string } = $props()

  const isField = $derived(!!column.columnDef.fieldType)
  const kind = $derived((fieldPropsOf(column.columnDef as never).summary as SummaryKind | undefined) ?? 'none')
  const choices = $derived(isField ? summaryChoices(column.columnDef) : [])
  // The record count, in the primary field's cell while it has no summary of its own.
  const showsCount = $derived(kind === 'none' && primaryIdOf(ctrl) === column.id)
  type CountRow = { depth?: number; leafCount?: number; getCanExpand?: () => boolean; __treeRow?: boolean }
  const count = $derived.by(() => {
    if (!showsCount) return 0
    const rows = (ctrl.allRows ?? []) as CountRow[]
    // Grouped: a collapsed group hides its rows, which are still records; the
    // grid groups before it filters, so a group's size counts the view's filter.
    const tops = rows.filter((r) => (r.depth ?? 0) === 0 && !r.__treeRow && typeof r.getCanExpand === 'function' && r.getCanExpand() && r.leafCount != null)
    if (!tops.length) return rows.length
    const keep = leafFilter(ctrl)
    return keep ? tops.reduce((n, r) => n + groupLeaves(r as never, keep).length, 0) : tops.reduce((n, r) => n + (r.leafCount ?? 0), 0)
  })
  const right = $derived(column.columnDef.align === 'right' || (column.columnDef.align == null && column.columnDef.cellDataType === 'number'))

  let button = $state<HTMLButtonElement | null>(null)
  let menu = $state<HTMLElement | null>(null)
  let at = $state<{ left: number; bottom: number; width: number } | null>(null)

  function toggle() {
    if (at) return close()
    const r = button!.getBoundingClientRect()
    // The footer sits at the grid's bottom: the menu opens upward.
    at = { left: Math.max(8, Math.min(r.left, window.innerWidth - 220)), bottom: window.innerHeight - r.top + 4, width: Math.max(r.width, 200) }
    queueMicrotask(() => menu?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus())
  }
  function close() {
    at = null
  }
  function pick(value: SummaryKind) {
    close()
    setFieldSummary(ctrl, column.id, value)
    button?.focus()
  }
  function onMenuKey(e: KeyboardEvent) {
    const items = [...(menu?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') {
      close()
      button?.focus()
    } else if (e.key === 'ArrowDown') items[(i + 1) % items.length]?.focus()
    else if (e.key === 'ArrowUp') items[(i - 1 + items.length) % items.length]?.focus()
    else return
    e.preventDefault()
  }
  function dismissOutside(node: HTMLElement) {
    const onDown = (e: PointerEvent) => {
      if (!node.contains(e.target as Node) && !button?.contains(e.target as Node)) close()
    }
    document.addEventListener('pointerdown', onDown, true)
    return { destroy: () => document.removeEventListener('pointerdown', onDown, true) }
  }
</script>

{#if !isField}
  <span class="sv-grid-cell-text">{text}</span>
{:else}
  <button
    type="button"
    class="sv-fsm"
    class:is-right={right}
    class:is-set={kind !== 'none' || showsCount}
    bind:this={button}
    aria-haspopup="menu"
    aria-expanded={!!at}
    aria-label={showsCount ? `${count} ${count === 1 ? 'record' : 'records'}, summarize ${column.columnDef.header ?? column.id}` : kind === 'none' ? `Summarize ${column.columnDef.header ?? column.id}` : `${summaryLabel(kind)} ${text}, change summary`}
    onclick={toggle}
  >
    {#if showsCount}
      <span class="sv-fsm-value">{count}</span>
      <span class="sv-fsm-label">{count === 1 ? 'record' : 'records'}</span>
    {:else if kind === 'none'}
      <span class="sv-fsm-hint">Summarize</span>
      <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
    {:else}
      <span class="sv-fsm-label">{summaryLabel(kind)}</span>
      <span class="sv-fsm-value">{text}</span>
    {/if}
  </button>
  {#if at}
    <div
      class="sv-fsm-menu"
      role="menu"
      tabindex="-1"
      aria-label="Summary"
      bind:this={menu}
      use:portalToBody
      use:dismissOutside
      style:left={`${at.left}px`}
      style:bottom={`${at.bottom}px`}
      style:min-width={`${at.width}px`}
      onkeydown={onMenuKey}
    >
      {#each choices as c (c.value)}
        <button type="button" role="menuitemradio" aria-checked={c.value === kind} class="sv-fsm-item" onclick={() => pick(c.value)}>
          <span>{c.label}</span>
          {#if c.value === kind}<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>{/if}
        </button>
      {/each}
    </div>
  {/if}
{/if}

<style>
  .sv-fsm {
    display: flex; align-items: center; gap: 6px; width: 100%; height: 100%; min-height: 28px; padding: 0 8px; box-sizing: border-box;
    border: 0; background: none; color: var(--sg-fg, #0f172a); font: inherit; font-size: 13px; font-weight: 400; cursor: pointer; text-align: start;
  }
  .sv-fsm.is-right { justify-content: flex-end; }
  .sv-fsm-hint { color: var(--sg-muted, #64748b); }
  /* "Summarize" is quiet: it shows on the footer row's hover and on focus. */
  .sv-fsm:not(.is-set) { opacity: 0; }
  :global(.sv-grid-summary-row:hover) .sv-fsm:not(.is-set),
  .sv-fsm:not(.is-set):focus-visible,
  .sv-fsm[aria-expanded='true'] { opacity: 1; }
  /* A base's summary row is drawn as the "+ Add row" line under it is: on
     the column headers' ground, one line above, no column lines through it.
     Every cell of it (row number, pinned, spacers) the same; `--sg-summary-bg`
     picks a ground of its own. */
  :global(.sv-fbase .sv-grid-foot > .sv-grid-summary-row > :is(th, td)) {
    background: var(--sg-summary-bg, var(--sg-header-bg, #f5f7fb));
    border-top: 1px solid var(--sg-border, #e2e8f0);
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    /* One band: no column lines through it, no seam by the row numbers. */
    border-inline-end-color: transparent;
  }
  .sv-fsm-label { color: var(--sg-muted, #64748b); font-weight: 400; }
  .sv-fsm-value { font-weight: 600; font-variant-numeric: tabular-nums; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-fsm-menu {
    position: fixed; z-index: 2147483646; display: flex; flex-direction: column; padding: 4px; max-height: 60vh; overflow: auto;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 6px);
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); box-shadow: 0 8px 24px rgb(0 0 0 / 0.16);
  }
  .sv-fsm-item {
    display: flex; align-items: center; justify-content: space-between; gap: 12px; height: 30px; padding: 0 10px;
    border: 0; border-radius: 4px; background: none; color: inherit; font: inherit; font-size: 13px; text-align: start; cursor: pointer;
  }
  .sv-fsm-item:hover, .sv-fsm-item:focus-visible { background: var(--sg-row-hover-bg, #f1f5f9); outline: none; }
</style>
