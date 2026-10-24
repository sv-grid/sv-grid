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
  `<SvDrawer>` or a split layout of your own. In a box that scrolls, the
  header stays in view.
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
  /** Every proposal of the session by status, for the progress bar and the summary. */
  const tally = $derived.by(() => {
    const t = { total: 0, accepted: 0, rejected: 0, stale: 0 }
    for (const p of review.proposals()) {
      t.total++
      if (p.status === 'accepted') t.accepted++
      else if (p.status === 'rejected') t.rejected++
      else if (p.status === 'stale') t.stale++
    }
    return t
  })
  const decidedCount = $derived(tally.accepted + tally.rejected + tally.stale)
  const stale = $derived(review.log().filter((p) => p.status === 'stale'))

  let openKey = $state<string | null>(null)
  let focusIndex = $state(0)
  let busy = $state(false)
  let announce = $state('')
  let confirming = $state<{ label: string; count: number; run: () => void } | null>(null)
  let revealed = $state<Record<string, { id: string | null; hidden: number }>>({})
  let listEl = $state<HTMLElement | null>(null)

  const BADGE: Record<ProposalGroup['kind'], { text: string; tone: 'rule' | 'check' | 'each'; hint: string }> = {
    whitespace: { text: 'Rule', tone: 'rule', hint: 'Every change in this group follows the rule.' },
    case: { text: 'Rule', tone: 'rule', hint: 'Every change in this group follows the rule.' },
    format: { text: 'Rule', tone: 'rule', hint: 'Every change in this group follows the rule.' },
    scale: { text: 'Rule', tone: 'rule', hint: 'Every change in this group follows the rule.' },
    'same-mapping': { text: 'Check', tone: 'check', hint: 'Check the mapping before accepting.' },
    'fill-empty': { text: 'Check', tone: 'check', hint: 'Check the sample: the least sure ones come first.' },
    'constant-target': { text: 'Check', tone: 'check', hint: 'Many different values set to one: check what they were.' },
    unpatterned: { text: 'Each', tone: 'each', hint: 'No shared pattern: look at each change.' },
  }

  function say(out: ReviewOutcome) {
    const parts: string[] = []
    if (out.accepted.length) parts.push(`${out.accepted.length} accepted`)
    if (out.rejected.length) parts.push(`${out.rejected.length} rejected`)
    if (out.stale.length) parts.push(`${out.stale.length} not written: the cell changed`)
    if (out.committedStale.length) parts.push(`${out.committedStale.length} saved but not shown: the cell changed while saving`)
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

  const pct = (n: number) => `${Math.round(n * 100)}%`
  function confidenceText(g: ProposalGroup): string {
    if (g.minConfidence === undefined) return ''
    return g.minConfidence === g.avgConfidence ? `${pct(g.minConfidence)} sure` : `${pct(g.minConfidence)} to ${pct(g.avgConfidence!)} sure`
  }
  const maxOf = (g: ProposalGroup) => Math.max(1, ...(g.beforeDistribution ?? []).map((d) => d.count))

  function onKeydown(e: KeyboardEvent) {
    if (busy || !groups.length || (e.target as HTMLElement).closest('button.sv-review-act')) return
    const g = groups[Math.min(focusIndex, groups.length - 1)]!
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

{#snippet check()}
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
{/snippet}
{#snippet cross()}
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" /></svg>
{/snippet}

<section class="sv-review" aria-label={title}>
  <header class="sv-review-head">
    <div class="sv-review-titlerow">
      <h2 class="sv-review-title">{title}</h2>
      {#if tally.total}<span class="sv-review-decided">{decidedCount} of {tally.total} decided</span>{/if}
    </div>
    {#if tally.total}
      <div
        class="sv-review-progress"
        role="progressbar"
        aria-label="Decided"
        aria-valuemin={0}
        aria-valuemax={tally.total}
        aria-valuenow={decidedCount}
      >
        <span class="is-accepted" style:width="{(tally.accepted / tally.total) * 100}%"></span>
        <span class="is-rejected" style:width="{((tally.rejected + tally.stale) / tally.total) * 100}%"></span>
      </div>
    {/if}
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
    {#if pendingCount || conflicts.length || review.pendingOnly}
      <button
        type="button"
        class="sv-review-only"
        aria-pressed={review.pendingOnly}
        onclick={() => review.showPendingOnly(!review.pendingOnly)}
      >
        <span class="sv-review-switch" aria-hidden="true"></span>
        Only rows with changes
      </button>
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
          <div class="sv-review-keeps">
            {#each cell as p (p.id)}
              <button type="button" class="sv-review-keep" onclick={() => review.resolveConflict(p.id)}>
                Keep {showValue(p.after)} <span class="sv-review-src">({p.source.label})</span>
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </section>
  {/if}

  {#if groups.length}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <ul class="sv-review-groups" bind:this={listEl} onkeydown={onKeydown}>
      {#each groups as g, i (g.key)}
        {@const open = openKey === g.key}
        {@const badge = BADGE[g.kind]}
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
              <span class="sv-review-badge is-{badge.tone}" title={badge.hint}>{badge.text}</span>
              <span class="sv-review-text">
                <span class="sv-review-label">{g.label}</span>
                <span class="sv-review-conf">
                  <span class="sv-review-n">{g.count}</span> {g.count === 1 ? 'change' : 'changes'}
                  {#if g.minConfidence !== undefined}
                    <span class="sv-review-meter" class:is-low={g.minConfidence < 0.6} aria-hidden="true"><span style:width={pct(g.minConfidence)}></span></span>
                    {confidenceText(g)}
                  {/if}
                </span>
              </span>
            </button>
            <div class="sv-review-acts">
              <button type="button" class="sv-review-act is-accept" disabled={busy} aria-label="Accept {g.count}: {g.label}" title="Accept {g.count}" onclick={() => acceptGroup(g)}>{@render check()}<span>Accept</span></button>
              <button type="button" class="sv-review-act" disabled={busy} aria-label="Reject {g.count}: {g.label}" title="Reject {g.count}" onclick={() => rejectGroup(g)}>{@render cross()}<span>Reject</span></button>
            </div>
          </div>
          {#if open}
            <div class="sv-review-body">
              {#if g.beforeDistribution}
                <p class="sv-review-subtitle">From</p>
                <ul class="sv-review-dist">
                  {#each g.beforeDistribution as d, j (j)}
                    <li>
                      <span class="sv-review-dist-label">{d.other ? 'other values' : showValue(d.value)}</span>
                      <span class="sv-review-dist-bar" aria-hidden="true"><span style:width="{(d.count / maxOf(g)) * 100}%"></span></span>
                      <span class="sv-review-n">{d.count}</span>
                    </li>
                  {/each}
                </ul>
              {/if}
              <p class="sv-review-subtitle">{g.kind === 'unpatterned' ? (g.count > 200 ? 'First 200' : 'Every change') : `Sample of ${g.count}`}</p>
              <ul class="sv-review-sample">
                {#each listed(g) as p (p.id)}
                  <li>
                    <span class="sv-review-pair">
                      <span class="sv-review-before">{showValue(p.before)}</span>
                      <span class="sv-review-arrow" aria-hidden="true">→</span>
                      <span class="sv-review-after">{showValue(p.after)}</span>
                    </span>
                    {#if p.confidence !== undefined || p.reason}
                      <span class="sv-review-meta">
                        {#if p.confidence !== undefined}<span class:is-low={p.confidence < 0.6}>{pct(p.confidence)}</span>{/if}
                        {#if p.reason}<span>{p.reason}</span>{/if}
                      </span>
                    {/if}
                  </li>
                {/each}
              </ul>
              <div class="sv-review-all">
                <SvButton size="sm" variant="ghost" onclick={() => showInGrid(g)}>
                  {revealed[g.key]?.id ? 'Next in grid' : 'Show in grid'}
                </SvButton>
                {#if revealed[g.key]?.hidden}<span class="sv-review-hint">{revealed[g.key]!.hidden} hidden by filters or grouping</span>{/if}
              </div>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {:else if !conflicts.length}
    <div class="sv-review-empty">
      {#if tally.total}
        <p class="sv-review-empty-title">All {tally.total} reviewed</p>
        <p class="sv-review-hint">
          {tally.accepted} accepted, {tally.rejected} rejected{#if tally.stale}, {tally.stale} not written because the cell changed{/if}.
        </p>
      {:else}
        <p class="sv-review-empty-title">No proposals yet</p>
        <p class="sv-review-hint">Edits an agent, an import or an AI helper proposes show up here, grouped by what they change.</p>
      {/if}
    </div>
  {/if}

  {#if stale.length}
    <details class="sv-review-stale">
      <summary>{stale.length} not written</summary>
      <ul>
        {#each stale as p (p.id)}
          <li><span class="sv-review-cell">Row {p.rowId}, {p.field}</span> {showValue(p.after)} <span class="sv-review-hint">{p.note}</span></li>
        {/each}
      </ul>
    </details>
  {/if}

  <p class="sv-review-live" role="status" aria-live="polite">{announce}</p>
  {#if pendingCount || announce}<p class="sv-review-hint">Ctrl+Z in the grid undoes the last decision.</p>{/if}
</section>

<style>
  .sv-review {
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    padding: 0 14px 14px;
    font-family: var(--sg-font, inherit);
    font-size: 13px;
    line-height: 1.4;
    color: var(--sg-fg, #111827);
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: var(--sg-radius, 8px);
  }
  .sv-review-head {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px 0 10px;
    background: var(--sg-bg, #fff);
    border-bottom: 1px solid var(--sg-border, #e5e7eb);
  }
  .sv-review-titlerow { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .sv-review-title { margin: 0; font-size: 15px; font-weight: 650; letter-spacing: -0.01em; }
  .sv-review-decided { font-size: 12px; color: var(--sg-muted, #6b7280); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .sv-review-progress {
    display: flex;
    height: 4px;
    border-radius: 999px;
    overflow: hidden;
    background: var(--sg-muted-bg, var(--sg-header-bg, #f3f4f6));
  }
  .sv-review-progress span { transition: width 0.3s ease; }
  .sv-review-progress .is-accepted { background: var(--sg-success, #16a34a); }
  .sv-review-progress .is-rejected { background: var(--sg-muted, #9ca3af); }
  .sv-review-count, .sv-review-hint { margin: 0; color: var(--sg-muted, #6b7280); }
  .sv-review-hint { font-size: 12px; }
  .sv-review-subtitle { margin: 10px 0 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--sg-muted, #6b7280); }
  .sv-review-all { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 2px; }
  .sv-review-only {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    align-self: flex-start;
    padding: 2px 0;
    font: inherit;
    font-size: 12.5px;
    color: var(--sg-fg, #111827);
    background: none;
    border: 0;
    cursor: pointer;
  }
  .sv-review-only:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 2px; border-radius: 4px; }
  .sv-review-switch {
    position: relative;
    width: 26px;
    height: 15px;
    flex: none;
    border-radius: 999px;
    background: var(--sg-muted-bg, #e5e7eb);
    box-shadow: inset 0 0 0 1px var(--sg-border, #d1d5db);
    transition: background 0.15s ease;
  }
  .sv-review-switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: var(--sg-bg, #fff);
    box-shadow: 0 1px 2px color-mix(in srgb, var(--sg-fg, #111827) 25%, transparent);
    transition: transform 0.15s ease;
  }
  .sv-review-only[aria-pressed='true'] .sv-review-switch { background: var(--sg-fg, #111827); box-shadow: none; }
  .sv-review-only[aria-pressed='true'] .sv-review-switch::after { transform: translateX(11px); }

  .sv-review-confirm {
    padding: 10px 12px;
    border: 1px solid color-mix(in srgb, var(--sg-warning, #d97706) 45%, var(--sg-border, #e5e7eb));
    border-radius: var(--sg-radius, 8px);
    background: color-mix(in srgb, var(--sg-warning, #d97706) 8%, var(--sg-bg, #fff));
  }
  .sv-review-confirm p { margin: 0 0 4px; font-weight: 550; }

  .sv-review-conflicts {
    padding: 10px 12px;
    border-radius: var(--sg-radius, 8px);
    background: color-mix(in srgb, var(--sg-danger, #dc2626) 6%, var(--sg-bg, #fff));
    border: 1px solid color-mix(in srgb, var(--sg-danger, #dc2626) 30%, var(--sg-border, #e5e7eb));
  }
  .sv-review-conflicts .sv-review-subtitle { margin-top: 0; color: var(--sg-danger, #dc2626); }
  .sv-review-conflict { display: flex; flex-direction: column; gap: 4px; padding: 4px 0; }
  .sv-review-keeps { display: flex; flex-wrap: wrap; gap: 6px; }
  .sv-review-cell { font-weight: 550; }
  .sv-review-keep {
    font: inherit;
    font-size: 12.5px;
    padding: 3px 9px;
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: 999px;
    background: var(--sg-bg, #fff);
    color: inherit;
    cursor: pointer;
  }
  .sv-review-keep:hover { background: var(--sg-row-hover-bg, #f9fafb); }
  .sv-review-src { color: var(--sg-muted, #6b7280); }

  .sv-review-groups { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .sv-review-group {
    border: 1px solid var(--sg-border, #e5e7eb);
    border-radius: var(--sg-radius, 8px);
    background: var(--sg-bg, #fff);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .sv-review-group.is-open { border-color: color-mix(in srgb, var(--sg-fg, #111827) 22%, var(--sg-border, #e5e7eb)); box-shadow: 0 1px 3px color-mix(in srgb, var(--sg-fg, #111827) 8%, transparent); }
  .sv-review-row { display: flex; align-items: stretch; }
  .sv-review-group-head {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: flex-start;
    gap: 9px;
    padding: 9px 10px;
    font: inherit;
    text-align: left;
    color: inherit;
    background: none;
    border: 0;
    border-radius: var(--sg-radius, 8px) 0 0 var(--sg-radius, 8px);
    cursor: pointer;
  }
  .sv-review-group-head:hover { background: var(--sg-row-hover-bg, #f9fafb); }
  .sv-review-group-head:focus-visible, .sv-review-act:focus-visible, .sv-review-keep:focus-visible {
    outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb));
    outline-offset: -2px;
  }
  /* The label wraps, at word breaks: it is what a reviewer decides on, so it
     is never cut. Count and confidence go on the line under it. */
  .sv-review-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .sv-review-label { overflow-wrap: break-word; font-weight: 550; }
  .sv-review-conf { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 6px; color: var(--sg-muted, #6b7280); font-size: 12px; }
  .sv-review-n { font-variant-numeric: tabular-nums; font-weight: 650; color: var(--sg-fg, #111827); }
  .sv-review-meter { display: inline-block; width: 36px; height: 4px; border-radius: 999px; background: var(--sg-muted-bg, #f3f4f6); overflow: hidden; }
  .sv-review-meter span { display: block; height: 100%; background: var(--sg-success, #16a34a); }
  .sv-review-meter.is-low span { background: var(--sg-warning, #d97706); }
  .sv-review-badge {
    flex: none;
    margin-top: 1px;
    font-size: 10.5px;
    font-weight: 650;
    letter-spacing: 0.02em;
    padding: 1px 7px;
    border-radius: 999px;
  }
  .sv-review-badge.is-rule { color: var(--sg-muted, #6b7280); background: var(--sg-muted-bg, #f3f4f6); }
  .sv-review-badge.is-check { color: color-mix(in srgb, var(--sg-warning, #d97706) 70%, var(--sg-fg, #111827)); background: color-mix(in srgb, var(--sg-warning, #d97706) 15%, transparent); }
  .sv-review-badge.is-each { color: color-mix(in srgb, var(--sg-danger, #dc2626) 75%, var(--sg-fg, #111827)); background: color-mix(in srgb, var(--sg-danger, #dc2626) 12%, transparent); }

  .sv-review-acts { display: flex; flex: none; border-left: 1px solid var(--sg-border, #e5e7eb); }
  .sv-review-act {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0 10px;
    font: inherit;
    font-size: 12px;
    font-weight: 550;
    border: 0;
    background: none;
    color: var(--sg-muted, #6b7280);
    cursor: pointer;
  }
  .sv-review-act + .sv-review-act { border-left: 1px solid var(--sg-border, #e5e7eb); }
  .sv-review-act:last-child { border-radius: 0 var(--sg-radius, 8px) var(--sg-radius, 8px) 0; }
  .sv-review-act svg { fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
  .sv-review-act.is-accept { color: var(--sg-fg, #111827); }
  .sv-review-act.is-accept:hover { color: var(--sg-success, #16a34a); background: color-mix(in srgb, var(--sg-success, #16a34a) 8%, transparent); }
  .sv-review-act:not(.is-accept):hover { color: var(--sg-danger, #dc2626); background: color-mix(in srgb, var(--sg-danger, #dc2626) 7%, transparent); }
  .sv-review-act:disabled { opacity: 0.45; cursor: default; }

  .sv-review-body { padding: 2px 12px 12px; border-top: 1px solid var(--sg-border, #e5e7eb); }
  .sv-review-dist, .sv-review-sample { list-style: none; margin: 0; padding: 0; }
  .sv-review-dist li { display: grid; grid-template-columns: minmax(0, 1fr) 60px auto; align-items: center; gap: 8px; padding: 2px 0; }
  .sv-review-dist-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-review-dist-bar { height: 6px; border-radius: 999px; background: var(--sg-muted-bg, #f3f4f6); overflow: hidden; }
  .sv-review-dist-bar span { display: block; height: 100%; background: color-mix(in srgb, var(--sg-fg, #111827) 35%, transparent); }
  .sv-review-sample li { display: flex; flex-direction: column; gap: 1px; padding: 5px 0; border-top: 1px dashed var(--sg-border, #e5e7eb); }
  .sv-review-sample li:first-child { border-top: 0; }
  .sv-review-pair { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
  .sv-review-before { color: var(--sg-muted, #6b7280); text-decoration: line-through; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-review-arrow { color: var(--sg-muted, #6b7280); flex: none; }
  .sv-review-after { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-review-meta { display: flex; gap: 8px; color: var(--sg-muted, #6b7280); font-size: 12px; }
  .sv-review-meta .is-low { color: color-mix(in srgb, var(--sg-warning, #d97706) 80%, var(--sg-fg, #111827)); font-weight: 600; }

  .sv-review-empty { padding: 18px 4px 6px; text-align: left; }
  .sv-review-empty-title { margin: 0 0 2px; font-weight: 650; }
  .sv-review-stale summary { cursor: pointer; font-size: 12px; font-weight: 600; color: var(--sg-muted, #6b7280); }
  .sv-review-stale ul { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
  .sv-review-live { margin: 0; min-height: 1em; font-size: 12px; font-weight: 550; }
  /* A narrow panel keeps its width for the labels: Accept and Reject become
     icons, named by their aria-label and titled on hover. */
  @container (max-width: 420px) {
    .sv-review-act { padding: 0 11px; }
    .sv-review-act span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    .sv-review-act svg { width: 16px; height: 16px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .sv-review-progress span, .sv-review-group, .sv-review-switch, .sv-review-switch::after { transition: none; }
  }
</style>
