<script lang="ts" module>
  export type { MultiSelectOption } from './ui-app.types'
</script>

<script lang="ts">
  /**
   * SvMultiSelect - a multi-select dropdown: a trigger showing the picked items
   * as chips (collapsing to "+N"), and a portalled panel with an optional search
   * box and a checkbox list. The open/position/dismiss/roving/keyboard/ARIA
   * mechanics come from the shared `createPopoverSelect` core; this component adds
   * the multi-select toggle, chips and search UI. Distinct from SvTagsInput
   * (free-form tags) - this picks from a fixed set.
   */
  import type { MultiSelectOption } from './ui-app.types'
  import SvField from './SvField.svelte'
  import { editorAria, nextEditorId, type SvEditorProps } from './editor-contract'
  import { portalToBody, popIn } from './popover'
  import { createPopoverSelect } from './createPopoverSelect.svelte'
  import { debounce } from './debounce'

  type Props = Pick<
    SvEditorProps,
    'disabled' | 'label' | 'hint' | 'error' | 'required' | 'invalid' | 'size' | 'id' | 'name' | 'dir' | 'ariaLabel'
  > & {
    options: ReadonlyArray<MultiSelectOption>
    value?: ReadonlyArray<string | number>
    onChange?: (value: Array<string | number>) => void
    onCommit?: (value: Array<string | number>) => void
    onCancel?: () => void
    placeholder?: string
    searchable?: boolean
    maxTagCount?: number
    clearable?: boolean
    /** Async/remote options: called (debounced) with the search query; its
     *  result replaces the list. When set, `options` is only the initial list. */
    loadOptions?: (query: string) => Promise<MultiSelectOption[]>
    /** Debounce for remote search. Default 250ms. */
    debounceMs?: number
    loadingText?: string
  }

  let {
    options,
    value = $bindable<ReadonlyArray<string | number>>([]),
    onChange,
    onCommit,
    onCancel,
    placeholder = 'Select…',
    searchable = true,
    maxTagCount = 3,
    clearable = true,
    loadOptions,
    debounceMs = 250,
    loadingText = 'Loading…',
    disabled = false,
    label,
    hint,
    error,
    required = false,
    invalid = false,
    size = 'md',
    id,
    name,
    dir,
    ariaLabel,
  }: Props = $props()

  const autoId = nextEditorId('sv-ms')
  const uid = $derived(id ?? autoId)

  let search = $state('')
  let triggerEl = $state<HTMLButtonElement | null>(null)
  let panelEl = $state<HTMLDivElement | null>(null)
  let searchEl = $state<HTMLInputElement | null>(null)
  let listEl = $state<HTMLUListElement | null>(null)

  // Remote/async options: `asyncOptions` holds the last server result; a stale
  // response is dropped by comparing the request sequence.
  let asyncOptions = $state<MultiSelectOption[]>([])
  let loading = $state(false)
  let reqSeq = 0
  function doLoad(q: string) {
    if (!loadOptions) return
    const seq = ++reqSeq
    loading = true
    loadOptions(q)
      .then((opts) => { if (seq === reqSeq) { asyncOptions = opts; loading = false } })
      .catch(() => { if (seq === reqSeq) loading = false })
  }
  const runLoad = debounce((q: string) => doLoad(q), debounceMs)

  const selected = $derived(new Set(value))
  const filtered = $derived(
    loadOptions
      ? asyncOptions
      : search.trim()
        ? options.filter((o) => o.label.toLowerCase().includes(search.trim().toLowerCase()))
        : options,
  )
  // Pool for resolving selected-chip labels (a remote-selected value may not be
  // in the current result page, so merge the seed options with the last result).
  const pool = $derived(
    loadOptions
      ? [...new Map([...options, ...asyncOptions].map((o) => [o.value, o])).values()]
      : options,
  )
  const selectedOptions = $derived(pool.filter((o) => selected.has(o.value)))

  function emit(next: Array<string | number>) {
    value = next // enables bind:value
    onChange?.(next)
  }
  function toggleOption(opt: MultiSelectOption) {
    if (opt.disabled) return
    const next = new Set(selected)
    next.has(opt.value) ? next.delete(opt.value) : next.add(opt.value)
    emit([...next])
  }

  const ms = createPopoverSelect({
    itemCount: () => filtered.length,
    disabled: (i) => !!filtered[i]?.disabled,
    onSelect: (i) => { const o = filtered[i]; if (o) toggleOption(o) },
    onOpenChange: (o) => { if (o) { search = ''; if (loadOptions) doLoad('') } },
    getTrigger: () => triggerEl,
    getPanel: () => panelEl,
    getInitialFocus: () => (searchable ? searchEl : listEl),
    closeOnSelect: () => false,
    minWidth: () => 200,
    idPrefix: 'sv-ms',
  })
</script>

<SvField id={uid} {label} {hint} {error} {required} {dir}>
  <div class="sv-ms sv-ms--{size}" class:is-disabled={disabled}>
    <button
      bind:this={triggerEl}
      type="button"
      class="sv-ms__trigger"
      class:is-invalid={invalid}
      {disabled}
      onclick={() => ms.toggle()}
      {...ms.triggerProps()}
      {...editorAria({ id: uid, invalid, required, error, hint, ariaLabel })}
    >
      {#if selectedOptions.length === 0}
        <span class="sv-ms__placeholder">{placeholder}</span>
      {:else}
        <span class="sv-ms__chips">
          {#each selectedOptions.slice(0, maxTagCount) as opt (opt.value)}
            <span class="sv-ms__chip">{opt.label}</span>
          {/each}
          {#if selectedOptions.length > maxTagCount}
            <span class="sv-ms__chip sv-ms__chip--more">+{selectedOptions.length - maxTagCount}</span>
          {/if}
        </span>
      {/if}
      <span class="sv-ms__arrow" aria-hidden="true">▾</span>
    </button>
    {#if clearable && selectedOptions.length && !disabled}
      <button type="button" class="sv-ms__clear" tabindex="-1" aria-label="Clear all" onclick={() => emit([])}>&times;</button>
    {/if}
    {#if name}
      {#each value as v (v)}<input type="hidden" {name} value={v} />{/each}
    {/if}
  </div>
</SvField>

{#if ms.open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={panelEl}
    class="sv-ms__panel"
    dir={dir}
    use:portalToBody
    use:popIn={{ up: ms.rect.openUpward }}
    style:position="fixed"
    style:top={`${ms.rect.top}px`}
    style:left={`${ms.rect.left}px`}
    style:min-width={`${ms.rect.width}px`}
    style:max-height={`${ms.rect.maxHeight}px`}
    onkeydown={ms.onPanelKeydown}
  >
    {#if searchable}
      <!-- svelte-ignore a11y_autofocus -->
      <input
        bind:this={searchEl}
        class="sv-ms__search"
        role="combobox"
        aria-expanded="true"
        aria-controls={ms.panelId}
        aria-activedescendant={ms.activeDescendant()}
        aria-label="Search options"
        placeholder="Search…"
        value={search}
        oninput={(e) => { search = e.currentTarget.value; ms.active = 0; if (loadOptions) runLoad(search) }}
      />
    {/if}
    <ul
      bind:this={listEl}
      id={ms.panelId}
      class="sv-ms__list"
      role="listbox"
      aria-multiselectable="true"
      aria-label={label ?? ariaLabel ?? 'Options'}
      aria-activedescendant={searchable ? undefined : ms.activeDescendant()}
      tabindex={searchable ? -1 : 0}
    >
      {#each filtered as opt, i (opt.value)}
        <li
          class="sv-ms__opt"
          class:is-active={ms.isActive(i)}
          class:is-disabled={opt.disabled}
          role="option"
          aria-selected={selected.has(opt.value)}
          aria-disabled={opt.disabled}
          onclick={() => toggleOption(opt)}
          {...ms.itemProps(i)}
        >
          <span class="sv-ms__check" aria-hidden="true">{selected.has(opt.value) ? '✓' : ''}</span>
          <span class="sv-ms__label">{opt.label}</span>
        </li>
      {:else}
        <li class="sv-ms__empty" aria-disabled="true">{loading ? loadingText : 'No matches'}</li>
      {/each}
      {#if loading && filtered.length}
        <li class="sv-ms__loading" aria-live="polite">{loadingText}</li>
      {/if}
    </ul>
    <div class="sv-ms__footer">
      <button type="button" class="sv-ms__done" onclick={() => { onCommit?.([...value]); ms.closePanel() }}>Done</button>
    </div>
  </div>
{/if}

<style>
  .sv-ms { --_accent: var(--sg-accent, #2563eb); display: inline-flex; align-items: stretch; position: relative; width: 240px; }
  .sv-ms.is-disabled { opacity: 0.6; }
  .sv-ms__trigger {
    flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; text-align: start;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: var(--sg-radius, 8px);
    font: inherit; cursor: pointer; padding: 0 8px;
  }
  .sv-ms--sm .sv-ms__trigger { min-height: 28px; font-size: 12px; }
  .sv-ms--md .sv-ms__trigger { min-height: 34px; font-size: 13px; }
  .sv-ms--lg .sv-ms__trigger { min-height: 40px; font-size: 15px; }
  .sv-ms__trigger:focus-visible { outline: none; border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent); }
  .sv-ms__trigger.is-invalid { border-color: var(--sg-danger, #dc2626); }
  .sv-ms__placeholder { flex: 1; color: var(--sg-muted, #94a3b8); }
  .sv-ms__chips { flex: 1; display: flex; flex-wrap: wrap; gap: 4px; padding: 4px 0; }
  .sv-ms__chip { display: inline-flex; align-items: center; padding: 1px 7px; border-radius: 999px; font-size: 11.5px; background: color-mix(in srgb, var(--_accent) 14%, transparent); color: var(--_accent); }
  .sv-ms__chip--more { background: var(--sg-row-hover-bg, #f1f5f9); color: var(--sg-muted, #64748b); }
  .sv-ms__arrow { margin-inline-start: auto; color: var(--sg-muted, #64748b); font-size: 10px; }
  .sv-ms__clear { position: absolute; inset-inline-end: 26px; align-self: center; background: none; border: 0; color: var(--sg-muted, #64748b); cursor: pointer; font-size: 15px; }
  .sv-ms__clear:hover { color: var(--sg-fg, #0f172a); }

  :global(.sv-ms__panel) {
    z-index: 2147483646; display: flex; flex-direction: column; max-height: 300px; max-width: 92vw;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; overflow: hidden;
    box-shadow: 0 16px 48px -12px rgba(15, 23, 42, 0.35); font-size: 13px;
  }
  :global(.sv-ms__search) {
    margin: 8px; padding: 6px 9px; font: inherit; font-size: 13px;
    border: 1px solid var(--sg-input-border, #cbd5e1); border-radius: 7px;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a); outline: none;
  }
  :global(.sv-ms__list) { list-style: none; margin: 0; padding: 4px; overflow: auto; flex: 1; outline: none; }
  :global(.sv-ms__opt) { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; cursor: pointer; }
  :global(.sv-ms__opt.is-active) { background: var(--sg-row-hover-bg, #f1f5f9); }
  :global(.sv-ms__opt.is-disabled) { opacity: 0.5; cursor: not-allowed; }
  :global(.sv-ms__check) { width: 14px; color: var(--sg-accent, #2563eb); font-weight: 700; }
  :global(.sv-ms__empty) { padding: 10px; color: var(--sg-muted, #94a3b8); text-align: center; }
  :global(.sv-ms__loading) { padding: 8px 10px; color: var(--sg-muted, #94a3b8); font-size: 12px; text-align: center; }
  :global(.sv-ms__footer) { display: flex; justify-content: flex-end; padding: 6px 8px; border-top: 1px solid var(--sg-border, #e2e8f0); }
  :global(.sv-ms__done) { font: inherit; font-size: 12.5px; padding: 4px 12px; border: 0; border-radius: 6px; background: var(--sg-accent, #2563eb); color: var(--sg-on-accent, #fff); cursor: pointer; }
</style>
