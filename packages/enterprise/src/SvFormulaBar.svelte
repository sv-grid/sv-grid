<script lang="ts">
  /**
   * The formula bar: a Name Box showing (and accepting) the active cell's
   * address, and an input holding the cell's RAW text rather than its computed
   * value.
   *
   * That split is the whole point. The grid shows `1,234.50`; the bar shows
   * `=B2*C2`. Editing in the grid would otherwise mean editing the result.
   *
   * The bar owns no grid state. It reads the active cell and the raw text
   * through props and reports edits through `onCommit`, so it works over a
   * `<SvGrid>`, a plain array, or a workbook with several sheets.
   */
  import {
    suggestFunctions,
    applySuggestion,
    signatureAt,
    type FunctionSuggestion,
  } from './sheet/autocomplete'
  import { parseA1, formatA1 } from './sheet/address'

  type Props = {
    /** Active cell in display coordinates, or null when nothing is active. */
    active: { rowIndex: number; colIndex: number } | null
    /** The cell's raw text: a formula as typed, or the literal value. */
    value: string
    /** Called when the user commits with Enter or by leaving the field. */
    onCommit: (text: string) => void
    /** Called when the user types an address into the Name Box. */
    onNavigate?: (cell: { rowIndex: number; colIndex: number }) => void
    /** Named ranges for the Name Box dropdown. */
    names?: ReadonlyArray<{ name: string; refersTo: string }>
    onSelectName?: (name: string) => void
    showNameBox?: boolean
    autocomplete?: boolean
    disabled?: boolean
  }

  let {
    active,
    value = '',
    onCommit,
    onNavigate,
    names = [],
    onSelectName,
    showNameBox = true,
    autocomplete = true,
    disabled = false,
  }: Props = $props()

  let draft = $state('')
  let editing = $state(false)
  let caret = $state(0)
  let highlighted = $state(0)
  let input = $state<HTMLInputElement | null>(null)
  let nameBoxText = $state('')

  // Follow the active cell while the user is not mid-edit. Clobbering the
  // draft on every selection change would throw away half-typed formulas.
  $effect(() => {
    const incoming = value
    if (!editing) draft = incoming
  })

  const address = $derived(
    active
      ? formatA1({
          col: active.colIndex, colAbs: false,
          row: active.rowIndex, rowAbs: false, sheet: null,
        })
      : '',
  )

  const suggestions = $derived<FunctionSuggestion[]>(
    autocomplete && editing ? suggestFunctions(draft, caret) : [],
  )
  const hint = $derived(editing ? signatureAt(draft, caret) : null)

  function syncCaret(event: Event) {
    const el = event.currentTarget as HTMLInputElement
    caret = el.selectionStart ?? el.value.length
  }

  function accept(suggestion: FunctionSuggestion) {
    const next = applySuggestion(draft, suggestion)
    draft = next.text
    highlighted = 0
    // Let Svelte write the value before moving the caret into the parens.
    queueMicrotask(() => {
      input?.setSelectionRange(next.caret, next.caret)
      input?.focus()
      caret = next.caret
    })
  }

  function commit() {
    editing = false
    onCommit(draft)
  }

  function onKeyDown(event: KeyboardEvent) {
    if (suggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        highlighted = (highlighted + 1) % suggestions.length
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        highlighted = (highlighted - 1 + suggestions.length) % suggestions.length
        return
      }
      if (event.key === 'Tab' || (event.key === 'Enter' && highlighted >= 0)) {
        const picked = suggestions[highlighted]
        if (picked) {
          event.preventDefault()
          accept(picked)
          return
        }
      }
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      // Revert rather than commit: Escape means "forget what I typed".
      draft = value
      editing = false
      input?.blur()
    }
  }

  function onNameBoxKey(event: KeyboardEvent) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const ref = parseA1(nameBoxText.trim())
    if (ref && ref.row !== null) {
      onNavigate?.({ rowIndex: ref.row, colIndex: ref.col })
      nameBoxText = ''
      return
    }
    if (names.some((n) => n.name.toUpperCase() === nameBoxText.trim().toUpperCase())) {
      onSelectName?.(nameBoxText.trim())
      nameBoxText = ''
    }
  }
</script>

<div class="sv-formula-bar" role="group" aria-label="Formula bar">
  {#if showNameBox}
    <div class="name-box">
      <input
        type="text"
        aria-label="Name box"
        placeholder={address}
        value={nameBoxText}
        {disabled}
        oninput={(e) => (nameBoxText = e.currentTarget.value)}
        onkeydown={onNameBoxKey}
        onblur={() => (nameBoxText = '')}
      />
      {#if names.length > 0}
        <select
          aria-label="Defined names"
          {disabled}
          onchange={(e) => {
            const picked = e.currentTarget.value
            if (picked) onSelectName?.(picked)
            e.currentTarget.selectedIndex = 0
          }}
        >
          <option value="">Names</option>
          {#each names as entry (entry.name)}
            <option value={entry.name}>{entry.name}</option>
          {/each}
        </select>
      {/if}
    </div>
  {/if}

  <span class="fx" aria-hidden="true">fx</span>

  <div class="field">
    <input
      bind:this={input}
      type="text"
      class="formula"
      aria-label="Formula"
      autocomplete="off"
      spellcheck="false"
      value={draft}
      disabled={disabled || active === null}
      oninput={(e) => {
        draft = e.currentTarget.value
        editing = true
        highlighted = 0
        syncCaret(e)
      }}
      onkeyup={syncCaret}
      onclick={syncCaret}
      onfocus={() => (editing = true)}
      onblur={() => { if (editing) commit() }}
      onkeydown={onKeyDown}
    />

    {#if hint}
      <div class="hint" role="status">{hint}</div>
    {/if}

    {#if suggestions.length > 0}
      <ul class="suggestions" role="listbox" aria-label="Function suggestions">
        {#each suggestions as suggestion, i (suggestion.name)}
          <li role="option" aria-selected={i === highlighted}>
            <button
              type="button"
              class:active={i === highlighted}
              onmousedown={(e) => { e.preventDefault(); accept(suggestion) }}
            >{suggestion.name}</button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

<style>
  .sv-formula-bar {
    display: flex;
    align-items: stretch;
    gap: 6px;
    font-size: 13px;
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: var(--sg-radius, 6px);
    background: var(--sg-input-bg, var(--sg-bg, #fff));
    color: var(--sg-fg, #0f172a);
    padding: 3px;
  }
  .name-box {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: 0 0 auto;
    border-right: 1px solid var(--sg-border, #e2e8f0);
    padding-right: 4px;
  }
  .name-box input {
    width: 84px;
    min-width: 0;
    font-family: ui-monospace, Menlo, monospace;
  }
  .name-box input::placeholder {
    color: var(--sg-muted, #64748b);
    opacity: 1;
  }
  .fx {
    display: flex;
    align-items: center;
    padding: 0 4px;
    font-style: italic;
    font-family: ui-serif, Georgia, serif;
    color: var(--sg-muted, #64748b);
  }
  .field {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
  }
  input {
    font: inherit;
    border: 0;
    outline: none;
    background: transparent;
    color: inherit;
    padding: 4px 6px;
  }
  input:focus-visible {
    outline: 2px solid var(--sg-accent, #6366f1);
    outline-offset: -2px;
    border-radius: 3px;
  }
  .formula {
    width: 100%;
    font-family: ui-monospace, Menlo, monospace;
  }
  select {
    font: inherit;
    border: 0;
    /* Not transparent: a native select paints its option list with this
       background, and a see-through one is unreadable on a dark theme. */
    background: var(--sg-input-bg, var(--sg-bg, #fff));
    color: var(--sg-muted, #64748b);
    max-width: 72px;
  }
  .hint {
    position: absolute;
    top: 100%;
    left: 6px;
    z-index: 30;
    margin-top: 2px;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--sg-fg, #1e293b);
    color: var(--sg-bg, #f8fafc);
    font-family: ui-monospace, Menlo, monospace;
    font-size: 11px;
    white-space: nowrap;
  }
  .suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 40;
    margin: 20px 0 0;
    padding: 2px;
    list-style: none;
    min-width: 180px;
    max-height: 220px;
    overflow-y: auto;
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 6px;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    box-shadow: 0 8px 24px rgb(15 23 42 / 0.12);
  }
  .suggestions button {
    display: block;
    width: 100%;
    text-align: left;
    font: inherit;
    font-family: ui-monospace, Menlo, monospace;
    border: 0;
    background: transparent;
    color: inherit;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
  }
  .suggestions button.active,
  .suggestions button:hover {
    background: var(--sg-row-hover-bg, #eef2ff);
  }
</style>
