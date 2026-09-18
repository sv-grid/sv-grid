<script lang="ts">
  /**
   * Excel's Conditional Formatting Rules Manager: the rules of the sheet
   * (or of the current selection), in priority order, each with what it
   * does, a sample and where it applies; Edit Rule (for the rules the small
   * dialog can edit), Delete Rule, Move Up, Move Down and Stop If True. The
   * list is a working copy: OK hands it back as one change, Cancel drops
   * it.
   */
  import { useSheetText } from './sheet-text'
  import { SvModal } from '@svgrid/grid'
  import { describeCf, hasStyle, cfIn, type CfRule, type CfStyledRule } from './sheet/conditional-formats'
  import { colToLetters } from './sheet/address'
  import type { Rect } from './sheet/rects'

  type Props = {
    open?: boolean
    rules: ReadonlyArray<CfRule>
    /** The selection, for the Current Selection filter. */
    selection: ReadonlyArray<Rect>
    onApply: (rules: CfRule[]) => void
    /** Edit Rule: the shell opens the small dialog on the rule and calls
     *  `replace` with the result. */
    onEdit: (rule: CfStyledRule, replace: (next: CfStyledRule) => void) => void
    onClose?: () => void
  }

  let { open = $bindable(false), rules, selection, onApply, onEdit, onClose }: Props = $props()
  const t = useSheetText()

  let working = $state<CfRule[]>([])
  let scope = $state<'sheet' | 'selection'>('sheet')
  let selected = $state<string | null>(null)

  $effect(() => {
    if (!open) return
    // Read the props, write the state: reading `working` back here would
    // make the effect depend on what it just wrote and run without end.
    const copy = rules.map((r) => ({ ...r, rects: r.rects.map((x) => [...x] as unknown as Rect) }))
    working = copy
    scope = 'sheet'
    selected = copy[0]?.id ?? null
  })

  const shown = $derived(scope === 'sheet' ? working : cfIn(working, selection))
  const current = $derived(working.find((r) => r.id === selected) ?? null)
  const index = $derived(current ? working.indexOf(current) : -1)

  const address = (rects: ReadonlyArray<Rect>) =>
    rects.map(([r1, c1, r2, c2]) => {
      const a = `${colToLetters(c1)}${r1 + 1}`
      const b = `${colToLetters(c2)}${r2 + 1}`
      return a === b ? a : `${a}:${b}`
    }).join(', ')

  const sample = (rule: CfRule): { background?: string; color?: string; text: string } => {
    if (hasStyle(rule)) return { background: rule.style.fill, color: rule.style.color, text: 'AaBbCcYyZz' }
    if (rule.kind === 'dataBar') return { background: `linear-gradient(90deg, ${rule.color} 60%, transparent 60%)`, text: '' }
    if (rule.kind === 'colorScale') return { background: `linear-gradient(90deg, ${rule.colors.join(', ')})`, text: '' }
    return { text: t('manageRules.iconSet') }
  }

  function remove() {
    if (index < 0) return
    working = working.filter((_, i) => i !== index)
    selected = working[Math.min(index, working.length - 1)]?.id ?? null
  }
  function move(delta: -1 | 1) {
    if (index < 0) return
    const to = index + delta
    if (to < 0 || to >= working.length) return
    const next = working.slice()
    const [rule] = next.splice(index, 1)
    next.splice(to, 0, rule!)
    working = next
  }
  function toggleStop(rule: CfRule) {
    working = working.map((r) => (r.id === rule.id ? { ...r, stopIfTrue: !r.stopIfTrue } : r))
  }
  function edit() {
    const rule = current
    if (!rule || !hasStyle(rule)) return
    onEdit(rule, (next) => {
      working = working.map((r) => (r.id === rule.id ? next : r))
    })
  }
  function ok() {
    onApply(working)
    open = false
    onClose?.()
  }
  function close() {
    open = false
    onClose?.()
  }
</script>

<SvModal bind:open onClose={onClose} title={t('manageRules.title')} size="md" width={640}>
  <div class="sv-sheet-dialog manage">
    <label class="field auto">
      <span>{t('manageRules.showFor')}</span>
      <select bind:value={scope}>
        <option value="sheet">{t('manageRules.thisSheet')}</option>
        <option value="selection">{t('manageRules.selection')}</option>
      </select>
    </label>
    <div class="toolbar">
      <button type="button" class="btn" onclick={edit} disabled={!current || !hasStyle(current)}>{t('manageRules.editRule')}</button>
      <button type="button" class="btn" onclick={remove} disabled={!current}>{t('manageRules.deleteRule')}</button>
      <button type="button" class="btn" onclick={() => move(-1)} disabled={index <= 0} aria-label={t('manageRules.moveUp')} title={t('manageRules.moveUp')}>&#9650;</button>
      <button type="button" class="btn" onclick={() => move(1)} disabled={index < 0 || index >= working.length - 1} aria-label={t('manageRules.moveDown')} title={t('manageRules.moveDown')}>&#9660;</button>
    </div>
    <div class="list" role="grid" aria-label={t('manageRules.rules')}>
      <div class="head" role="row">
        <span role="columnheader">{t('manageRules.rule')}</span>
        <span role="columnheader">{t('manageRules.format')}</span>
        <span role="columnheader">{t('manageRules.appliesTo')}</span>
        <span role="columnheader">{t('manageRules.stopIfTrue')}</span>
      </div>
      {#if shown.length === 0}
        <div class="empty">{t(scope === 'sheet' ? 'manageRules.noneOnSheet' : 'manageRules.noneInSelection')}</div>
      {/if}
      {#each shown as rule (rule.id)}
        {@const s = sample(rule)}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
        <div class="rule" class:on={rule.id === selected} role="row" aria-selected={rule.id === selected} onclick={() => (selected = rule.id)}>
          <span role="gridcell" class="what">{describeCf(rule)}</span>
          <span role="gridcell" class="sample" style:background={s.background ?? 'transparent'} style:color={s.color ?? 'inherit'}>{s.text}</span>
          <span role="gridcell" class="where">{address(rule.rects)}</span>
          <span role="gridcell" class="stop"><input type="checkbox" checked={!!rule.stopIfTrue} aria-label={t('manageRules.stopIfTrue')} onchange={() => toggleStop(rule)} onclick={(e) => e.stopPropagation()} /></span>
        </div>
      {/each}
    </div>
  </div>
  {#snippet footer()}
    <div class="sv-sheet-dialog-buttons">
      <button type="button" class="btn primary" onclick={ok}>{t('ok')}</button>
      <button type="button" class="btn" onclick={close}>{t('cancel')}</button>
    </div>
  {/snippet}
</SvModal>

<style>
  .toolbar { display: flex; gap: 6px; }
  .toolbar .btn {
    height: 26px;
    padding: 0 10px;
    font: inherit;
    color: inherit;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: var(--sg-radius, 3px);
    cursor: pointer;
  }
  .toolbar .btn:hover:not(:disabled) { background: var(--sg-row-hover-bg, #f5f5f5); }
  .toolbar .btn:disabled { opacity: 0.5; cursor: default; }
  .list {
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: var(--sg-radius, 3px);
    max-height: 260px;
    overflow-y: auto;
  }
  .head, .rule {
    display: grid;
    grid-template-columns: 1fr 120px 130px 84px;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
  }
  .head {
    font-weight: 600;
    color: var(--sg-muted, #616161);
    background: var(--sg-bg-subtle, #f3f3f3);
    border-bottom: 1px solid var(--sg-border, #d1d1d1);
  }
  .rule { cursor: default; }
  .rule.on { background: var(--sg-selection-bg, rgba(16, 124, 65, 0.12)); }
  .rule .sample {
    padding: 2px 6px;
    border: 1px solid var(--sg-border, #d1d1d1);
    text-align: center;
    min-height: 20px;
  }
  .rule .where { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rule .stop { text-align: center; }
  .empty { padding: 10px; color: var(--sg-muted, #616161); }
</style>
