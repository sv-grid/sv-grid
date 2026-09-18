<script lang="ts">
  /**
   * Excel's Data Validation dialog, its three tabs: Settings (Allow, Data,
   * the bounds or the source, Ignore blank, In-cell dropdown), Input
   * Message (shown under the cell while it is selected) and Error Alert
   * (Style, Title, Message). It opens on the rule
   * at the active cell and, on OK, hands back one rule for the shell to put
   * over the selection; Clear All removes the validation from the selection.
   */
  import { useSheetText } from './sheet-text'
  import { SvModal } from '@svgrid/grid'
  import {
    OPERATOR_LABELS,
    type ValidationRule, type ValidationAllow, type ValidationOperator, type ValidationSpec,
  } from './sheet/validation'

  type Props = {
    open?: boolean
    /** The rule at the active cell, what the dialog opens on. */
    rule: ValidationRule | undefined
    /** The selection as A1, for the heading. */
    address: string
    onApply: (spec: ValidationSpec) => void
    onClear: () => void
    onClose?: () => void
  }

  let { open = $bindable(false), rule, address, onApply, onClear, onClose }: Props = $props()
  const t = useSheetText()

  type Tab = 'settings' | 'input' | 'alert'
  let tab = $state<Tab>('settings')

  const ALLOWS: ReadonlyArray<{ id: ValidationAllow; label: string }> = [
    { id: 'any', label: 'validation.allow.any' },
    { id: 'whole', label: 'validation.allow.whole' },
    { id: 'decimal', label: 'validation.allow.decimal' },
    { id: 'list', label: 'validation.allow.list' },
    { id: 'date', label: 'validation.allow.date' },
    { id: 'textLength', label: 'validation.allow.textLength' },
    { id: 'custom', label: 'validation.allow.custom' },
  ]
  const OPERATORS = Object.keys(OPERATOR_LABELS) as ValidationOperator[]

  let allow = $state<ValidationAllow>('any')
  let operator = $state<ValidationOperator>('between')
  let value1 = $state('')
  let value2 = $state('')
  let ignoreBlank = $state(true)
  let inCellDropdown = $state(true)
  let style = $state<'stop' | 'warning'>('stop')
  let title = $state('')
  let message = $state('')
  let showInput = $state(true)
  let inputTitle = $state('')
  let inputMessage = $state('')
  let first = $state<HTMLSelectElement | null>(null)

  $effect(() => {
    if (!open) return
    tab = 'settings'
    allow = rule?.allow ?? 'any'
    operator = rule?.operator ?? 'between'
    value1 = rule?.value1 ?? ''
    value2 = rule?.value2 ?? ''
    ignoreBlank = rule?.ignoreBlank ?? true
    inCellDropdown = rule?.inCellDropdown ?? true
    style = rule?.alert.style ?? 'stop'
    title = rule?.alert.title ?? ''
    message = rule?.alert.message ?? ''
    showInput = rule ? rule.input !== undefined : true
    inputTitle = rule?.input?.title ?? ''
    inputMessage = rule?.input?.message ?? ''
    queueMicrotask(() => first?.focus())
  })

  const bounded = $derived(allow === 'whole' || allow === 'decimal' || allow === 'date' || allow === 'textLength')
  const twoBounds = $derived(operator === 'between' || operator === 'notBetween')
  const firstLabel = $derived(
    allow === 'list' ? t('validation.source')
      : allow === 'custom' ? t('validation.formula')
      : twoBounds ? t(allow === 'date' ? 'validation.startDate' : 'validation.minimum')
      : t(allow === 'date' ? 'validation.date' : allow === 'textLength' ? 'validation.length' : 'validation.value'),
  )
  const secondLabel = $derived(t(allow === 'date' ? 'validation.endDate' : 'validation.maximum'))
  const valid = $derived(
    allow === 'any'
      || (allow === 'list' && value1.trim() !== '')
      || (allow === 'custom' && value1.trim() !== '')
      || (bounded && value1.trim() !== '' && (!twoBounds || value2.trim() !== '')),
  )

  function ok() {
    if (!valid) return
    const spec: ValidationSpec = {
      allow,
      ignoreBlank,
      inCellDropdown: allow === 'list' ? inCellDropdown : false,
      alert: { style, title: title.trim() || undefined, message: message.trim() || undefined },
    }
    // An input message exists when the box is on and there is text to show.
    if (showInput && (inputTitle.trim() || inputMessage.trim())) {
      spec.input = { title: inputTitle.trim() || undefined, message: inputMessage.trim() || undefined }
    }
    if (bounded) {
      spec.operator = operator
      spec.value1 = value1.trim()
      if (twoBounds) spec.value2 = value2.trim()
    } else if (allow === 'list' || allow === 'custom') {
      spec.value1 = value1.trim()
    }
    onApply(spec)
    open = false
    onClose?.()
  }

  function clearAll() {
    onClear()
    open = false
    onClose?.()
  }

  function close() {
    open = false
    onClose?.()
  }
</script>

<SvModal bind:open onClose={onClose} title={t('validation.title')} size="sm" width={400}>
  <form class="sv-sheet-dialog validation" onsubmit={(e) => { e.preventDefault(); ok() }}>
    <div class="where">{address}</div>
    <div class="tabs" role="tablist" aria-label={t('validation.tabs')}>
      {#each ['settings', 'input', 'alert'] as id (id)}
        <button type="button" role="tab" class="tab" class:on={tab === id} aria-selected={tab === id} onclick={() => (tab = id as Tab)}>{t(`validation.tab.${id}`)}</button>
      {/each}
    </div>
    <div class="panel" role="tabpanel">
      {#if tab === 'settings'}
        <div class="lead">{t('validation.criteria')}</div>
        <label class="field">
          <span>{t('validation.allow')}</span>
          <select bind:this={first} bind:value={allow}>
            {#each ALLOWS as a (a.id)}<option value={a.id}>{t(a.label)}</option>{/each}
          </select>
        </label>
        {#if bounded}
          <label class="field">
            <span>{t('validation.data')}</span>
            <select bind:value={operator}>
              {#each OPERATORS as id (id)}<option value={id}>{t(`validation.operator.${id}`)}</option>{/each}
            </select>
          </label>
        {/if}
        {#if allow !== 'any'}
          <label class="field">
            <span>{firstLabel}</span>
            <input type="text" bind:value={value1} spellcheck="false" placeholder={allow === 'list' ? t('validation.listPlaceholder') : allow === 'custom' ? '=B1<>""' : ''} />
          </label>
        {/if}
        {#if bounded && twoBounds}
          <label class="field">
            <span>{secondLabel}</span>
            <input type="text" bind:value={value2} spellcheck="false" />
          </label>
        {/if}
        <div class="checks">
          <label class="check"><input type="checkbox" bind:checked={ignoreBlank} /> {t('validation.ignoreBlank')}</label>
          {#if allow === 'list'}
            <label class="check"><input type="checkbox" bind:checked={inCellDropdown} /> {t('validation.inCellDropdown')}</label>
          {/if}
        </div>
        {#if allow === 'custom'}
          <p class="hint">{t('validation.customHint')}</p>
        {:else if allow === 'list'}
          <p class="hint">{t('validation.listHint')}</p>
        {:else if allow !== 'any'}
          <p class="hint">{t('validation.boundHint')}</p>
        {/if}
      {:else if tab === 'input'}
        <label class="check"><input type="checkbox" bind:checked={showInput} /> {t('validation.showInput')}</label>
        <div class="lead">{t('validation.inputLead')}</div>
        <label class="field">
          <span>{t('validation.inputTitle')}</span>
          <input type="text" bind:value={inputTitle} disabled={!showInput} />
        </label>
        <label class="field message">
          <span>{t('validation.inputMessage')}</span>
          <textarea rows="4" bind:value={inputMessage} disabled={!showInput}></textarea>
        </label>
      {:else}
        <div class="lead">{t('validation.alertLead')}</div>
        <label class="field">
          <span>{t('validation.style')}</span>
          <select bind:value={style}>
            <option value="stop">{t('validation.stop')}</option>
            <option value="warning">{t('validation.warning')}</option>
          </select>
        </label>
        <label class="field">
          <span>{t('validation.errorTitle')}</span>
          <input type="text" bind:value={title} />
        </label>
        <label class="field message">
          <span>{t('validation.errorMessage')}</span>
          <textarea rows="4" bind:value={message}></textarea>
        </label>
        <p class="hint">{t('validation.alertHint')}</p>
      {/if}
    </div>
  </form>
  {#snippet footer()}
    <div class="sv-sheet-dialog-buttons">
      <button type="button" class="btn" onclick={clearAll}>{t('validation.clearAll')}</button>
      <span class="spacer"></span>
      <button type="button" class="btn primary" onclick={ok} disabled={!valid}>{t('ok')}</button>
      <button type="button" class="btn" onclick={close}>{t('cancel')}</button>
    </div>
  {/snippet}
</SvModal>

<style>
  .where { color: var(--sg-muted, #616161); }
  .tabs {
    display: flex;
    gap: 2px;
    border-bottom: 1px solid var(--sg-border, #d1d1d1);
  }
  .tab {
    padding: 5px 12px;
    font: inherit;
    font-size: 13px;
    color: var(--sg-muted, #616161);
    background: transparent;
    border: 1px solid transparent;
    border-bottom: 0;
    border-radius: var(--sg-radius, 3px) var(--sg-radius, 3px) 0 0;
    cursor: pointer;
  }
  .tab:hover { color: var(--sg-fg, #242424); }
  .tab.on {
    color: var(--sg-fg, #242424);
    background: var(--sg-bg, #fff);
    border-color: var(--sg-border, #d1d1d1);
    margin-bottom: -1px;
  }
  .panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 220px;
    padding-top: 4px;
  }
  .lead { font-weight: 600; }
  .hint { margin: 0; color: var(--sg-muted, #616161); }
  .field.message { align-items: start; }
  textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 4px 6px;
    font: inherit;
    color: inherit;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: var(--sg-radius, 3px);
    resize: vertical;
  }
  textarea:focus {
    outline: none;
    border-color: var(--sg-accent, #217346);
    box-shadow: 0 0 0 1px var(--sg-accent, #217346);
  }
  .spacer { flex: 1; }
</style>
