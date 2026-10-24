<!--
  SvReviewPanel - review a change review's proposals by group.

  Groups come from `review.groups()`, risky ones first (no pattern, one
  target from many values, low confidence), rule groups last. Each group is
  accepted or rejected as shown: the ids rendered are the ids decided, so a
  proposal that arrives meanwhile is never decided unseen. Every decision is
  one Ctrl+Z in the grid.

  Keys inside the list: J / K move between groups, Enter opens one, A
  accepts it, R rejects it.

  A plain panel, not a drawer: the grid stays usable beside it. Put it in a
  `<SvDrawer>` or a split layout of your own.
-->
<script lang="ts">
  import { SvButton } from '@svgrid/grid'
  import { showValue } from './cluster'
  import type { Review, ReviewOutcome } from './model.svelte'
  import type { Proposal, ProposalGroup } from './types'

  let {
    review,
    title = 'Review changes',
    confirmOver = 50,
    onDecide,
  }: {
    review: Review<any>
    title?: string
    /** Ask before deciding more than this many proposals at once. */
    confirmOver?: number
    /** Called after each decision with what happened. */
    onDecide?: (outcome: ReviewOutcome) => void
  } = $props()

  const groups = $derived(review.groups())
  const conflicts = $derived(review.conflicts())
  /** Conflicting proposals by cell, one entry per cell. */
  const conflictCells = $derived.by(() => {
    const byCell = new Map<string, Proposal[]>()
    for (const p of conflicts) {
      const k = p.rowId + '\u0000' + p.field
      byCell.set(k, [...(byCell.get(k) ?? []), p])
    }
    return [...byCell.values()]
  })
  const pendingCount = $derived(groups.reduce((s, g) => s + g.count, 0))

  let openKey = $state<string | null>(null)
  let focusIndex = $state(0)
  let busy = $state(false)
  let announce = $state('')
  let confirming = $state<{ label: string; count: number; run: () => void } | null>(null)
  let revealed = $state<Record<string, { id: string | null; offPage: number }>>({})
  let listEl = $state<HTMLElement | null>(null)

  const KIND_TEXT: Record<ProposalGroup['kind'], string> = {
    whitespace: 'Rule', case: 'Rule', format: 'Rule', scale: 'Rule',
    'same-mapping': 'Check', 'fill-empty': 'Check', 'constant-target': 'Check', unpatterned: 'Check each',
  }

  function say(out: ReviewOutcome) {
    const parts: string[] = []
    if (out.accepted.length) parts.push(`${out.accepted.length} accepted`)
    if (out.rejected.length) parts.push(`${out.rejected.length} rejected`)
    if (out.stale.length) parts.push(`${out.stale.length} not written: the cell changed`)
    if (out.skipped.length) parts.push(`${out.skipped.length} left pending`)
    if (out.error) parts.push(`not saved: ${out.error instanceof Error ? out.error.message : String(out.error)}`)
    announce = parts.join(', ') || 'Nothing to decide'
    onDecide?.(out)
  }

  function confirmYes() {
    const c = confirming
    confirming = null
    c?.run()
  }

  function guard(label: string, count: number, run: () => void) {
    if (count > confirmOver) confirming = { label, count, run }
    else run()
  }

  async function acceptIds(ids: string[]) {
    busy = true
    try {
      say(await review.accept(ids))
    } finally {
      busy = false
    }
  }

  const acceptGroup = (g: ProposalGroup) =>
    guard(`Accept ${g.count} changes: ${g.label}?`, g.count, () => void acceptIds(g.ids))
  const rejectGroup = (g: ProposalGroup) =>
    guard(`Reject ${g.count} changes: ${g.label}?`, g.count, () => say(review.reject(g.ids)))

  function acceptAll() {
    const ids = groups.flatMap((g) => g.ids)
    guard(`Accept all ${ids.length} changes?`, ids.length, () => void acceptIds(ids))
  }
  function rejectAll() {
    const ids = groups.flatMap((g) => g.ids)
    guard(`Reject all ${ids.length} changes?`, ids.length, () => say(review.reject(ids)))
  }

  function showInGrid(g: ProposalGroup) {
    revealed = { ...revealed, [g.key]: review.reveal(g.ids, revealed[g.key]?.id ?? undefined) }
  }

  /** What an open group lists: every member of a no-pattern group (it has no rule to trust), else the sample. */
  function listed(g: ProposalGroup): Proposal[] {
    const ids = g.kind === 'unpatterned' ? g.ids.slice(0, 200) : g.sample
    return ids.map((id) => review.get(id)).filter((p): p is Proposal => !!p)
  }

  function confidenceText(g: ProposalGroup): string {
    if (g.minConfidence === undefined) return ''
    const pct = (n: number) => `${Math.round(n * 100)}%`
    return g.minConfidence === g.avgConfidence ? `${pct(g.minConfidence)} sure` : `${pct(g.minConfidence)} to ${pct(g.avgConfidence!)} avg sure`
  }

  function onKeydown(e: KeyboardEvent) {
    if (busy || !groups.length || (e.target as HTMLElement).closest('button.sv-review-act')) return
    const g = groups[Math.min(focusIndex, groups.length - 1)]
    const key = e.key.toLowerCase()
    if (key === 'j' || e.key === 'ArrowDown') focusIndex = Math.min(groups.length - 1, focusIndex + 1)
    else if (key === 'k' || e.key === 'ArrowUp') focusIndex = Math.max(0, focusIndex - 1)
    else if (e.key === 'Enter') openKey = openKey === g.key ? null : g.key
    else if (key === 'a') acceptGroup(g)
    else if (key === 'r') rejectGroup(g)
    else return
    e.preventDefault()
    queueMicrotask(() => listEl?.querySelectorAll<HTMLElement>('.sv-review-group-head')[focusIndex]?.focus())
  }
</script>

<section class="sv-review" aria-label={title}>
  <header class="sv-review-head">
    <h2 class="sv-review-title">{title}</h2>
    <p class="sv-review-count">
      {#if pendingCount}{pendingCount} pending in {groups.length} {groups.length === 1 ? 'group' : 'groups'}{:else}Nothing pending{/if}{#if conflicts.length}, {conflicts.length} in conflict{/if}
    </p>
    {#if pendingCount}
      <div class="sv-review-all">
        <SvButton size="sm" disabled={busy || conflicts.length > 0} onclick={acceptAll}>Accept all</SvButton>
        <SvButton size="sm" variant="outline" disabled={busy} onclick={rejectAll}>Reject all</SvButton>
      </div>
      {#if conflicts.length}<p class="sv-review-hint">Resolve the conflicts before accepting everything.</p>{/if}
    {/if}
  </header>

  {#if confirming}
    <div class="sv-review-confirm" role="alertdialog" aria-label={confirming.label}>
      <p>{confirming.label}</p>
      <div class="sv-review-all">
        <SvButton size="sm" onclick={confirmYes}>Yes, {confirming.count}</SvButton>
        <SvButton size="sm" variant="ghost" onclick={() => (confirming = null)}>Cancel</SvButton>
      </div>
    </div>
  {/if}

  {#if conflicts.length}
    <section class="sv-review-conflicts" aria-label="Conflicts">
      <h3 class="sv-review-subtitle">Two sources disagree</h3>
      {#each conflictCells as cell (cell[0].id)}
        <div class="sv-review-conflict">
          <span class="sv-review-cell">Row {cell[0].rowId}, {cell[0].field}: now {showValue(cell[0].before)}</span>
          {#each cell as p (p.id)}
            <button type="button" class="sv-review-keep" onclick={() => review.resolveConflict(p.id)}>
              Keep {showValue(p.after)} <span class="sv-review-src">({p.source.label})</span>
            </button>
          {/each}
        </div>
      {/each}
    </section>
  {/if}

  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <ul class="sv-review-groups" bind:this={listEl} onkeydown={onKeydown}>
    {#each groups as g, i (g.key)}
      {@const open = openKey === g.key}
      <li class="sv-review-group" class:is-rule={g.rule} class:is-open={open}>
        <div class="sv-review-row">
          <button
            type="button"
            class="sv-review-group-head"
            aria-expanded={open}
            tabindex={i === Math.min(focusIndex, groups.length - 1) ? 0 : -1}
            onfocus={() => (focusIndex = i)}
            onclick={() => (openKey = open ? null : g.key)}
          >
            <span class="sv-review-badge" class:is-rule={g.rule}>{KIND_TEXT[g.kind]}</span>
            <span class="sv-review-text">
              <span class="sv-review-label">{g.label}</span>
              <span class="sv-review-conf"><span class="sv-review-n">{g.count}</span> {g.count === 1 ? 'change' : 'changes'}{#if confidenceText(g)}, {confidenceText(g)}{/if}</span>
            </span>
          </button>
          <button type="button" class="sv-review-act is-accept" disabled={busy} aria-label="Accept {g.count}: {g.label}" onclick={() => acceptGroup(g)}>Accept</button>
          <button type="button" class="sv-review-act" disabled={busy} aria-label="Reject {g.count}: {g.label}" onclick={() => rejectGroup(g)}>Reject</button>
        </div>
        {#if open}
          <div class="sv-review-body">
            {#if g.beforeDistribution}
              <p class="sv-review-subtitle">From</p>
              <ul class="sv-review-dist">
                {#each g.beforeDistribution as d, j (j)}
                  <li><span>{d.other ? 'other values' : showValue(d.value)}</span><span class="sv-review-n">{d.count}</span></li>
                {/each}
              </ul>
            {/if}
            <p class="sv-review-subtitle">{g.kind === 'unpatterned' ? (g.count > 200 ? 'First 200' : 'Every change') : `Sample of ${g.count}`}</p>
            <table class="sv-review-sample">
              <tbody>
                {#each listed(g) as p (p.id)}
                  <tr>
                    <td class="sv-review-before">{showValue(p.before)}</td>
                    <td aria-hidden="true">→</td>
                    <td class="sv-review-after">{showValue(p.after)}</td>
                    <td class="sv-review-meta">
                      {#if p.confidence !== undefined}{Math.round(p.confidence * 100)}%{/if}
                      {#if p.reason}<span title={p.reason}>{p.reason}</span>{/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
            <div class="sv-review-all">
              <SvButton size="sm" variant="ghost" onclick={() => showInGrid(g)}>
                {revealed[g.key]?.id ? 'Next in grid' : 'Show in grid'}
              </SvButton>
              {#if revealed[g.key]?.offPage}<span class="sv-review-hint">{revealed[g.key].offPage} not on this page</span>{/if}
            </div>
          </div>
        {/if}
      </li>
    {/each}
  </ul>

  <p class="sv-review-live" role="status" aria-live="polite">{announce}</p>
  {#if pendingCount || announce}<p class="sv-review-hint">Ctrl+Z in the grid undoes the last decision.</p>{/if}
</section>

<style>
  .sv-review {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    padding: 12px;
    font-family: var(--sg-font, inherit);
    font-size: 13px;
    color: var(--sg-fg, #111827);
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: var(--sg-radius, 6px);
  }
  .sv-review-title { margin: 0; font-size: 15px; font-weight: 600; }
  .sv-review-count, .sv-review-hint { margin: 0; color: var(--sg-muted, #6b7280); }
  .sv-review-hint { font-size: 12px; }
  .sv-review-subtitle { margin: 8px 0 4px; font-size: 12px; font-weight: 600; color: var(--sg-muted, #6b7280); }
  .sv-review-all { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
  .sv-review-confirm {
    padding: 8px 10px;
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: var(--sg-radius, 6px);
    background: var(--sg-header-bg, #f9fafb);
  }
  .sv-review-confirm p { margin: 0; }
  .sv-review-conflict { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 4px 0; }
  .sv-review-keep {
    font: inherit;
    padding: 2px 8px;
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: var(--sg-radius, 6px);
    background: var(--sg-bg, #fff);
    color: inherit;
    cursor: pointer;
  }
  .sv-review-src { color: var(--sg-muted, #6b7280); }
  .sv-review-groups { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .sv-review-group { border: 1px solid var(--sg-border, #e5e7eb); border-radius: var(--sg-radius, 6px); }
  .sv-review-row { display: flex; align-items: stretch; }
  .sv-review-group-head {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    font: inherit;
    text-align: left;
    color: inherit;
    background: none;
    border: 0;
    cursor: pointer;
  }
  .sv-review-group-head:focus-visible, .sv-review-act:focus-visible, .sv-review-keep:focus-visible {
    outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb));
    outline-offset: -2px;
  }
  /* The label wraps, at word breaks: it is what a reviewer decides on, so it
     is never cut. Count and confidence go on the line under it. */
  .sv-review-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .sv-review-label { overflow-wrap: break-word; }
  .sv-review-n { font-variant-numeric: tabular-nums; font-weight: 600; }
  .sv-review-conf { color: var(--sg-muted, #6b7280); font-size: 12px; }
  .sv-review-badge {
    flex: none;
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 999px;
    color: var(--sg-fg, #111827);
    background: color-mix(in srgb, var(--sg-danger, #dc2626) 12%, transparent);
  }
  .sv-review-badge.is-rule { background: var(--sg-header-bg, #f3f4f6); color: var(--sg-muted, #6b7280); }
  .sv-review-act {
    flex: none;
    font: inherit;
    font-size: 12px;
    padding: 0 10px;
    border: 0;
    border-left: 1px solid var(--sg-border, #e5e7eb);
    background: none;
    color: var(--sg-muted, #6b7280);
    cursor: pointer;
  }
  .sv-review-act.is-accept { color: var(--sg-fg, #111827); font-weight: 600; }
  .sv-review-act:disabled { opacity: 0.5; cursor: default; }
  .sv-review-body { padding: 0 8px 8px; border-top: 1px solid var(--sg-border, #e5e7eb); }
  .sv-review-dist { list-style: none; margin: 0; padding: 0; }
  .sv-review-dist li { display: flex; justify-content: space-between; gap: 8px; padding: 1px 0; }
  .sv-review-sample { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .sv-review-sample td { padding: 2px 4px; vertical-align: top; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-review-sample td:nth-child(2) { width: 16px; color: var(--sg-muted, #6b7280); }
  .sv-review-before { color: var(--sg-muted, #6b7280); text-decoration: line-through; }
  .sv-review-after { font-weight: 600; }
  .sv-review-meta { width: 30%; color: var(--sg-muted, #6b7280); font-size: 12px; }
  .sv-review-live { margin: 0; min-height: 1em; font-size: 12px; }
</style>
