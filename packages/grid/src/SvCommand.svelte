<script lang="ts" module>
  export type { CommandItem } from './ui-app.types'
</script>

<script lang="ts">
  /**
   * SvCommand - a ⌘K command palette: a fuzzy-searchable list of actions in a
   * centered, focus-trapped dialog. Built on the shared primitives (portal +
   * focus trap + scroll lock + dismissable layer) and the pure `fuzzyScore`
   * matcher. Optionally binds a global hotkey to toggle itself. Emits WAI-ARIA
   * combobox markup (activedescendant).
   *
   * ```svelte
   * <SvCommand commands={cmds} onRun={(c) => run(c)} />  // Cmd/Ctrl+K opens it
   * ```
   */
  import type { CommandItem } from './ui-app.types'
  import { portalToBody, popIn } from './popover'
  import { createFocusTrap } from './a11y/focus-trap'
  import { lockScroll } from './a11y/scroll-lock'
  import { createDismissableLayer } from './a11y/dismissable'
  import { fuzzyScore } from './fuzzy'

  type Props = {
    open?: boolean
    onClose?: () => void
    commands: ReadonlyArray<CommandItem>
    onRun?: (cmd: CommandItem) => void
    placeholder?: string
    emptyText?: string
    /** Global toggle hotkey (Cmd/Ctrl + key). `false` disables it. Default 'mod+k'. */
    hotkey?: 'mod+k' | 'mod+p' | false
  }

  let {
    open = $bindable(false),
    onClose,
    commands,
    onRun,
    placeholder = 'Type a command or search…',
    emptyText = 'No results',
    hotkey = 'mod+k',
  }: Props = $props()

  let query = $state('')
  let active = $state(0)
  let panelEl = $state<HTMLDivElement | null>(null)
  let inputEl = $state<HTMLInputElement | null>(null)

  const results = $derived.by(() => {
    const q = query.trim()
    const list = commands.filter((c) => !c.disabled)
    if (!q) return list
    return list
      .map((c) => ({ c, s: fuzzyScore(`${c.label} ${c.keywords ?? ''} ${c.group ?? ''}`, q) }))
      .filter((x) => x.s !== null)
      .sort((a, b) => (b.s as number) - (a.s as number))
      .map((x) => x.c)
  })

  function close() { open = false; onClose?.() }
  function run(cmd: CommandItem | undefined) {
    if (!cmd || cmd.disabled) return
    close()
    onRun?.(cmd)
    cmd.onRun?.()
  }
  function move(delta: number) {
    const n = results.length
    if (!n) return
    active = (active + delta + n) % n
    queueMicrotask(() =>
      panelEl?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' }),
    )
  }
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (e.key === 'Enter') { e.preventDefault(); run(results[active]) }
    // Escape + outside-click are owned by the dismissable layer.
  }

  // Reset active whenever the query changes.
  $effect(() => { void query; active = 0 })

  // Focus + scroll lock + Escape/outside dismissal while open.
  $effect(() => {
    if (!open || !panelEl) return
    query = ''
    active = 0
    const trap = createFocusTrap(panelEl, { initialFocus: () => inputEl })
    trap.activate()
    const unlock = lockScroll()
    const layer = createDismissableLayer({ element: () => panelEl, onDismiss: () => close() })
    layer.activate()
    return () => { layer.release(); unlock(); trap.release() }
  })

  // Global toggle hotkey.
  $effect(() => {
    if (!hotkey) return
    const key = hotkey === 'mod+p' ? 'p' : 'k'
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === key) {
        e.preventDefault()
        open = !open
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
</script>

{#if open}
  <div class="sv-cmd__backdrop" use:portalToBody>
    <div
      bind:this={panelEl}
      class="sv-cmd"
      use:popIn={{}}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      tabindex="-1"
      onkeydown={onKeydown}
    >
      <div class="sv-cmd__search">
        <span class="sv-cmd__searchicon" aria-hidden="true">⌕</span>
        <input
          bind:this={inputEl}
          class="sv-cmd__input"
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="sv-cmd-list"
          aria-activedescendant={results[active] ? `sv-cmd-opt-${active}` : undefined}
          {placeholder}
          value={query}
          oninput={(e) => (query = e.currentTarget.value)}
        />
      </div>
      <ul class="sv-cmd__list" id="sv-cmd-list" role="listbox" aria-label="Commands">
        {#each results as c, i (c.id)}
          {#if !query.trim() && c.group && c.group !== results[i - 1]?.group}
            <li class="sv-cmd__group" role="presentation">{c.group}</li>
          {/if}
          <li
            id={`sv-cmd-opt-${i}`}
            data-idx={i}
            class="sv-cmd__opt"
            class:is-active={i === active}
            role="option"
            aria-selected={i === active}
            onpointermove={() => (active = i)}
            onclick={() => run(c)}
          >
            {#if c.icon}<span class="sv-cmd__icon" aria-hidden="true">{c.icon}</span>{/if}
            <span class="sv-cmd__label">{c.label}</span>
            {#if c.hint}<span class="sv-cmd__hint">{c.hint}</span>{/if}
            {#if c.shortcut}<span class="sv-cmd__kbd">{c.shortcut}</span>{/if}
          </li>
        {:else}
          <li class="sv-cmd__empty" aria-disabled="true">{emptyText}</li>
        {/each}
      </ul>
    </div>
  </div>
{/if}

<style>
  :global(.sv-cmd__backdrop) {
    position: fixed; inset: 0; z-index: 2147483000; display: flex; justify-content: center;
    align-items: flex-start; padding: 12vh 16px 16px;
    background: rgba(15, 23, 42, 0.42); backdrop-filter: blur(2px);
    animation: sv-cmd-fade 0.14s ease both;
  }
  @keyframes sv-cmd-fade { from { opacity: 0 } to { opacity: 1 } }
  :global(.sv-cmd) {
    width: min(560px, 100%); max-height: 62vh; display: flex; flex-direction: column; overflow: hidden;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 14px;
    box-shadow: 0 24px 64px -16px rgba(15, 23, 42, 0.5);
  }
  :global(.sv-cmd__search) { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  :global(.sv-cmd__searchicon) { color: var(--sg-muted, #64748b); font-size: 18px; }
  :global(.sv-cmd__input) { flex: 1; min-width: 0; border: 0; background: none; outline: none; font: inherit; font-size: 15px; color: var(--sg-fg, #0f172a); }
  :global(.sv-cmd__list) { list-style: none; margin: 0; padding: 6px; overflow: auto; }
  :global(.sv-cmd__group) { padding: 8px 10px 4px; font-size: 11px; font-weight: 650; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #94a3b8); }
  :global(.sv-cmd__opt) { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 8px; cursor: pointer; font-size: 13.5px; }
  :global(.sv-cmd__opt.is-active) { background: var(--sg-accent, #2563eb); color: var(--sg-on-accent, #fff); }
  :global(.sv-cmd__icon) { flex: none; width: 20px; text-align: center; }
  :global(.sv-cmd__label) { flex: none; }
  :global(.sv-cmd__hint) { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--sg-muted, #94a3b8); font-size: 12.5px; }
  :global(.sv-cmd__opt.is-active .sv-cmd__hint) { color: color-mix(in srgb, var(--sg-on-accent, #fff) 80%, transparent); }
  :global(.sv-cmd__kbd) { flex: none; margin-inline-start: auto; font-size: 11px; padding: 1px 6px; border-radius: 5px; background: color-mix(in srgb, var(--sg-fg, #0f172a) 8%, transparent); color: var(--sg-muted, #64748b); }
  :global(.sv-cmd__opt.is-active .sv-cmd__kbd) { background: color-mix(in srgb, var(--sg-on-accent, #fff) 22%, transparent); color: var(--sg-on-accent, #fff); }
  :global(.sv-cmd__empty) { padding: 22px; text-align: center; color: var(--sg-muted, #94a3b8); font-size: 13px; }
</style>
