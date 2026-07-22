<script module lang="ts">
  let lookupUid = 0
</script>

<script lang="ts">
  /**
   * SvLookupInput - a searchable single-select for a foreign-key ("lookup")
   * field. It searches the related entity through a `RelationLookup`, shows human
   * labels, and stores the selected key. Used by SvGridEditPanel for `relation`
   * fields, and usable on its own.
   */
  import type { RelationLookup, RelationOption } from './sources/relation-lookup'

  type Props = {
    value: unknown
    lookup: RelationLookup
    onSelect: (value: string) => void
    id?: string
    placeholder?: string
    disabled?: boolean
    required?: boolean
    /** Debounce for the search query, ms. Default 200. */
    debounceMs?: number
  }

  let {
    value,
    lookup,
    onSelect,
    id,
    placeholder = 'Search…',
    disabled = false,
    required = false,
    debounceMs = 200,
  }: Props = $props()

  // Stable listbox id so the combobox input can reference it via aria-controls.
  const listboxId = `sv-lookup-list-${++lookupUid}`
  let open = $state(false)
  let query = $state('')
  let options = $state<RelationOption[]>([])
  let loading = $state(false)
  let active = $state(-1)
  let label = $state('')
  let rootEl: HTMLDivElement | undefined = $state()

  let searchTimer: ReturnType<typeof setTimeout> | undefined
  let labelToken = 0
  let searchToken = 0

  // Resolve the current value's label whenever it changes (and we're not typing).
  $effect(() => {
    const v = value
    if (v == null || v === '') { label = ''; return }
    const token = ++labelToken
    lookup.labelFor(v).then((l) => {
      if (token === labelToken) label = l ?? String(v)
    })
  })

  async function runSearch(q: string) {
    const token = ++searchToken
    loading = true
    try {
      const res = await lookup.search(q)
      if (token === searchToken) { options = res; active = res.length ? 0 : -1 }
    } finally {
      if (token === searchToken) loading = false
    }
  }

  function openList() {
    if (disabled) return
    open = true
    query = ''
    runSearch('')
  }
  function closeList() {
    open = false
    query = ''
    if (searchTimer) clearTimeout(searchTimer)
  }
  function onInput(e: Event) {
    query = (e.currentTarget as HTMLInputElement).value
    open = true
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => runSearch(query), debounceMs)
  }
  function choose(opt: RelationOption) {
    label = opt.label
    onSelect(opt.value)
    closeList()
  }
  function clear() {
    onSelect('')
    label = ''
    closeList()
  }
  function onKeydown(e: KeyboardEvent) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { openList(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, options.length - 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0) }
    else if (e.key === 'Enter') { if (open && options[active]) { e.preventDefault(); choose(options[active]) } }
    else if (e.key === 'Escape') { if (open) { e.preventDefault(); closeList() } }
  }
  function onDocClick(e: MouseEvent) {
    if (open && rootEl && !rootEl.contains(e.target as Node)) closeList()
  }
</script>

<svelte:document onclick={onDocClick} />

<div class="sv-lookup" bind:this={rootEl}>
  <div class="sv-lookup__control">
    <input
      {id}
      class="sv-lookup__input"
      type="text"
      role="combobox"
      aria-expanded={open}
      aria-controls={listboxId}
      aria-autocomplete="list"
      autocomplete="off"
      {placeholder}
      {disabled}
      {required}
      value={open ? query : label}
      onfocus={openList}
      oninput={onInput}
      onkeydown={onKeydown}
    />
    {#if value != null && value !== '' && !required && !disabled}
      <button type="button" class="sv-lookup__clear" title="Clear" aria-label="Clear" onclick={clear}>&times;</button>
    {/if}
  </div>

    <ul class="sv-lookup__menu" role="listbox" id={listboxId} hidden={!open}>
      {#if loading}
        <li class="sv-lookup__msg">Searching…</li>
      {:else if options.length === 0}
        <li class="sv-lookup__msg">No matches</li>
      {:else}
        {#each options as opt, i (opt.value)}
          <li>
            <button
              type="button"
              role="option"
              aria-selected={i === active}
              class="sv-lookup__opt"
              class:is-active={i === active}
              onmouseenter={() => (active = i)}
              onclick={() => choose(opt)}
            >{opt.label}</button>
          </li>
        {/each}
      {/if}
    </ul>
</div>

<style>
  .sv-lookup { position: relative; }
  .sv-lookup__control { position: relative; display: flex; align-items: center; }
  .sv-lookup__input { width: 100%; }
  .sv-lookup__clear {
    position: absolute; right: 6px; border: none; background: none; cursor: pointer;
    font-size: 16px; line-height: 1; color: var(--sg-muted, #888); padding: 2px 4px;
  }
  .sv-lookup__menu {
    position: absolute; z-index: 30; top: calc(100% + 2px); left: 0; right: 0; margin: 0; padding: 4px;
    list-style: none; max-height: 220px; overflow: auto;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #ddd); border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }
  .sv-lookup__opt {
    display: block; width: 100%; text-align: left; padding: 7px 10px; border: none; border-radius: 6px;
    background: none; cursor: pointer; font: inherit; color: var(--sg-fg, inherit);
  }
  .sv-lookup__opt.is-active { background: var(--sg-accent, #2563eb); color: #fff; }
  .sv-lookup__msg { padding: 8px 10px; color: var(--sg-muted, #888); font-size: 13px; }
</style>
