<script lang="ts" module>
  import type { Snippet } from 'svelte'
  export type MenuItem = {
    /** Item text. Omit + set `separator` for a divider. */
    label?: string
    separator?: boolean
    icon?: Snippet
    /** Right-aligned hint, e.g. a keyboard shortcut. */
    shortcut?: string
    disabled?: boolean
    /** Nested submenu items (renders a flyout). */
    children?: MenuItem[]
    onSelect?: () => void
  }
</script>

<script lang="ts">
  /**
   * SvMenuList - the recursive menu surface behind SvMenu: a WAI-ARIA `menu` with
   * roving focus, submenus (hover + ArrowRight), separators, icons and shortcuts.
   * Rendered inside a portalled panel by SvMenu; it self-imports for submenus.
   */
  import Self from './SvMenuList.svelte'

  let {
    items,
    onclose,
    onselect,
    submenu = false,
  }: {
    items: ReadonlyArray<MenuItem>
    /** Close the WHOLE menu (a leaf was chosen or Escape at the root). */
    onclose: () => void
    /** Report the chosen leaf item. */
    onselect: (item: MenuItem) => void
    submenu?: boolean
  } = $props()

  // Indexes of real (non-separator) items, for roving focus.
  const focusable = $derived(items.map((it, i) => (it.separator || it.disabled ? -1 : i)).filter((i) => i >= 0))
  let active = $state(-1)
  let openSub = $state(-1)
  let listEl = $state<HTMLDivElement | null>(null)

  function focusItem(i: number) {
    active = i
    queueMicrotask(() => listEl?.querySelector<HTMLElement>(`[data-mi="${i}"]`)?.focus())
  }
  function move(delta: number) {
    if (!focusable.length) return
    const pos = focusable.indexOf(active)
    const next = focusable[(pos + delta + focusable.length) % focusable.length]
    if (next != null) { openSub = -1; focusItem(next) }
  }
  function choose(item: MenuItem) {
    if (item.disabled || item.separator) return
    if (item.children?.length) { openSub = items.indexOf(item); return }
    item.onSelect?.()
    onselect(item)
    onclose()
  }
  function onKeydown(e: KeyboardEvent, i: number) {
    const item = items[i]
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(1); break
      case 'ArrowUp': e.preventDefault(); move(-1); break
      case 'Home': e.preventDefault(); focusItem(focusable[0] ?? 0); break
      case 'End': e.preventDefault(); focusItem(focusable.at(-1) ?? 0); break
      case 'ArrowRight':
        if (item?.children?.length) { e.preventDefault(); openSub = i }
        break
      case 'ArrowLeft':
        if (submenu) { e.preventDefault(); onclose() } // parent listens via its own onclose wiring
        break
      case 'Enter':
      case ' ': e.preventDefault(); if (item) choose(item); break
      case 'Escape': e.preventDefault(); onclose(); break
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div bind:this={listEl} class="sv-menu__list" class:is-submenu={submenu} role="menu">
  {#each items as item, i (i)}
    {#if item.separator}
      <div class="sv-menu__sep" role="separator"></div>
    {:else}
      <div class="sv-menu__itemwrap">
        <button
          type="button"
          class="sv-menu__item"
          class:is-active={active === i}
          data-mi={i}
          role="menuitem"
          aria-haspopup={item.children?.length ? 'menu' : undefined}
          aria-expanded={item.children?.length ? openSub === i : undefined}
          aria-disabled={item.disabled || undefined}
          disabled={item.disabled}
          tabindex={active === i || (active === -1 && i === focusable[0]) ? 0 : -1}
          onpointerenter={() => { if (!item.disabled) { active = i; openSub = item.children?.length ? i : -1 } }}
          onkeydown={(e) => onKeydown(e, i)}
          onclick={() => choose(item)}
        >
          <span class="sv-menu__icon">{#if item.icon}{@render item.icon()}{/if}</span>
          <span class="sv-menu__label">{item.label}</span>
          {#if item.shortcut}<span class="sv-menu__shortcut">{item.shortcut}</span>{/if}
          {#if item.children?.length}<svg class="sv-menu__chev" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>{/if}
        </button>
        {#if item.children?.length && openSub === i}
          <div class="sv-menu__flyout">
            <Self items={item.children} onclose={onclose} onselect={onselect} submenu />
          </div>
        {/if}
      </div>
    {/if}
  {/each}
</div>

<style>
  .sv-menu__list { display: flex; flex-direction: column; min-width: 180px; padding: 4px; }
  .sv-menu__sep { height: 1px; background: var(--sg-border, #e2e8f0); margin: 4px 6px; }
  .sv-menu__itemwrap { position: relative; }
  .sv-menu__item {
    display: flex; align-items: center; gap: 9px; width: 100%; box-sizing: border-box;
    padding: 7px 10px; background: none; border: 0; border-radius: 6px; cursor: pointer;
    font: inherit; font-size: 13px; color: var(--sg-fg, #0f172a); text-align: start;
    transition: background 0.1s;
  }
  .sv-menu__item.is-active:not([disabled]), .sv-menu__item:hover:not([disabled]) { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-menu__item:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: -2px; }
  .sv-menu__item[disabled] { opacity: 0.45; cursor: default; }
  .sv-menu__icon { display: inline-flex; width: 16px; flex: none; color: var(--sg-muted, #64748b); }
  .sv-menu__icon:empty { width: 0; }
  .sv-menu__label { flex: 1; white-space: nowrap; }
  .sv-menu__shortcut { color: var(--sg-muted, #94a3b8); font-size: 11.5px; margin-inline-start: 12px; }
  .sv-menu__chev { color: var(--sg-muted, #94a3b8); flex: none; }
  .sv-menu[dir='rtl'] .sv-menu__chev, .sv-menu__list.is-submenu .sv-menu__chev { }
  .sv-menu__flyout {
    position: absolute; top: -5px; inset-inline-start: 100%; z-index: 1;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px; box-shadow: 0 16px 40px -12px rgba(15,23,42,0.32); margin-inline-start: 2px;
  }
</style>
