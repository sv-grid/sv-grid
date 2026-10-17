<script lang="ts" module>
  /**
   * Navbar with dropdown menus block - top-level items with chevrons over a
   * mock page. Products opens a mega-menu panel: two columns of icon, title
   * and description links. Resources opens an SvMenu. Both open with Enter or
   * Space; ArrowDown opens the mega menu on its first link and Up/Down move
   * between links; Escape closes and returns focus to the trigger. Below
   * 768 px a menu button opens an in-flow panel with every link grouped.
   * SvButton CTA, SvToaster. Pure UI-kit, --sg-* themed.
   *
   * Headless: createDropdownNavbar() below owns the mega menu, the phone menu,
   * the current link and the keyboard model with no markup; it asks you to
   * move focus through onFocusItem. The component under it is one styled
   * render of that core; import createDropdownNavbar from this file (or
   * `npx @svgrid/ui add navbars-dropdowns --headless` for the core alone) to
   * draw your own.
   */
  export type MegaItem = { title: string; desc: string; href: string; icon: string }
  export type MegaColumn = { heading: string; items: MegaItem[] }
  export type DropdownNavbarOptions = {
    columns?: MegaColumn[]
    current?: string
    /** Prefix for the panel ids that the triggers point at. */
    id?: string
    onNavigate?: (href: string, event: MouseEvent) => void
    /** Move DOM focus to the mega-menu link at this index (in reading order). */
    onFocusItem?: (index: number) => void
  }

  export const PRODUCT_COLUMNS: MegaColumn[] = [
    { heading: 'Analyze', items: [
      { title: 'Dashboards', desc: 'Live boards from any query', href: '/dashboards', icon: 'M3 3h6v6H3zM11 3h6v4h-6zM11 9h6v8h-6zM3 11h6v6H3z' },
      { title: 'Reports', desc: 'Scheduled PDFs for stakeholders', href: '/reports', icon: 'M5 2h7l3 3v13H5zM8 9h6M8 12h6M8 15h4' },
      { title: 'Alerts', desc: 'Get paged when a metric moves', href: '/alerts', icon: 'M10 3a5 5 0 0 1 5 5v4l1.5 3h-13L5 12V8a5 5 0 0 1 5-5zM8 17h4' },
    ] },
    { heading: 'Automate', items: [
      { title: 'Pipelines', desc: 'Load and clean data on a schedule', href: '/pipelines', icon: 'M3 6h5v8H3zM12 6h5v8h-5zM8 10h4' },
      { title: 'Exports', desc: 'Push results to S3 or Sheets', href: '/exports', icon: 'M10 3v9M6 8l4 4 4-4M4 15h12v2H4z' },
      { title: 'API', desc: 'Query everything over REST', href: '/api', icon: 'M7 6l-4 4 4 4M13 6l4 4-4 4' },
    ] },
  ]

  export function createDropdownNavbar(opts: DropdownNavbarOptions = {}) {
    const columns = opts.columns ?? PRODUCT_COLUMNS
    const items = columns.flatMap((c) => c.items)
    const base = opts.id ?? 'sv-nav-dd'
    let current = $state(opts.current ?? items[0]?.href ?? '/')
    let megaOpen = $state(false)
    let menuOpen = $state(false)
    let focused = -1

    function focusItem(i: number) {
      focused = (i + items.length) % items.length
      opts.onFocusItem?.(focused)
    }

    function openMega(withFocus: boolean) {
      megaOpen = true
      if (withFocus) focusItem(0)
    }

    function navigate(href: string, e: MouseEvent) {
      opts.onNavigate?.(href, e)
      current = href
      megaOpen = false
      menuOpen = false
    }

    return {
      columns,
      get current() { return current },
      set current(v: string) { current = v },
      get megaOpen() { return megaOpen },
      get menuOpen() { return menuOpen },
      get title() { return items.find((i) => i.href === current)?.title ?? (current === '/pricing' ? 'Pricing' : '') },
      navigate,
      closeMega() { megaOpen = false },
      closeMenu() { menuOpen = false },
      /** Escape: closes whichever panel is open and says which, so focus can return to its trigger. */
      escape(): 'mega' | 'menu' | null {
        if (megaOpen) { megaOpen = false; return 'mega' }
        if (menuOpen) { menuOpen = false; return 'menu' }
        return null
      },
      /** Spread on the Products <button>. Enter/Space (a click with detail 0) focuses the first link. */
      triggerProps: () => ({
        type: 'button' as const,
        'aria-expanded': megaOpen,
        'aria-controls': `${base}-products`,
        onclick: (e: MouseEvent) => { if (megaOpen) megaOpen = false; else openMega(e.detail === 0) },
        onkeydown: (e: KeyboardEvent) => { if (e.key === 'ArrowDown') { e.preventDefault(); openMega(true) } },
      }),
      /** Spread on the mega-menu panel. */
      megaProps: () => ({
        id: `${base}-products`,
        hidden: !megaOpen,
        onkeydown: (e: KeyboardEvent) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
          e.preventDefault()
          focusItem(focused + (e.key === 'ArrowDown' ? 1 : -1))
        },
      }),
      /** Spread on each link, in the panel or the phone menu. */
      linkProps: (href: string) => ({
        href,
        'aria-current': current === href ? ('page' as const) : undefined,
        onclick: (e: MouseEvent) => navigate(href, e),
        onfocus: () => { const i = items.findIndex((it) => it.href === href); if (i >= 0) focused = i },
      }),
      menuButtonProps: () => ({
        type: 'button' as const,
        'aria-expanded': menuOpen,
        'aria-controls': `${base}-menu`,
        'aria-label': menuOpen ? 'Close menu' : 'Open menu',
        onclick: () => { menuOpen = !menuOpen },
      }),
      panelProps: () => ({ id: `${base}-menu`, hidden: !menuOpen }),
    }
  }
</script>

<script lang="ts">
  import { SvButton, SvMenu, SvToaster, toast, type MenuItem } from '@svgrid/grid'

  const uid = $props.id()
  let productsBtn = $state<HTMLButtonElement | null>(null)
  let panel = $state<HTMLDivElement | null>(null)
  let menuBtn = $state<HTMLButtonElement | null>(null)

  const nav = createDropdownNavbar({
    id: uid,
    // Demo only: keep the gallery on this page. Your router navigates instead.
    onNavigate: (_href, e) => e.preventDefault(),
    // The panel unhides on this tick; focus the link once it renders.
    onFocusItem: (i) => setTimeout(() => panel?.querySelectorAll('a')[i]?.focus(), 0),
  })
  const resources: MenuItem[] = [
    { label: 'Documentation', onSelect: () => toast('Opening documentation') },
    { label: 'Guides', onSelect: () => toast('Opening guides') },
    { label: 'Changelog', onSelect: () => toast('Opening changelog') },
    { separator: true },
    { label: 'System status', onSelect: () => toast.success('All systems operational') },
  ]

  function onWindowKey(e: KeyboardEvent) {
    if (e.key !== 'Escape') return
    const closed = nav.escape()
    if (closed === 'mega') productsBtn?.focus()
    else if (closed === 'menu') menuBtn?.focus()
  }

  function onWindowPointer(e: PointerEvent) {
    const t = e.target as Node
    if (nav.megaOpen && !panel?.contains(t) && !productsBtn?.contains(t)) nav.closeMega()
  }

  /** Tabbing out of the mega menu closes it, like a click outside. */
  function onPanelBlur(e: FocusEvent) {
    const to = e.relatedTarget as Node | null
    if (to && !panel?.contains(to) && to !== productsBtn) nav.closeMega()
  }

  function openDocs(e: MouseEvent) {
    e.preventDefault()
    nav.closeMenu()
    toast('Opening documentation')
  }
</script>

<svelte:window onkeydown={onWindowKey} onpointerdown={onWindowPointer} />

<div class="sv-nav-dd">
  <div class="sv-nav-dd-frame">
    <header class="sv-nav-dd-bar">
      <div class="sv-nav-dd-row">
        <a class="sv-nav-dd-brand" href="/" onclick={(e) => nav.navigate('/pricing', e)}>
          <span class="sv-nav-dd-mark" aria-hidden="true"></span>Acme Analytics
        </a>
        <nav class="sv-nav-dd-links" aria-label="Main">
          <button bind:this={productsBtn} class="sv-nav-dd-top" {...nav.triggerProps()}>Products {@render chevron(nav.megaOpen)}</button>
          <SvMenu items={resources} ariaLabel="Resources">
            {#snippet anchor()}
              <button type="button" class="sv-nav-dd-top">Resources {@render chevron(false)}</button>
            {/snippet}
          </SvMenu>
          <a class="sv-nav-dd-top" {...nav.linkProps('/pricing')}>Pricing</a>
        </nav>
        <div class="sv-nav-dd-cta"><SvButton size="sm" onclick={() => toast('Opening the demo booking form')}>Book a demo</SvButton></div>
        <button bind:this={menuBtn} class="sv-nav-dd-toggle" {...nav.menuButtonProps()}>
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d={nav.menuOpen ? 'M5 5l10 10M15 5L5 15' : 'M3 6h14M3 10h14M3 14h14'} stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
        </button>
      </div>

      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div bind:this={panel} class="sv-nav-dd-mega" {...nav.megaProps()} onfocusout={onPanelBlur}>
        {#each nav.columns as col (col.heading)}
          <div>
            <h3>{col.heading}</h3>
            <ul>
              {#each col.items as it (it.href)}
                <li>
                  <a {...nav.linkProps(it.href)}>
                    <span class="sv-nav-dd-ic" aria-hidden="true"><svg viewBox="0 0 20 20" width="18" height="18"><path d={it.icon} fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
                    <span><strong>{it.title}</strong><small>{it.desc}</small></span>
                  </a>
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>

      <nav class="sv-nav-dd-panel" aria-label="Main (mobile)" {...nav.panelProps()}>
        {#each nav.columns as col (col.heading)}
          <h3>{col.heading}</h3>
          {#each col.items as it (it.href)}<a {...nav.linkProps(it.href)}>{it.title}</a>{/each}
        {/each}
        <h3>Company</h3>
        <a {...nav.linkProps('/pricing')}>Pricing</a>
        <a href="/docs" onclick={openDocs}>Documentation</a>
      </nav>
    </header>

    <main class="sv-nav-dd-page">
      <h2>{nav.title}</h2>
      <div class="sv-nav-dd-lines" aria-hidden="true"><i style:width="56%"></i><i style:width="38%"></i></div>
      <div class="sv-nav-dd-tiles" aria-hidden="true">{#each [0, 1, 2, 3] as n (n)}<div></div>{/each}</div>
    </main>
  </div>
</div>

{#snippet chevron(up: boolean)}
  <svg class="sv-nav-dd-chev" class:sv-nav-dd-chev-up={up} viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
{/snippet}

<SvToaster position="bottom-right" />

<style>
  .sv-nav-dd {
    width: 100%; box-sizing: border-box; padding: 32px 24px; min-height: 480px;
    display: flex; justify-content: center; align-items: flex-start;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-nav-dd-frame { width: 100%; max-width: 960px; overflow: hidden; border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px); }
  .sv-nav-dd-bar { position: relative; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-nav-dd-row { display: flex; align-items: center; gap: 24px; padding: 12px 20px; }
  .sv-nav-dd-brand { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; color: inherit; text-decoration: none; white-space: nowrap; }
  .sv-nav-dd-mark { width: 20px; height: 20px; border-radius: 6px; background: linear-gradient(135deg, var(--sg-fg, #0f172a) 50%, var(--sg-muted, #64748b) 50%); }
  .sv-nav-dd-links { display: flex; align-items: center; gap: 2px; flex: 1; min-width: 0; }
  .sv-nav-dd-top {
    display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px;
    border: 0; border-radius: var(--sg-radius, 6px); background: none; cursor: pointer;
    font: inherit; font-size: 14px; font-weight: 500; color: var(--sg-muted, #64748b); text-decoration: none;
  }
  .sv-nav-dd-top:hover, .sv-nav-dd-top[aria-expanded='true'] { color: var(--sg-fg, #0f172a); background: var(--sg-row-hover-bg, #f1f5f9); }
  /* The Resources trigger sits inside SvMenu's anchor span, which carries aria-expanded. */
  :global(.sv-menu__anchor[aria-expanded='true'] > .sv-nav-dd-top) { color: var(--sg-fg, #0f172a); background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-nav-dd-top[aria-current='page'] { color: var(--sg-fg, #0f172a); }
  .sv-nav-dd-chev { display: block; transition: transform .15s; }
  .sv-nav-dd-chev-up { transform: rotate(180deg); }
  .sv-nav-dd a:focus-visible, .sv-nav-dd button:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--sg-focus-ring, var(--sg-accent, #2563eb)); }
  .sv-nav-dd-toggle {
    display: none; place-items: center; width: 36px; height: 36px; margin-left: auto; padding: 0;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 6px); background: none; color: inherit; cursor: pointer;
  }
  .sv-nav-dd-toggle svg { display: block; }

  .sv-nav-dd-mega {
    position: absolute; top: calc(100% + 6px); left: 12px; z-index: 5; width: min(620px, calc(100% - 24px)); box-sizing: border-box;
    display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; padding: 16px;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
    box-shadow: 0 16px 40px -16px color-mix(in srgb, var(--sg-fg, #0f172a) 35%, transparent);
  }
  .sv-nav-dd-mega[hidden] { display: none; }
  .sv-nav-dd h3 { margin: 4px 10px 6px; font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--sg-muted, #64748b); }
  .sv-nav-dd-mega ul { list-style: none; margin: 0; padding: 0; }
  .sv-nav-dd-mega a { display: flex; gap: 12px; padding: 10px; border-radius: var(--sg-radius, 8px); color: inherit; text-decoration: none; }
  .sv-nav-dd-mega a:hover, .sv-nav-dd-mega a[aria-current='page'] { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-nav-dd-ic {
    flex: none; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 8px;
    border: 1px solid var(--sg-border, #e2e8f0); color: var(--sg-fg, #0f172a);
  }
  .sv-nav-dd-ic svg { display: block; }
  .sv-nav-dd-mega strong { display: block; font-size: 14px; font-weight: 600; }
  .sv-nav-dd-mega small { display: block; margin-top: 2px; font-size: 12.5px; color: var(--sg-muted, #64748b); }
  .sv-nav-dd-panel { display: none; }

  .sv-nav-dd-page { padding: 28px 20px 32px; }
  .sv-nav-dd-page h2 { margin: 0 0 12px; font-size: 22px; font-weight: 700; letter-spacing: -.01em; }
  .sv-nav-dd-lines { display: grid; gap: 8px; margin-bottom: 24px; }
  .sv-nav-dd-lines i { display: block; height: 9px; border-radius: 5px; background: color-mix(in srgb, var(--sg-fg, #0f172a) 9%, var(--sg-bg, #fff)); }
  .sv-nav-dd-tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  .sv-nav-dd-tiles div { height: 120px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 8px); background: color-mix(in srgb, var(--sg-fg, #0f172a) 3%, var(--sg-bg, #fff)); }

  @media (max-width: 767px) {
    .sv-nav-dd { padding: 16px 12px; }
    .sv-nav-dd-row { padding: 10px 14px; }
    .sv-nav-dd-links, .sv-nav-dd-cta, .sv-nav-dd-mega { display: none; }
    .sv-nav-dd-toggle { display: grid; }
    .sv-nav-dd-panel { display: flex; flex-direction: column; gap: 2px; padding: 4px 12px 14px; }
    .sv-nav-dd-panel[hidden] { display: none; }
    .sv-nav-dd-panel h3 { margin-top: 12px; }
    .sv-nav-dd-panel a { padding: 9px 10px; border-radius: var(--sg-radius, 6px); font-size: 15px; color: inherit; text-decoration: none; }
    .sv-nav-dd-panel a[aria-current='page'] { background: color-mix(in srgb, var(--sg-fg, #0f172a) 7%, var(--sg-bg, #fff)); }
    .sv-nav-dd-page { padding: 20px 14px 24px; }
    .sv-nav-dd-tiles { grid-template-columns: 1fr 1fr; }
  }
</style>
