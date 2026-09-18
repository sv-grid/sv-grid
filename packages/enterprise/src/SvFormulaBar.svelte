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
  import { useSheetText } from './sheet-text'
  import {
    suggestFunctions,
    applySuggestion,
    signatureAt,
    type FunctionSuggestion,
  } from './sheet/autocomplete'
  import { parseA1, formatA1 } from './sheet/address'
  import { cycleReference } from './sheet/edit-keys'

  type Props = {
    /** Active cell in display coordinates, or null when nothing is active. */
    active: { rowIndex: number; colIndex: number } | null
    /** The cell's raw text: a formula as typed, or the literal value. */
    value: string
    /**
     * Called when the user commits with Enter (or the tick) or by leaving
     * the field, with the cell the edit STARTED in. Leaving the field by
     * clicking another cell moves `active` before the blur lands, so a
     * handler that wrote to the active cell would put the text into the cell
     * just clicked. `via` says which: after an Enter the sheet takes the
     * focus back and the cursor moves down, as in Excel; after a blur the
     * click that caused it has already placed the cursor.
     */
    onCommit: (text: string, cell: { rowIndex: number; colIndex: number }, via: 'enter' | 'blur') => void
    /** Called when the user types an address into the Name Box. */
    onNavigate?: (cell: { rowIndex: number; colIndex: number }) => void
    /** Named ranges for the Name Box dropdown. */
    names?: ReadonlyArray<{ name: string; refersTo: string }>
    /**
     * Shown in the Name Box instead of the address while set: Excel prints
     * "3R x 2C" there while a range is being dragged out.
     */
    label?: string | null
    onSelectName?: (name: string) => void
    /** The fx button: Excel's Insert Function. Without a handler the button
     *  is not drawn, since a button that does nothing is worse than none. */
    onInsertFunction?: () => void
    /** The text as it is being typed, and null once editing ends. The shell
     *  colours the cells a formula refers to while it is being written. */
    onDraft?: (text: string | null) => void
    /**
     * Runs of the text to colour, as Excel colours the references in a
     * formula: the shell passes `referenceSpans`. The bar lays a mirror of
     * the text over the field with the runs in colour and makes the field's
     * own text transparent under it, so the caret and the selection stay
     * the browser's.
     */
    highlight?: (text: string) => ReadonlyArray<{ start: number; end: number; colour: string }>
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
    label = null,
    onSelectName,
    onInsertFunction,
    onDraft,
    highlight,
    showNameBox = true,
    autocomplete = true,
    disabled = false,
  }: Props = $props()
  const t = useSheetText()

  let draft = $state('')
  let editing = $state(false)
  /** The coloured runs of the draft, or none while there is nothing to colour. */
  const runs = $derived.by(() => {
    if (!highlight) return []
    const spans = highlight(draft)
    if (spans.length === 0) return []
    const out: Array<{ text: string; colour: string | null }> = []
    let at = 0
    for (const span of spans) {
      if (span.start > at) out.push({ text: draft.slice(at, span.start), colour: null })
      out.push({ text: draft.slice(span.start, span.end), colour: span.colour })
      at = span.end
    }
    if (at < draft.length) out.push({ text: draft.slice(at), colour: null })
    return out
  })
  /** The cell being edited, pinned when editing starts. */
  let editingCell: { rowIndex: number; colIndex: number } | null = null

  function startEditing() {
    if (editing) return
    editing = true
    editingCell = active
  }
  let caret = $state(0)
  let highlighted = $state(0)
  let input = $state<HTMLTextAreaElement | null>(null)
  /**
   * Excel's bar shows one line until it is expanded with the chevron at its
   * end, and then up to six. The height never follows the active cell on
   * its own: a bar that grew for a two-line cell and shrank on the next
   * click would move the sheet under the pointer mid-click, so the click
   * landed a row below where it was pressed. Alt+Enter typed in the bar
   * expands it, since that is the user's own doing.
   */
  let expanded = $state(false)
  const lines = $derived(draft.split('\n').length)
  const rows = $derived(expanded ? Math.min(6, Math.max(2, lines)) : 1)
  let nameBoxText = $state('')
  /** True while the Name Box has focus, which is when it shows a draft. */
  let nameBoxTyping = $state(false)

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
    const el = event.currentTarget as HTMLTextAreaElement
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

  function commit(via: 'enter' | 'blur' = 'enter') {
    const cell = editingCell ?? active
    editing = false
    editingCell = null
    onDraft?.(null)
    if (cell) onCommit(draft, cell, via)
  }

  /** Excel's ✕: forget what was typed and leave the cell as it was. */
  function cancel() {
    draft = value
    editing = false
    editingCell = null
    onDraft?.(null)
    input?.blur()
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
    if (event.key === 'Enter' && event.altKey && input) {
      // A line break in the cell's text, as in the cell editor.
      event.preventDefault()
      const start = input.selectionStart ?? input.value.length
      const end = input.selectionEnd ?? start
      startEditing()
      expanded = true
      draft = draft.slice(0, start) + '\n' + draft.slice(end)
      input.value = draft
      input.setSelectionRange(start + 1, start + 1)
      caret = start + 1
      onDraft?.(draft)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      // Revert rather than commit: Escape means "forget what I typed".
      cancel()
      return
    }
    if (event.key === 'F4' && input) {
      // Excel's F4: the reference at the caret turns through $A$1, A$1, $A1.
      const edit = cycleReference(input.value, input.selectionStart ?? input.value.length)
      if (!edit) return
      event.preventDefault()
      startEditing()
      draft = edit.text
      input.value = edit.text
      input.setSelectionRange(edit.caret, edit.caret)
      caret = edit.caret
      onDraft?.(draft)
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

<div class="sv-formula-bar" role="group" aria-label={t('formulaBar')}>
  {#if showNameBox}
    <!--
      Excel's Name Box: one field that takes an address and, behind its arrow,
      lists the defined names. The native select sits invisibly over the
      arrow so the list is the browser's own; the field never changes shape
      when the workbook has no names, the arrow only greys out.
    -->
    <div class="name-box">
      <input
        type="text"
        aria-label={t('nameBox')}
        placeholder={label ?? address}
        value={nameBoxTyping ? nameBoxText : (label ?? address)}
        {disabled}
        oninput={(e) => (nameBoxText = e.currentTarget.value)}
        onkeydown={onNameBoxKey}
        onfocus={(e) => {
          // The address is the field's VALUE, not a placeholder: a placeholder
          // is a hint, so a screen reader on the Name Box would say "blank"
          // where Excel says B3. It is selected on focus, so typing over it
          // still replaces it in one go.
          nameBoxTyping = true
          nameBoxText = label ?? address
          const el = e.currentTarget
          queueMicrotask(() => el.select())
        }}
        onblur={() => { nameBoxTyping = false; nameBoxText = '' }}
      />
      <span class="caret" class:idle={names.length === 0} aria-hidden="true">
        <svg viewBox="0 0 10 10" width="10" height="10"><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </span>
      {#if names.length > 0}
        <select
          class="names"
          aria-label={t('definedNames')}
          {disabled}
          onchange={(e) => {
            const picked = e.currentTarget.value
            if (picked) onSelectName?.(picked)
            e.currentTarget.selectedIndex = 0
          }}
        >
          <option value="">{t('namesHeading')}</option>
          {#each names as entry (entry.name)}
            <option value={entry.name}>{entry.name}</option>
          {/each}
        </select>
      {/if}
    </div>
  {/if}

  <!-- Excel's three: Cancel and Enter while editing, Insert Function always. -->
  <div class="actions">
    <button
      type="button"
      class="action"
      title={t('formulaBarCancel')}
      aria-label={t('formulaBarCancel')}
      disabled={!editing}
      onmousedown={(e) => e.preventDefault()}
      onclick={cancel}
    ><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg></button>
    <button
      type="button"
      class="action"
      title={t('formulaBarEnter')}
      aria-label={t('formulaBarEnter')}
      disabled={!editing}
      onmousedown={(e) => e.preventDefault()}
      onclick={() => commit()}
    ><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 6.5l2.7 2.7L10 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg></button>
    {#if onInsertFunction}
      <button
        type="button"
        class="action fx"
        title={`${t('insertFunction')} (Shift+F3)`}
        aria-label={t('insertFunction')}
        {disabled}
        onclick={() => onInsertFunction?.()}
      >fx</button>
    {:else}
      <span class="action fx idle" aria-hidden="true">fx</span>
    {/if}
  </div>

  <div class="field">
    <!-- A textarea, not an input: an input strips the line breaks a cell
         typed with Alt+Enter holds, and would commit "twolines" for a cell
         showing two lines. One row until there are breaks to show. -->
    {#if runs.length > 0}
      <div class="formula mirror" aria-hidden="true">{#each runs as run, i (i)}{#if run.colour}<span style:color={run.colour}>{run.text}</span>{:else}{run.text}{/if}{/each}</div>
    {/if}
    <textarea
      bind:this={input}
      class="formula"
      class:coloured={runs.length > 0}
      aria-label={t('formula')}
      autocomplete="off"
      spellcheck="false"
      {rows}
      value={draft}
      disabled={disabled || active === null}
      oninput={(e) => {
        startEditing()
        draft = e.currentTarget.value
        highlighted = 0
        syncCaret(e)
        onDraft?.(draft)
      }}
      onkeyup={syncCaret}
      onclick={syncCaret}
      onfocus={startEditing}
      onblur={() => { if (editing) commit('blur') }}
      onkeydown={onKeyDown}
    ></textarea>
    <button
      type="button"
      class="expand"
      class:on={expanded}
      title={expanded ? t('collapseFormulaBar') : t('expandFormulaBar')}
      aria-label={expanded ? t('collapseFormulaBar') : t('expandFormulaBar')}
      aria-expanded={expanded}
      onclick={() => (expanded = !expanded)}
    ><svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg></button>

    {#if hint}
      <div class="hint" role="status">{hint}</div>
    {/if}

    {#if suggestions.length > 0}
      <ul class="suggestions" role="listbox" aria-label={t('functionSuggestions')}>
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
    align-items: flex-start;
    min-height: 26px;
    font-family: var(--sg-font, "Segoe UI", system-ui, sans-serif);
    font-size: 12.5px;
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: var(--sg-radius, 3px);
    background: var(--sg-input-bg, var(--sg-bg, #fff));
    color: var(--sg-fg, #242424);
  }

  /* ---- Name Box ------------------------------------------------------ */
  .name-box {
    position: relative;
    display: flex;
    align-items: stretch;
    flex: 0 0 auto;
    width: 96px;
    height: 24px;
    border-right: 1px solid var(--sg-border, #d1d1d1);
  }
  .name-box input {
    flex: 1 1 auto;
    width: 100%;
    min-width: 0;
    padding: 0 0 0 7px;
  }
  .name-box input::placeholder {
    color: var(--sg-fg, #242424);
    opacity: 1;
  }
  .caret {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    color: var(--sg-muted, #616161);
    border-left: 1px solid transparent;
  }
  .caret.idle { opacity: 0.35; }
  .name-box:hover .caret:not(.idle) {
    background: var(--sg-row-hover-bg, #f0f0f0);
    border-left-color: var(--sg-border, #d1d1d1);
  }
  /* The list is the browser's own select, laid invisibly over the arrow. */
  .names {
    position: absolute;
    top: 0;
    right: 0;
    width: 18px;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    /* Not transparent: the dropdown it opens paints with this background,
       and a see-through one is unreadable on a dark theme. */
    background: var(--sg-input-bg, var(--sg-bg, #fff));
    color: var(--sg-fg, #242424);
  }

  /* ---- Cancel / Enter / fx ------------------------------------------- */
  .actions {
    display: flex;
    align-items: center;
    gap: 0;
    height: 24px;
    padding: 0 3px;
    border-right: 1px solid var(--sg-border, #d1d1d1);
  }
  .action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    font: inherit;
    border: 1px solid transparent;
    border-radius: 3px;
    background: transparent;
    color: var(--sg-muted, #616161);
    cursor: pointer;
  }
  .action:hover:not(:disabled):not(.idle) {
    background: var(--sg-row-hover-bg, #f0f0f0);
    border-color: var(--sg-border, #d1d1d1);
    color: var(--sg-fg, #242424);
  }
  .action:disabled, .action.idle { opacity: 0.35; cursor: default; }
  .action.fx {
    font-family: Georgia, "Times New Roman", serif;
    font-style: italic;
    font-size: 13px;
    width: 22px;
  }
  .action:focus-visible {
    outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #107c41));
    outline-offset: -2px;
  }

  /* ---- the formula field --------------------------------------------- */
  .field {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
  }
  input {
    font: inherit;
    border: 0;
    outline: none;
    background: transparent;
    color: inherit;
    padding: 0 6px;
  }
  input:focus-visible {
    outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #107c41));
    outline-offset: -2px;
  }
  .formula {
    width: 100%;
    min-height: 24px;
    padding: 3px 6px 3px 8px;
    font: inherit;
    line-height: 18px;
    color: inherit;
    background: transparent;
    border: 0;
    outline: none;
    resize: none;
    overflow: hidden;
    white-space: pre-wrap;
  }
  .formula:focus-visible {
    outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #107c41));
    outline-offset: -2px;
  }
  /* The references in colour: a mirror of the text under a field whose own
     text is transparent. Same box, same type, so the glyphs coincide; the
     textarea's rows decide the height and the mirror is clipped to it. */
  .formula.mirror {
    position: absolute;
    inset: 0;
    right: 18px;
    overflow: hidden;
    overflow-wrap: break-word;
    pointer-events: none;
    color: var(--sg-fg, #242424);
  }
  .formula.coloured {
    position: relative;
    color: transparent;
    caret-color: var(--sg-fg, #242424);
  }
  /* Excel's chevron at the bar's end: expands to show every line. */
  .expand {
    flex: 0 0 auto;
    align-self: flex-start;
    width: 18px;
    height: 24px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--sg-muted, #616161);
    cursor: pointer;
  }
  .expand:hover { color: var(--sg-fg, #242424); }
  .expand.on svg { transform: rotate(180deg); }
  .hint {
    position: absolute;
    top: 100%;
    left: 6px;
    z-index: 30;
    margin-top: 3px;
    padding: 3px 7px;
    border-radius: 3px;
    background: var(--sg-fg, #242424);
    color: var(--sg-bg, #fff);
    font-size: 11.5px;
    white-space: nowrap;
  }
  .suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 40;
    margin: 24px 0 0;
    padding: 2px;
    list-style: none;
    min-width: 180px;
    max-height: 220px;
    overflow-y: auto;
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: 4px;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #242424);
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.14);
  }
  .suggestions button {
    display: block;
    width: 100%;
    text-align: left;
    font: inherit;
    border: 0;
    background: transparent;
    color: inherit;
    padding: 4px 8px;
    border-radius: 3px;
    cursor: pointer;
  }
  .suggestions button.active,
  .suggestions button:hover {
    background: var(--sg-row-hover-bg, #f0f0f0);
  }
</style>
