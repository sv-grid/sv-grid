<script lang="ts">
  /**
   * The sheet tab strip along the bottom of a workbook.
   *
   * Owns no workbook state of its own: it renders what the workbook reports
   * and calls back, so the keyboard shortcuts and the tabs cannot disagree
   * about which sheet is active.
   */
  import type { Workbook } from './sheet/workbook'
  import { isValidSheetName } from './sheet/workbook'

  type Props = {
    workbook: Workbook
    /** Called after any change, so the consumer can re-render. */
    onChange?: () => void
    /** Off hides the add button and the context actions. */
    editable?: boolean
  }

  let { workbook, onChange, editable = true }: Props = $props()

  let renaming = $state<string | null>(null)
  let draft = $state('')
  let error = $state<string | null>(null)
  let dragging = $state<string | null>(null)

  function select(name: string) {
    workbook.setActive(name)
    onChange?.()
  }

  function startRename(name: string) {
    if (!editable) return
    renaming = name
    draft = name
    error = null
  }

  function commitRename() {
    const from = renaming
    if (from === null) return
    const to = draft.trim()
    renaming = null
    if (to === '' || to === from) return
    if (!isValidSheetName(to)) {
      error = `"${to}" is not a valid sheet name`
      return
    }
    if (!workbook.renameSheet(from, to)) {
      error = `a sheet named "${to}" already exists`
      return
    }
    error = null
    onChange?.()
  }

  function add() {
    workbook.addSheet()
    onChange?.()
  }

  function remove(name: string) {
    // The workbook refuses to remove the last sheet; reflect that rather than
    // showing a button that does nothing.
    if (!workbook.removeSheet(name)) return
    onChange?.()
  }

  function onDrop(target: string) {
    const moved = dragging
    dragging = null
    if (!moved || moved === target) return
    const to = workbook.sheets.indexOf(target)
    if (to < 0) return
    workbook.moveSheet(moved, to)
    onChange?.()
  }

  /** Left and right arrows move between tabs, which is what a tablist owes a
   *  keyboard user; the shortcut layer's Ctrl+PageUp/Down does the same from
   *  anywhere in the grid. */
  function onTabKey(event: KeyboardEvent, name: string) {
    const sheets = workbook.sheets
    const at = sheets.indexOf(name)
    if (event.key === 'ArrowRight' && at < sheets.length - 1) {
      event.preventDefault()
      select(sheets[at + 1]!)
    } else if (event.key === 'ArrowLeft' && at > 0) {
      event.preventDefault()
      select(sheets[at - 1]!)
    } else if (event.key === 'F2') {
      event.preventDefault()
      startRename(name)
    }
  }
</script>

<div class="sv-sheet-tabs">
  <div role="tablist" aria-label="Sheets" class="tabs">
    {#each workbook.sheets as name (name)}
      {@const isActive = name === workbook.active}
      <div
        class="tab"
        class:active={isActive}
        class:dragging={dragging === name}
        draggable={editable}
        ondragstart={() => (dragging = name)}
        ondragover={(e) => e.preventDefault()}
        ondrop={() => onDrop(name)}
        ondragend={() => (dragging = null)}
      >
        {#if renaming === name}
          <!-- svelte-ignore a11y_autofocus -->
          <input
            class="rename"
            aria-label="Sheet name"
            autofocus
            value={draft}
            oninput={(e) => (draft = e.currentTarget.value)}
            onblur={commitRename}
            onkeydown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitRename() }
              if (e.key === 'Escape') { e.preventDefault(); renaming = null }
            }}
          />
        {:else}
          <button
            type="button"
            role="tab"
            aria-selected={isActive}
            tabindex={isActive ? 0 : -1}
            onclick={() => select(name)}
            ondblclick={() => startRename(name)}
            onkeydown={(e) => onTabKey(e, name)}
          >{name}</button>
          {#if editable && workbook.sheets.length > 1}
            <button
              type="button"
              class="close"
              aria-label={`Delete ${name}`}
              onclick={() => remove(name)}
            >&times;</button>
          {/if}
        {/if}
      </div>
    {/each}
  </div>

  {#if editable}
    <button type="button" class="add" aria-label="New sheet" onclick={add}>+</button>
  {/if}

  {#if error}
    <span class="error" role="alert">{error}</span>
  {/if}
</div>

<style>
  .sv-sheet-tabs {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    border-top: 1px solid var(--sg-color-border, #e2e8f0);
    padding: 4px 6px;
    overflow-x: auto;
  }
  .tabs { display: flex; align-items: center; gap: 2px; }
  .tab {
    display: flex;
    align-items: center;
    border: 1px solid transparent;
    border-radius: 5px 5px 0 0;
    padding: 0 2px 0 6px;
  }
  .tab.active {
    background: var(--sg-color-surface, #fff);
    border-color: var(--sg-color-border, #cbd5e1);
    border-bottom-color: transparent;
    font-weight: 600;
  }
  .tab.dragging { opacity: 0.5; }
  button {
    font: inherit;
    border: 0;
    background: transparent;
    color: inherit;
    padding: 3px 4px;
    cursor: pointer;
    white-space: nowrap;
  }
  button:focus-visible {
    outline: 2px solid var(--sg-color-accent, #6366f1);
    outline-offset: -2px;
    border-radius: 3px;
  }
  .close {
    opacity: 0;
    padding: 0 3px;
    color: var(--sg-color-muted, #64748b);
  }
  .tab:hover .close,
  .tab.active .close { opacity: 1; }
  .add {
    border: 1px solid var(--sg-color-border, #cbd5e1);
    border-radius: 5px;
    line-height: 1;
  }
  .rename {
    font: inherit;
    width: 90px;
    border: 1px solid var(--sg-color-accent, #6366f1);
    border-radius: 3px;
    padding: 2px 4px;
  }
  .error {
    color: var(--sg-color-danger, #dc2626);
    font-size: 12px;
  }
</style>
