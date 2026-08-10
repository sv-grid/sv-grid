<script lang="ts" module>
  // MenuItem lives in a plain `.ts` module (breaks a Vite dev import cycle); it is
  // re-exported here so existing `import { type MenuItem } from './SvMenuList.svelte'`
  // sites keep working.
  export type { MenuItem } from './menu-item'
</script>

<script lang="ts">
  /**
   * SvMenuList - the recursive menu surface behind SvMenu: a WAI-ARIA `menu` with
   * roving focus, submenus (hover + ArrowRight), separators, icons and shortcuts.
   * Rendered inside a portalled panel by SvMenu; it self-imports for submenus.
   */
  import Self from './SvMenuList.svelte'
  import { type EditorDir } from './editor-contract'
  import type { MenuItem } from './menu-item'
  import { createMenu } from './createMenu.svelte'
  import { computePosition, autoUpdate, type Placement } from './positioning'

  let {
    items,
    onclose,
    onselect,
    submenu = false,
    oncollapse,
    dir,
  }: {
    items: ReadonlyArray<MenuItem>
    /** Close the WHOLE menu (a leaf was chosen, Escape, or outside-click). */
    onclose: () => void
    /** Report the chosen leaf item. */
    onselect: (item: MenuItem) => void
    submenu?: boolean
    /** Collapse just THIS submenu level (ArrowLeft, or ArrowRight under `rtl`)
     *  and refocus the item that opened it. Only meaningful when `submenu` is
     *  true; the root list has nowhere to collapse into. */
    oncollapse?: () => void
    /** Text direction; under `rtl` the ArrowRight/ArrowLeft submenu open/close
     *  keys swap (see createTree.svelte.ts for the reference pattern). */
    dir?: EditorDir
  } = $props()

  let listEl = $state<HTMLDivElement | null>(null)

  // Roving focus, submenu open/collapse and the full keyboard contract live in
  // the shared headless core; this component only renders + drives real DOM
  // focus (the core stays DOM-free). See createMenu.svelte.ts.
  const menu = createMenu({
    items: () => items,
    onSelect: (item) => onselect(item),
    onClose: () => onclose(),
    submenu: () => submenu,
    onCollapse: () => oncollapse?.(),
    dir: () => dir,
    focusItem: (i) => queueMicrotask(() => listEl?.querySelector<HTMLElement>(`[data-mi="${i}"]`)?.focus()),
  })

  // Position an open submenu flyout with the shared engine: prefer opening to the
  // side away from the reading direction, flip to the opposite side when there is
  // no room, and clamp vertically to stay in view. Kept absolute (relative to the
  // itemwrap) so a nested flyout is never clipped by a scroll container.
  const startSide: Placement = dir === 'rtl' ? 'left-start' : 'right-start'
  function flyout(node: HTMLElement) {
    const wrap = node.parentElement // .sv-menu__itemwrap
    const btn = wrap?.querySelector<HTMLElement>(':scope > .sv-menu__item') ?? null
    const update = () => {
      if (!btn || !wrap) return
      const r = btn.getBoundingClientRect()
      const w = wrap.getBoundingClientRect()
      const f = { width: node.offsetWidth || 200, height: node.offsetHeight || 120 }
      const p = computePosition(
        { x: r.left, y: r.top, width: r.width, height: r.height },
        f,
        { placement: startSide, offset: 2, padding: 8 },
      )
      node.style.left = `${p.x - w.left}px`
      node.style.top = `${p.y - w.top}px`
    }
    if (!btn) { update(); return {} }
    const stop = autoUpdate(btn, node, update)
    return { destroy() { stop() } }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div bind:this={listEl} class="sv-menu__list" class:is-submenu={submenu} {...menu.listProps()}>
  {#each items as item, i (i)}
    {#if item.separator}
      <div class="sv-menu__sep" role="separator"></div>
    {:else}
      <div class="sv-menu__itemwrap">
        <button
          type="button"
          class="sv-menu__item"
          class:is-active={menu.isActive(i)}
          {...menu.itemProps(i)}
        >
          <span class="sv-menu__icon">{#if item.icon}{@render item.icon()}{/if}</span>
          <span class="sv-menu__label">{item.label}</span>
          {#if item.shortcut}<span class="sv-menu__shortcut">{item.shortcut}</span>{/if}
          {#if item.children?.length}<svg class="sv-menu__chev" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>{/if}
        </button>
        {#if item.children?.length && menu.isSubOpen(i)}
          <div class="sv-menu__flyout" use:flyout>
            <Self
              items={item.children}
              {onclose}
              {onselect}
              oncollapse={() => menu.focus(i)}
              {dir}
              submenu
            />
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
  .sv-menu[dir='rtl'] .sv-menu__chev, .sv-menu__list.is-submenu .sv-menu__chev { transform: scaleX(-1); }
  /* top/left are the pre-JS fallback (open to the right); the `flyout` action
     overrides them with engine-computed offsets (flip + vertical clamp). */
  .sv-menu__flyout {
    position: absolute; top: -5px; left: 100%; z-index: 1;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px; box-shadow: 0 16px 40px -12px rgba(15,23,42,0.32);
  }
</style>
