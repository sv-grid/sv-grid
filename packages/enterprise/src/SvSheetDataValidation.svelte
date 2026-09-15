<script lang="ts">
  /**
   * Excel's Data Validation dialog, the two tabs with something behind them:
   * Settings (Allow, Data, the bounds or the source, Ignore blank, In-cell
   * dropdown) and Error Alert (Style, Title, Message). It opens on the rule
   * at the active cell and, on OK, hands back one rule for the shell to put
   * over the selection; Clear All removes the validation from the selection.
   */
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

  type Tab = 'settings' | 'alert'
  let tab = $state<Tab>('settings')

  const ALLOWS: ReadonlyArray<{ id: ValidationAllow; label: string }> = [
    { id: 'any', label: 'Any value' },
    { id: 'whole', label: 'Whole number' },
    { id: 'decimal', label: 'Decimal' },
    { id: 'list', label: 'List' },
    { id: 'date', label: 'Date' },
    { id: 'textLength', label: 'Text length' },
    { id: 'custom', label: 'Custom' },
  ]
  const OPERATORS = Object.entries(OPERATOR_LABELS) as Array<[ValidationOperator, string]>

  let allow = $state<ValidationAllow>('any')
  let operator = $state<ValidationOperator>('between')
  let value1 = $state('')
  let value2 = $state('')
  let ignoreBlank = $state(true)
  let inCellDropdown = $state(true)
  let style = $state<'stop' | 'warning'>('stop')
  let title = $state('')
  let message = $state('')
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
    queueMicrotask(() => first?.focus())
  })

  const bounded = $derived(allow === 'whole' || allow === 'decimal' || allow === 'date' || allow === 'textLength')
  const twoBounds = $derived(operator === 'between' || operator === 'notBetween')
  const firstLabel = $derived(
    allow === 'list' ? 'Source:'
      : allow === 'custom' ? 'Formula:'
      : twoBounds ? (allow === 'date' ? 'Start date:' : 'Minimum:')
      : allow === 'date' ? 'Date:' : allow === 'textLength' ? 'Length:' : 'Value:',
  )
  const secondLabel = $derived(allow === 'date' ? 'End date:' : 'Maximum:')
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

<SvModal bind:open onClose={onClose} title="Data Validation" size="sm" width={400}>
  <form class="sv-sheet-dialog validation" onsubmit={(e) => { e.preventDefault(); ok() }}>
    <div class="where">{address}</div>
    <div class="tabs" role="tablist" aria-label="Data Validation tabs">
      {#each [['settings', 'Settings'], ['alert', 'Error Alert']] as [id, label] (id)}
        <button type="button" role="tab" class="tab" class:on={tab === id} aria-selected={tab === id} onclick={() => (tab = id as Tab)}>{label}</button>
      {/each}
    </div>
    <div class="panel" role="tabpanel">
      {#if tab === 'settings'}
        <div class="lead">Validation criteria</div>
        <label class="field">
          <span>Allow:</span>
          <select bind:this={first} bind:value={allow}>
            {#each ALLOWS as a (a.id)}<option value={a.id}>{a.label}</option>{/each}
          </select>
        </label>
        {#if bounded}
          <label class="field">
            <span>Data:</span>
            <select bind:value={operator}>
              {#each OPERATORS as [id, label] (id)}<option value={id}>{label}</option>{/each}
            </select>
          </label>
        {/if}
        {#if allow !== 'any'}
          <label class="field">
            <span>{firstLabel}</span>
            <input type="text" bind:value={value1} spellcheck="false" placeholder={allow === 'list' ? 'Red, Green, Blue or =$D$1:$D$5' : allow === 'custom' ? '=B1<>""' : ''} />
          </label>
        {/if}
        {#if bounded && twoBounds}
          <label class="field">
            <span>{secondLabel}</span>
            <input type="text" bind:value={value2} spellcheck="false" />
          </label>
        {/if}
        <div class="checks">
          <label class="check"><input type="checkbox" bind:checked={ignoreBlank} /> Ignore blank</label>
          {#if allow === 'list'}
            <label class="check"><input type="checkbox" bind:checked={inCellDropdown} /> In-cell dropdown</label>
          {/if}
        </div>
        {#if allow === 'custom'}
          <p class="hint">Written for the top-left cell of the selection; it moves with each cell, as a copied formula would. TRUE (or a number other than 0) allows the entry.</p>
        {:else if allow === 'list'}
          <p class="hint">A comma-separated list, or a range or a defined name starting with =.</p>
        {:else if allow !== 'any'}
          <p class="hint">A bound can be a formula, so =$B$1 follows B1.</p>
        {/if}
      {:else}
        <div class="lead">When the user enters invalid data, show this alert:</div>
        <label class="field">
          <span>Style:</span>
          <select bind:value={style}>
            <option value="stop">Stop</option>
            <option value="warning">Warning</option>
          </select>
        </label>
        <label class="field">
          <span>Title:</span>
          <input type="text" bind:value={title} />
        </label>
        <label class="field message">
          <span>Error message:</span>
          <textarea rows="4" bind:value={message}></textarea>
        </label>
        <p class="hint">Stop refuses the entry and offers Retry; Warning asks whether to keep it anyway.</p>
      {/if}
    </div>
  </form>
  {#snippet footer()}
    <div class="sv-sheet-dialog-buttons">
      <button type="button" class="btn" onclick={clearAll}>Clear All</button>
      <span class="spacer"></span>
      <button type="button" class="btn primary" onclick={ok} disabled={!valid}>OK</button>
      <button type="button" class="btn" onclick={close}>Cancel</button>
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
