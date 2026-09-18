<script lang="ts">
  /**
   * Excel's Insert Function: search or pick a category, choose a function,
   * read its argument list and what it does, and OK starts the active cell
   * on `=NAME(` with the caret inside the parentheses, where the formula
   * bar's autocomplete and signature hint take over. Excel follows with a
   * Function Arguments dialog; typing the arguments in place with the
   * signature shown is the same information with less chrome.
   */
  import { useSheetText } from './sheet-text'
  import { SvModal } from '@svgrid/grid'
  import { functionCatalog, FUNCTION_GROUPS, type FunctionGroup, type FunctionInfo } from './sheet/function-catalog'

  type Props = {
    open?: boolean
    onPick: (name: string) => void
    onClose?: () => void
  }

  let { open = $bindable(false), onPick, onClose }: Props = $props()
  const t = useSheetText()

  const all = functionCatalog()
  let search = $state('')
  let group = $state<FunctionGroup | 'All'>('All')
  let selected = $state<string>(all[0]?.name ?? '')
  let searchInput = $state<HTMLInputElement | null>(null)

  const shown = $derived.by<FunctionInfo[]>(() => {
    const needle = search.trim().toUpperCase()
    return all.filter((f) =>
      (group === 'All' || f.group === group) &&
      (needle === '' || f.name.includes(needle) || f.description.toUpperCase().includes(needle)),
    )
  })
  const current = $derived(all.find((f) => f.name === selected) ?? null)

  // The highlighted function follows the filter, so Enter always inserts
  // something visible.
  $effect(() => {
    if (shown.length && !shown.some((f) => f.name === selected)) selected = shown[0]!.name
  })
  $effect(() => {
    if (open) queueMicrotask(() => searchInput?.focus())
  })

  function ok() {
    if (!current) return
    onPick(current.name)
    open = false
    onClose?.()
  }

  function close() {
    open = false
    onClose?.()
  }

  function onListKey(event: KeyboardEvent) {
    const index = shown.findIndex((f) => f.name === selected)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      selected = shown[Math.min(index + 1, shown.length - 1)]?.name ?? selected
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      selected = shown[Math.max(index - 1, 0)]?.name ?? selected
    } else if (event.key === 'Enter') {
      event.preventDefault()
      ok()
    }
  }
</script>

<SvModal bind:open onClose={onClose} title={t('insertFunction.title')} size="md">
  <div class="sv-sheet-dialog insert" role="group" aria-label={t('insertFunction.title')}>
    <label class="field">
      <span>{t('insertFunction.search')}</span>
      <input bind:this={searchInput} type="text" bind:value={search} onkeydown={onListKey} spellcheck="false" autocomplete="off" placeholder={t('insertFunction.searchPlaceholder')} />
    </label>
    <label class="field">
      <span>{t('insertFunction.category')}</span>
      <select bind:value={group}>
        <option value="All">{t('insertFunction.all')}</option>
        {#each FUNCTION_GROUPS as g (g)}
          <option value={g}>{t(`insertFunction.group.${g}`)}</option>
        {/each}
      </select>
    </label>
    <div class="label">{t('insertFunction.select')}</div>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <ul class="list" role="listbox" aria-label={t('insertFunction.functions')} tabindex="0" onkeydown={onListKey}>
      {#each shown as fn (fn.name)}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
        <li
          role="option"
          aria-selected={fn.name === selected}
          class:selected={fn.name === selected}
          onclick={() => (selected = fn.name)}
          ondblclick={ok}
        >{fn.name}</li>
      {:else}
        <li class="empty">{t('insertFunction.noMatch')}</li>
      {/each}
    </ul>
    {#if current}
      <div class="about">
        <div class="signature">{current.signature}</div>
        <div class="description">{current.description || t('insertFunction.noDescription')}</div>
      </div>
    {/if}
  </div>
  {#snippet footer()}
    <div class="sv-sheet-dialog-buttons">
      <button type="button" class="btn primary" onclick={ok} disabled={!current}>{t('ok')}</button>
      <button type="button" class="btn" onclick={close}>{t('cancel')}</button>
    </div>
  {/snippet}
</SvModal>

<style>
  .label { font-weight: 600; }
  .insert :global(.field) { grid-template-columns: 160px 1fr; }
  .list {
    height: 160px;
    margin: 0;
    padding: 2px 0;
    overflow-y: auto;
    list-style: none;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: var(--sg-radius, 3px);
    font-family: ui-monospace, Consolas, monospace;
    font-size: 12px;
  }
  .list:focus { outline: none; border-color: var(--sg-accent, #217346); }
  .list li {
    padding: 2px 8px;
    cursor: default;
  }
  .list li:hover { background: var(--sg-row-hover-bg, #f5f5f5); }
  .list li.selected {
    color: var(--sg-on-accent, #fff);
    background: var(--sg-accent, #217346);
  }
  .list li.empty { color: var(--sg-muted, #616161); font-family: inherit; }
  .about { display: flex; flex-direction: column; gap: 4px; min-height: 52px; }
  .signature { font-weight: 600; font-family: ui-monospace, Consolas, monospace; font-size: 12px; }
  .description { color: var(--sg-muted, #616161); }
</style>
