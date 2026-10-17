<script lang="ts" module>
  /**
   * Simple navbar block - a top bar with the brand, four page links and a
   * Start free trial SvButton, shown over a mock page. The current link
   * carries aria-current="page". Below 768 px the links fold behind a menu
   * button that opens an in-flow panel; Escape or a link click closes it.
   * SvToaster confirms the CTA. Pure UI-kit, --sg-* themed.
   *
   * Headless: createSimpleNavbar() below owns the current link, the phone
   * menu state and the ARIA wiring with no markup. The component under it is
   * one styled render of that core; import createSimpleNavbar from this file
   * (or `npx @svgrid/ui add navbars-simple --headless` for the core alone) to
   * draw your own.
   */
  export type NavLink = { label: string; href: string }
  export type SimpleNavbarOptions = {
    links?: NavLink[]
    /** The active path; set `nav.current` from your router to keep it in step. */
    current?: string
    /** Prefix for the panel id that the menu button points at. */
    id?: string
    /** Called on every link click, before the phone menu closes. */
    onNavigate?: (href: string, event: MouseEvent) => void
  }

  export const SIMPLE_LINKS: NavLink[] = [
    { label: 'Product', href: '/product' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Customers', href: '/customers' },
    { label: 'Docs', href: '/docs' },
  ]

  export function createSimpleNavbar(opts: SimpleNavbarOptions = {}) {
    const links = opts.links ?? SIMPLE_LINKS
    const panelId = `${opts.id ?? 'sv-nav-simple'}-menu`
    let current = $state(opts.current ?? links[0]?.href ?? '/')
    let menuOpen = $state(false)

    function navigate(href: string, e: MouseEvent) {
      opts.onNavigate?.(href, e)
      current = href
      menuOpen = false
    }

    return {
      links,
      get current() { return current },
      set current(v: string) { current = v },
      get menuOpen() { return menuOpen },
      set menuOpen(v: boolean) { menuOpen = v },
      get title() { return links.find((l) => l.href === current)?.label ?? '' },
      /** Close the phone menu on Escape; true when it was open (return focus then). */
      navigate,
      escape() { const was = menuOpen; menuOpen = false; return was },
      /** Spread on each <a>. */
      linkProps: (href: string) => ({
        href,
        'aria-current': current === href ? ('page' as const) : undefined,
        onclick: (e: MouseEvent) => navigate(href, e),
      }),
      /** Spread on the phone menu <button>. */
      menuButtonProps: () => ({
        type: 'button' as const,
        'aria-expanded': menuOpen,
        'aria-controls': panelId,
        'aria-label': menuOpen ? 'Close menu' : 'Open menu',
        onclick: () => { menuOpen = !menuOpen },
      }),
      /** Spread on the phone menu panel. */
      panelProps: () => ({ id: panelId, hidden: !menuOpen }),
    }
  }
</script>

<script lang="ts">
  import { SvButton, SvToaster, toast } from '@svgrid/grid'

  const uid = $props.id()
  const nav = createSimpleNavbar({
    id: uid,
    current: '/product',
    // Demo only: keep the gallery on this page. Your router navigates instead.
    onNavigate: (_href, e) => e.preventDefault(),
  })
  let menuBtn = $state<HTMLButtonElement | null>(null)

  const startTrial = () => toast.success('Trial started: 14 days, no card needed')
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && nav.escape()) menuBtn?.focus() }} />

<div class="sv-nav-simple">
  <div class="sv-nav-simple-frame">
    <header class="sv-nav-simple-bar">
      <a class="sv-nav-simple-brand" href="/" onclick={(e) => nav.navigate('/product', e)}>
        <span class="sv-nav-simple-mark" aria-hidden="true"></span>Lumen
      </a>
      <nav class="sv-nav-simple-links" aria-label="Main">
        {#each nav.links as l (l.href)}<a {...nav.linkProps(l.href)}>{l.label}</a>{/each}
      </nav>
      <div class="sv-nav-simple-cta"><SvButton size="sm" onclick={startTrial}>Start free trial</SvButton></div>
      <button bind:this={menuBtn} class="sv-nav-simple-toggle" {...nav.menuButtonProps()}>
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <path d={nav.menuOpen ? 'M5 5l10 10M15 5L5 15' : 'M3 6h14M3 10h14M3 14h14'} stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </button>
    </header>

    <nav class="sv-nav-simple-panel" aria-label="Main (mobile)" {...nav.panelProps()}>
      {#each nav.links as l (l.href)}<a {...nav.linkProps(l.href)}>{l.label}</a>{/each}
      <SvButton block onclick={startTrial}>Start free trial</SvButton>
    </nav>

    <main class="sv-nav-simple-page">
      <h2>{nav.title}</h2>
      <div class="sv-nav-simple-lines" aria-hidden="true"><i style:width="62%"></i><i style:width="44%"></i></div>
      <div class="sv-nav-simple-tiles" aria-hidden="true">
        {#each [0, 1, 2] as n (n)}<div><i></i><i></i><i></i></div>{/each}
      </div>
    </main>
  </div>
</div>

<SvToaster position="bottom-right" />

<style>
  .sv-nav-simple {
    width: 100%; box-sizing: border-box; padding: 32px 24px; min-height: 440px;
    display: flex; justify-content: center; align-items: flex-start;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-nav-simple-frame {
    width: 100%; max-width: 960px; overflow: hidden;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
  }
  .sv-nav-simple-bar {
    display: flex; align-items: center; gap: 28px; padding: 12px 20px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-nav-simple-brand { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; color: inherit; text-decoration: none; }
  .sv-nav-simple-mark { width: 20px; height: 20px; border-radius: 6px; background: var(--sg-fg, #0f172a); }
  .sv-nav-simple-links { display: flex; gap: 4px; flex: 1; min-width: 0; }
  .sv-nav-simple-links a, .sv-nav-simple-panel a {
    padding: 6px 10px; border-radius: var(--sg-radius, 6px); font-size: 14px; font-weight: 500;
    color: var(--sg-muted, #64748b); text-decoration: none;
  }
  .sv-nav-simple-links a:hover, .sv-nav-simple-panel a:hover { color: var(--sg-fg, #0f172a); background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-nav-simple-links a[aria-current='page'], .sv-nav-simple-panel a[aria-current='page'] {
    color: var(--sg-fg, #0f172a); background: color-mix(in srgb, var(--sg-fg, #0f172a) 7%, var(--sg-bg, #fff));
  }
  .sv-nav-simple a:focus-visible, .sv-nav-simple-toggle:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--sg-focus-ring, var(--sg-accent, #2563eb)); }
  .sv-nav-simple-toggle {
    display: none; place-items: center; width: 36px; height: 36px; margin-left: auto; padding: 0;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 6px);
    background: none; color: inherit; cursor: pointer;
  }
  .sv-nav-simple-toggle svg { display: block; }
  .sv-nav-simple-panel { display: none; }

  .sv-nav-simple-page { padding: 28px 20px 32px; }
  .sv-nav-simple-page h2 { margin: 0 0 12px; font-size: 22px; font-weight: 700; letter-spacing: -.01em; }
  .sv-nav-simple-lines i, .sv-nav-simple-tiles i {
    display: block; height: 9px; border-radius: 5px; background: color-mix(in srgb, var(--sg-fg, #0f172a) 9%, var(--sg-bg, #fff));
  }
  .sv-nav-simple-lines { display: grid; gap: 8px; margin-bottom: 24px; }
  .sv-nav-simple-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .sv-nav-simple-tiles div { display: grid; gap: 8px; padding: 16px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 8px); }
  .sv-nav-simple-tiles i:first-child { width: 28px; height: 28px; border-radius: 8px; margin-bottom: 6px; }
  .sv-nav-simple-tiles i:last-child { width: 60%; }

  @media (max-width: 767px) {
    .sv-nav-simple { padding: 16px 12px; }
    .sv-nav-simple-bar { padding: 10px 14px; }
    .sv-nav-simple-links, .sv-nav-simple-cta { display: none; }
    .sv-nav-simple-toggle { display: grid; }
    .sv-nav-simple-panel { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px 14px; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
    .sv-nav-simple-panel[hidden] { display: none; }
    .sv-nav-simple-panel a { padding: 10px 12px; font-size: 15px; }
    .sv-nav-simple-panel :global(.sv-btn) { margin-top: 8px; }
    .sv-nav-simple-page { padding: 20px 14px 24px; }
    .sv-nav-simple-tiles { grid-template-columns: 1fr; }
  }
</style>
