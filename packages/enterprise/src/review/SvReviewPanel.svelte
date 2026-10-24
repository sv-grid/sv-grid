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
  import { fill, reviewMessages, type ReviewMessages } from './messages'
  import type { Review, ReviewOutcome } from './model.svelte'
  import type { Proposal, ProposalGroup } from './types'

  let {
    review,
    title,
    confirmOver = 50,
    onDecide,
    messages,
  }: {
    review: Review<any>
    /** The heading; default `messages.title`. */
    title?: string
    /** Wording for this panel, over the review's own `messages`. */
    messages?: Partial<ReviewMessages>
    /** Ask before deciding more than this many proposals at once. */
    confirmOver?: number
    /** Called after each decision with what happened. */
    onDecide?: (outcome: ReviewOutcome) => void
  } = $props()

  const m = $derived(reviewMessages(review.messages, messages))
  const heading = $derived(title ?? m.title)
  /** A message with `{count}` split out, so the number can be set in bold. */
  const around = (template: string) => {
    const at = template.indexOf('{count}')
    return at < 0 ? [template, ''] : [template.slice(0, at), template.slice(at + 7)]
  }
  const show = (v: unknown) => showValue(v, m.empty)
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

  const badgeOf = (kind: ProposalGroup['kind']): { text: string; tone: 'rule' | 'check' | 'each'; hint: string } => {
    switch (kind) {
      case 'whitespace': case 'case': case 'format': case 'scale':
        return { text: m.badgeRule, tone: 'rule', hint: m.hintRule }
      case 'same-mapping':
        return { text: m.badgeCheck, tone: 'check', hint: m.hintMapping }
      case 'fill-empty':
        return { text: m.badgeCheck, tone: 'check', hint: m.hintFill }
      case 'constant-target':
        return { text: m.badgeCheck, tone: 'check', hint: m.hintConstant }
      case 'unpatterned':
        return { text: m.badgeEach, tone: 'each', hint: m.hintEach }
    }
  }

  function say(out: ReviewOutcome) {
    const parts: string[] = []
    const add = (template: string, count: number) => count && parts.push(fill(template, { count }))
    add(m.announceAccepted, out.accepted.length)
    add(m.announceRejected, out.rejected.length)
    add(m.announceStale, out.stale.length)
    add(m.announceCommittedStale, out.committedStale.length)
    add(m.announceSkipped, out.skipped.length)
    if (out.error) parts.push(fill(m.announceNotSaved, { error: out.error instanceof Error ? out.error.message : String(out.error) }))
    announce = parts.join(', ') || m.announceNothing
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
    guard(fill(m.confirmAcceptGroup, { count: g.count, label: g.label }), g.count, () => void acceptIds(g.ids))
  const rejectGroup = (g: ProposalGroup) =>
    guard(fill(m.confirmRejectGroup, { count: g.count, label: g.label }), g.count, () => say(review.reject(g.ids)))

  /** The groups whose every member is proven to follow its rule. */
  const ruleGroups = $derived(groups.filter((g) => g.rule))
  const ruleCount = $derived(ruleGroups.reduce((n, g) => n + g.count, 0))
  function acceptRules() {
    const ids = ruleGroups.flatMap((g) => g.ids)
    guard(fill(m.confirmAcceptRules, { groups: ruleGroups.length, count: ids.length }), ids.length, () => void acceptIds(ids))
  }

  function acceptAll() {
    const ids = groups.flatMap((g) => g.ids)
    guard(fill(m.confirmAcceptAll, { count: ids.length }), ids.length, () => void acceptIds(ids))
  }
  function rejectAll() {
    const ids = groups.flatMap((g) => g.ids)
    guard(fill(m.confirmRejectAll, { count: ids.length }), ids.length, () => say(review.reject(ids)))
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
    return g.minConfidence === g.avgConfidence ? fill(m.sure, { pct: pct(g.minConfidence) }) : fill(m.sureRange, { min: pct(g.minConfidence), avg: pct(g.avgConfidence!) })
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

<section class="sv-review" aria-label={heading}>
  <header class="sv-review-head">
    <div class="sv-review-titlerow">
      <h2 class="sv-review-title">{heading}</h2>
      {#if tally.total}<span class="sv-review-decided">{fill(m.decided, { decided: decidedCount, total: tally.total })}</span>{/if}
    </div>
    {#if tally.total}
      <div
        class="sv-review-progress"
        role="progressbar"
        aria-label={m.decidedLabel}
        aria-valuemin={0}
        aria-valuemax={tally.total}
        aria-valuenow={decidedCount}
      >
        <span class="is-accepted" style:width="{(tally.accepted / tally.total) * 100}%"></span>
        <span class="is-rejected" style:width="{((tally.rejected + tally.stale) / tally.total) * 100}%"></span>
      </div>
    {/if}
    <p class="sv-review-count">
      {pendingCount ? fill(groups.length === 1 ? m.pendingInOneGroup : m.pendingInGroups, { count: pendingCount, groups: groups.length }) : m.nothingPending}{conflicts.length ? fill(m.inConflict, { count: conflicts.length }) : ''}
    </p>
    {#if pendingCount}
      <div class="sv-review-all">
        <SvButton size="sm" disabled={busy || conflicts.length > 0} onclick={acceptAll}>{m.acceptAll}</SvButton>
        {#if ruleGroups.length && ruleGroups.length < groups.length}
          <SvButton size="sm" variant="outline" disabled={busy} onclick={acceptRules}>{fill(m.acceptRuleGroups, { count: ruleCount })}</SvButton>
        {/if}
        <SvButton size="sm" variant="outline" disabled={busy} onclick={rejectAll}>{m.rejectAll}</SvButton>
      </div>
      {#if conflicts.length}<p class="sv-review-hint">{m.resolveFirst}</p>{/if}
    {/if}
    {#if pendingCount || conflicts.length || review.pendingOnly}
      <button
        type="button"
        class="sv-review-only"
        aria-pressed={review.pendingOnly}
        onclick={() => review.showPendingOnly(!review.pendingOnly)}
      >
        <span class="sv-review-switch" aria-hidden="true"></span>
        {m.onlyRowsWithChanges}
      </button>
    {/if}
  </header>

  {#if confirming}
    <div class="sv-review-confirm" role="alertdialog" aria-label={confirming.label}>
      <p>{confirming.label}</p>
      <div class="sv-review-all">
        <SvButton size="sm" onclick={confirmYes}>{fill(m.confirmYes, { count: confirming.count })}</SvButton>
        <SvButton size="sm" variant="ghost" onclick={() => (confirming = null)}>{m.cancel}</SvButton>
      </div>
    </div>
  {/if}

  {#if conflicts.length}
    <section class="sv-review-conflicts" aria-label={m.conflictsTitle}>
      <h3 class="sv-review-subtitle">{m.conflictsTitle}</h3>
      {#each conflictCells as cell (cell[0].id)}
        <div class="sv-review-conflict">
          <span class="sv-review-cell">{fill(m.conflictCell, { row: cell[0].rowId, field: cell[0].field, value: show(cell[0].before) })}</span>
          <div class="sv-review-keeps">
            {#each cell as p (p.id)}
              <button type="button" class="sv-review-keep" onclick={() => review.resolveConflict(p.id)}>
                {fill(m.keep, { value: show(p.after) })} <span class="sv-review-src">({p.source.label})</span>
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
        {@const badge = badgeOf(g.kind)}
        {@const [pre, post] = around(g.count === 1 ? m.oneChange : m.changes)}
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
                  {pre}<span class="sv-review-n">{g.count}</span>{post}
                  {#if g.minConfidence !== undefined}
                    <span class="sv-review-meter" class:is-low={g.minConfidence < 0.6} aria-hidden="true"><span style:width={pct(g.minConfidence)}></span></span>
                    {confidenceText(g)}
                  {/if}
                </span>
              </span>
            </button>
            <div class="sv-review-acts">
              <button type="button" class="sv-review-act is-accept" disabled={busy} aria-label={fill(m.acceptGroupLabel, { count: g.count, label: g.label })} title={fill(m.acceptGroupLabel, { count: g.count, label: g.label })} onclick={() => acceptGroup(g)}>{@render check()}<span>{m.accept}</span></button>
              <button type="button" class="sv-review-act" disabled={busy} aria-label={fill(m.rejectGroupLabel, { count: g.count, label: g.label })} title={fill(m.rejectGroupLabel, { count: g.count, label: g.label })} onclick={() => rejectGroup(g)}>{@render cross()}<span>{m.reject}</span></button>
            </div>
          </div>
          {#if open}
            <div class="sv-review-body">
              {#if g.beforeDistribution}
                <p class="sv-review-subtitle">{m.from}</p>
                <ul class="sv-review-dist">
                  {#each g.beforeDistribution as d, j (j)}
                    <li>
                      <span class="sv-review-dist-label">{d.other ? m.otherValues : show(d.value)}</span>
                      <span class="sv-review-dist-bar" aria-hidden="true"><span style:width="{(d.count / maxOf(g)) * 100}%"></span></span>
                      <span class="sv-review-n">{d.count}</span>
                    </li>
                  {/each}
                </ul>
              {/if}
              <p class="sv-review-subtitle">{g.kind === 'unpatterned' ? (g.count > 200 ? fill(m.firstN, { count: 200 }) : m.everyChange) : fill(m.sampleOf, { count: g.count })}</p>
              <ul class="sv-review-sample">
                {#each listed(g) as p (p.id)}
                  <li>
                    <button type="button" class="sv-review-sample-row" title={fill(m.showRow, { row: p.rowId })} onclick={() => review.reveal([p.id])}>
                    <span class="sv-review-pair">
                      <span class="sv-review-before">{show(p.before)}</span>
                      <span class="sv-review-arrow" aria-hidden="true">→</span>
                      <span class="sv-review-after">{show(p.after)}</span>
                    </span>
                    {#if p.confidence !== undefined || p.reason}
                      <span class="sv-review-meta">
                        {#if p.confidence !== undefined}<span class:is-low={p.confidence < 0.6}>{pct(p.confidence)}</span>{/if}
                        {#if p.reason}<span>{p.reason}</span>{/if}
                      </span>
                    {/if}
                    </button>
                  </li>
                {/each}
              </ul>
              <div class="sv-review-all">
                <SvButton size="sm" variant="ghost" onclick={() => showInGrid(g)}>
                  {revealed[g.key]?.id ? m.nextInGrid : m.showInGrid}
                </SvButton>
                {#if revealed[g.key]?.hidden}<span class="sv-review-hint">{fill(m.hiddenRows, { count: revealed[g.key]!.hidden })}</span>{/if}
              </div>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {:else if !conflicts.length}
    <div class="sv-review-empty">
      {#if tally.total}
        <p class="sv-review-empty-title">{fill(m.allReviewed, { count: tally.total })}</p>
        <p class="sv-review-hint">
          {fill(m.reviewedSummary, { accepted: tally.accepted, rejected: tally.rejected })}{tally.stale ? fill(m.reviewedStale, { count: tally.stale }) : ''}.
        </p>
      {:else}
        <p class="sv-review-empty-title">{m.noProposals}</p>
        <p class="sv-review-hint">{m.noProposalsHint}</p>
      {/if}
    </div>
  {/if}

  {#if stale.length}
    <details class="sv-review-stale">
      <summary>{fill(m.notWritten, { count: stale.length })}</summary>
      <ul>
        {#each stale as p (p.id)}
          <li><span class="sv-review-cell">{fill(m.rowField, { row: p.rowId, field: p.field })}</span> {show(p.after)} <span class="sv-review-hint">{p.note}</span></li>
        {/each}
      </ul>
    </details>
  {/if}

  <p class="sv-review-live" role="status" aria-live="polite">{announce}</p>
  {#if pendingCount || announce}<p class="sv-review-hint">{m.undoHint}</p>{/if}
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
    background: color-mix(in srgb, var(--sg-fg, #111827) 12%, transparent);
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
    background: color-mix(in srgb, var(--sg-fg, #111827) 12%, transparent);
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
  /* Tracks and quiet fills mix the text colour, so they read in any theme,
     light or dark, without relying on a token the theme may not define. */
  /* The label wraps, at word breaks: it is what a reviewer decides on, so it
     is never cut. Count and confidence go on the line under it. */
  .sv-review-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .sv-review-label { overflow-wrap: break-word; font-weight: 550; }
  .sv-review-conf { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 6px; color: var(--sg-muted, #6b7280); font-size: 12px; }
  .sv-review-n { font-variant-numeric: tabular-nums; font-weight: 650; color: var(--sg-fg, #111827); }
  .sv-review-meter { display: inline-block; width: 36px; height: 4px; border-radius: 999px; background: color-mix(in srgb, var(--sg-fg, #111827) 12%, transparent); overflow: hidden; }
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
  .sv-review-badge.is-rule { color: var(--sg-muted, #6b7280); background: color-mix(in srgb, var(--sg-fg, #111827) 8%, transparent); }
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
  .sv-review-dist-bar { height: 6px; border-radius: 999px; background: color-mix(in srgb, var(--sg-fg, #111827) 12%, transparent); overflow: hidden; }
  .sv-review-dist-bar span { display: block; height: 100%; background: color-mix(in srgb, var(--sg-fg, #111827) 35%, transparent); }
  .sv-review-sample li { border-top: 1px dashed var(--sg-border, #e5e7eb); }
  /* A sample line is a button: a click shows that row in the grid. */
  .sv-review-sample-row {
    display: flex;
    flex-direction: column;
    gap: 1px;
    width: 100%;
    padding: 5px 4px;
    margin: 0 -4px;
    font: inherit;
    text-align: left;
    color: inherit;
    background: none;
    border: 0;
    border-radius: 4px;
    cursor: pointer;
  }
  .sv-review-sample-row:hover { background: var(--sg-row-hover-bg, #f9fafb); }
  .sv-review-sample-row:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: -2px; }
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
