<script lang="ts">
  /**
   * SvCountryInput - a searchable country picker (flag + name + dial code).
   * Emits the ISO 3166-1 alpha-2 code. Parity: Smart country-input pattern.
   * Data from countries.ts; popover via popover.ts.
   */
  import { anchoredRect, portalToBody, type AnchoredRect } from './popover'
  import { COUNTRIES, COUNTRY_BY_CODE, flagEmoji } from './countries'

  type Props = {
    value?: string | null
    onChange?: (code: string) => void
    /** Show the dial code beside each country. */
    showDial?: boolean
    placeholder?: string
    disabled?: boolean
    name?: string
    size?: 'sm' | 'md' | 'lg'
    ariaLabel?: string
  }

  let { value = null, onChange, showDial = false, placeholder = 'Select country…', disabled = false, name, size = 'md', ariaLabel }: Props = $props()

  let open = $state(false)
  let query = $state('')
  let active = $state(0)
  let triggerEl = $state<HTMLButtonElement | null>(null)
  let searchEl = $state<HTMLInputElement | null>(null)
  let panelEl = $state<HTMLDivElement | null>(null)
  let rect = $state<AnchoredRect>({ top: 0, left: 0, width: 0, openUpward: false })

  const selected = $derived(value ? COUNTRY_BY_CODE.get(value) ?? null : null)
  const filtered = $derived(
    query.trim() === ''
      ? COUNTRIES
      : COUNTRIES.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.dial.includes(query) || c.code.toLowerCase() === query.toLowerCase()),
  )

  function updatePos() { if (triggerEl) rect = anchoredRect(triggerEl.getBoundingClientRect(), { estimatedHeight: 320, minWidth: 240 }) }
  function openPanel() { if (disabled || open) return; open = true; query = ''; active = 0; updatePos(); queueMicrotask(() => searchEl?.focus()) }
  function close() { open = false; triggerEl?.focus() }
  function pick(code: string) { onChange?.(code); open = false; triggerEl?.focus() }
  function onKeydown(e: KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, filtered.length - 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0) }
    else if (e.key === 'Enter') { e.preventDefault(); const c = filtered[active]; if (c) pick(c.code) }
    else if (e.key === 'Escape') { e.preventDefault(); close() }
    queueMicrotask(() => panelEl?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' }))
  }

  $effect(() => {
    if (!open) return
    const rp = () => updatePos()
    window.addEventListener('scroll', rp, true); window.addEventListener('resize', rp)
    const od = (e: PointerEvent) => { const t = e.target as Node | null; if (t && (triggerEl?.contains(t) || panelEl?.contains(t))) return; open = false }
    document.addEventListener('pointerdown', od, true)
    return () => { window.removeEventListener('scroll', rp, true); window.removeEventListener('resize', rp); document.removeEventListener('pointerdown', od, true) }
  })
</script>

<button bind:this={triggerEl} type="button" class="sv-country sv-country--{size}" class:is-open={open} class:is-disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel} {disabled} onclick={() => (open ? (open = false) : openPanel())}>
  {#if selected}
    <span class="sv-country__flag" aria-hidden="true">{flagEmoji(selected.code)}</span>
    <span class="sv-country__name">{selected.name}</span>
    {#if showDial}<span class="sv-country__dial">{selected.dial}</span>{/if}
  {:else}
    <span class="sv-country__ph">{placeholder}</span>
  {/if}
  <svg class="sv-country__chev" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
</button>

{#if open}
  <div bind:this={panelEl} class="sv-country__panel" use:portalToBody style:position="fixed" style:top={`${rect.top}px`} style:left={`${rect.left}px`} style:min-width={`${rect.width}px`} role="dialog">
    <input bind:this={searchEl} class="sv-country__search" type="text" bind:value={query} placeholder="Search countries…" aria-label="Search countries" onkeydown={onKeydown} oninput={() => { active = 0; updatePos() }} />
    <div class="sv-country__list" role="listbox">
      {#each filtered as c, i (c.code)}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
        <div class="sv-country__opt" class:is-active={i === active} class:is-selected={c.code === value} role="option" tabindex="-1" aria-selected={c.code === value} data-idx={i} onclick={() => pick(c.code)} onpointermove={() => (active = i)}>
          <span class="sv-country__flag" aria-hidden="true">{flagEmoji(c.code)}</span>
          <span class="sv-country__name">{c.name}</span>
          <span class="sv-country__dial">{c.dial}</span>
        </div>
      {:else}
        <div class="sv-ddl__empty">No matches</div>
      {/each}
    </div>
  </div>
{/if}
{#if name}<input type="hidden" {name} value={value ?? ''} />{/if}

<style>
  .sv-country {
    --_accent: var(--sg-accent, #2563eb);
    display: inline-flex; align-items: center; gap: 8px; width: 220px;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a); font: inherit; text-align: left;
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: var(--sg-radius, 8px); padding: 0 10px; cursor: pointer;
  }
  .sv-country--sm { height: 28px; font-size: 12px; }
  .sv-country--md { height: 34px; font-size: 13px; }
  .sv-country--lg { height: 40px; font-size: 15px; }
  .sv-country.is-open, .sv-country:focus-visible { border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent); outline: none; }
  .sv-country.is-disabled { opacity: 0.6; cursor: not-allowed; }
  .sv-country__flag { font-size: 16px; }
  .sv-country__name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-country__ph { flex: 1; color: var(--sg-muted, #94a3b8); }
  .sv-country__dial { color: var(--sg-muted, #64748b); font-size: 12px; }
  .sv-country__chev { color: var(--sg-muted, #64748b); flex: none; }

  :global(.sv-country__panel) {
    z-index: 2147483647; display: flex; flex-direction: column; max-height: 340px; padding: 6px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; box-shadow: 0 16px 48px -12px rgba(15,23,42,0.35);
  }
  :global(.sv-country__search) {
    height: 32px; margin-bottom: 4px; padding: 0 10px; font: inherit; font-size: 13px;
    border: 1px solid var(--sg-input-border, #cbd5e1); border-radius: 7px; background: var(--sg-input-bg, #fff); color: inherit; outline: none;
  }
  :global(.sv-country__list) { overflow-y: auto; }
  :global(.sv-country__opt) { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 6px; cursor: pointer; font-size: 13px; }
  :global(.sv-country__opt.is-active) { background: var(--sg-row-hover-bg, #f1f5f9); }
  :global(.sv-country__opt.is-selected) { color: var(--sg-accent, #2563eb); font-weight: 600; }
</style>
