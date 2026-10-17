<script lang="ts" module>
  /**
   * Sitemap footer block - the end of a marketing page with a site footer:
   * brand and a one-line summary on the left, four link columns (Product,
   * Company, Resources, Legal) built from one data array, and a bottom bar
   * with the copyright year and an SvButton that scrolls back to the top.
   * An SvBadge marks a new link. Columns go 4, then 2, then 1 as the page
   * narrows. Pure UI-kit, --sg-* themed.
   *
   * Headless: createSitemapFooter() below owns the link data, the copyright
   * line and the heading/list ARIA wiring with no markup. The component under
   * it is one styled render of that core; import createSitemapFooter from this
   * file (or `npx @svgrid/ui add footers-sitemap --headless` for the core
   * alone) to draw your own.
   */
  type FooterLink = { label: string; href: string; badge?: string }
  type FooterColumn = { title: string; links: FooterLink[] }
  type SitemapFooterOptions = {
    /** The link columns; share this array with your navbar and sitemap. */
    columns?: FooterColumn[]
    /** Legal name printed after the year. */
    company?: string
    /** Prefix for the column heading ids; set it when two footers share a page. */
    idPrefix?: string
    /** Called by backToTop(); scroll in here. */
    onBackToTop?: () => void
  }

  const SITEMAP_COLUMNS: FooterColumn[] = [
    { title: 'Product', links: [
      { label: 'Dashboards', href: '/product/dashboards' },
      { label: 'Reports', href: '/product/reports' },
      { label: 'Data sources', href: '/product/sources' },
      { label: 'Changelog', href: '/changelog', badge: 'New' },
      { label: 'Pricing', href: '/pricing' },
    ] },
    { title: 'Company', links: [
      { label: 'About', href: '/about' },
      { label: 'Customers', href: '/customers' },
      { label: 'Careers', href: '/careers' },
      { label: 'Contact', href: '/contact' },
    ] },
    { title: 'Resources', links: [
      { label: 'Documentation', href: '/docs' },
      { label: 'API reference', href: '/docs/api' },
      { label: 'Guides', href: '/guides' },
      { label: 'System status', href: '/status' },
    ] },
    { title: 'Legal', links: [
      { label: 'Privacy policy', href: '/legal/privacy' },
      { label: 'Terms of service', href: '/legal/terms' },
      { label: 'Data processing', href: '/legal/dpa' },
      { label: 'Security', href: '/security' },
    ] },
  ]

  export function createSitemapFooter(opts: SitemapFooterOptions = {}) {
    // Defaults are the demo sample data; pass your own through opts.
    const columns = opts.columns ?? SITEMAP_COLUMNS
    const prefix = opts.idPrefix ?? 'sv-footer-sitemap'
    const year = new Date().getFullYear()
    const headingId = (i: number) => `${prefix}-h${i}`

    return {
      columns,
      year,
      copyright: `© ${year} ${opts.company ?? 'Northwind Analytics, Inc.'} All rights reserved.`,
      backToTop: () => opts.onBackToTop?.(),
      /** Spread on the <nav> that holds the columns. */
      navProps: () => ({ 'aria-label': 'Footer' }),
      /** Spread on a column heading. */
      headingProps: (i: number) => ({ id: headingId(i) }),
      /** Spread on a column's <ul>, so screen readers name the list by its heading. */
      listProps: (i: number) => ({ 'aria-labelledby': headingId(i) }),
    }
  }

  export type { FooterLink, FooterColumn, SitemapFooterOptions };
  export { SITEMAP_COLUMNS };
</script>

<script lang="ts">
  import { SvButton, SvBadge } from '@svgrid/grid'

  let root = $state<HTMLElement>()
  const footer = createSitemapFooter({
    onBackToTop: () => root?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
  })
</script>

<div class="sv-footer-sitemap" bind:this={root}>
  <div class="sv-footer-sitemap-site">
    <main class="sv-footer-sitemap-page">
      <h2>Reports your operations team will open</h2>
      <div class="sv-footer-sitemap-lines" aria-hidden="true"><i style:--w="86%"></i><i style:--w="64%"></i></div>
    </main>

    <footer class="sv-footer-sitemap-footer">
      <div class="sv-footer-sitemap-top">
        <div class="sv-footer-sitemap-brand">
          <a class="sv-footer-sitemap-logo" href="/">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="currentColor" /><path class="sv-footer-sitemap-logo-ink" d="M8 16V8l8 8V8" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
            Northwind
          </a>
          <p>Dashboards and scheduled reports for operations teams, on top of the data you already have.</p>
        </div>

        <nav class="sv-footer-sitemap-cols" {...footer.navProps()}>
          {#each footer.columns as col, i (col.title)}
            <div>
              <h3 {...footer.headingProps(i)}>{col.title}</h3>
              <ul {...footer.listProps(i)}>
                {#each col.links as link (link.href)}
                  <li>
                    <a href={link.href}>{link.label}</a>
                    {#if link.badge}<SvBadge variant="accent" size="sm">{link.badge}</SvBadge>{/if}
                  </li>
                {/each}
              </ul>
            </div>
          {/each}
        </nav>
      </div>

      <div class="sv-footer-sitemap-bottom">
        <p>{footer.copyright}</p>
        <SvButton variant="ghost" size="sm" onclick={footer.backToTop}>Back to top</SvButton>
      </div>
    </footer>
  </div>
</div>

<style>
  .sv-footer-sitemap {
    width: 100%; box-sizing: border-box; padding: 32px 24px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-footer-sitemap-site {
    max-width: 1040px; margin: 0 auto; overflow: hidden;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
  }
  .sv-footer-sitemap-page { padding: 40px 32px; display: flex; flex-direction: column; gap: 16px; }
  .sv-footer-sitemap-page h2 { margin: 0; font-size: 26px; font-weight: 700; line-height: 1.2; letter-spacing: -.02em; max-width: 26ch; }
  .sv-footer-sitemap-lines { display: flex; flex-direction: column; gap: 10px; max-width: 460px; }
  .sv-footer-sitemap-lines i { display: block; width: var(--w); height: 8px; border-radius: 4px; background: color-mix(in srgb, var(--sg-fg, #0f172a) 10%, var(--sg-bg, #fff)); }

  .sv-footer-sitemap-footer {
    padding: 40px 32px 20px; border-top: 1px solid var(--sg-border, #e2e8f0);
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 4%, var(--sg-bg, #fff));
  }
  .sv-footer-sitemap-top { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2.4fr); gap: 40px; }
  .sv-footer-sitemap-logo { display: inline-flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: var(--sg-fg, #0f172a); text-decoration: none; }
  .sv-footer-sitemap-logo svg { display: block; }
  .sv-footer-sitemap-logo-ink { stroke: var(--sg-bg, #fff); }
  .sv-footer-sitemap-brand p { margin: 12px 0 0; max-width: 30ch; font-size: 13.5px; line-height: 1.55; color: var(--sg-muted, #64748b); }
  .sv-footer-sitemap-cols { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 28px 24px; }
  .sv-footer-sitemap-cols h3 { margin: 0 0 12px; font-size: 13px; font-weight: 650; }
  .sv-footer-sitemap-cols ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
  .sv-footer-sitemap-cols li { display: flex; align-items: center; gap: 6px; }
  .sv-footer-sitemap-cols a { font-size: 13.5px; color: var(--sg-muted, #64748b); text-decoration: none; }
  .sv-footer-sitemap-cols a:hover { color: var(--sg-fg, #0f172a); text-decoration: underline; text-underline-offset: 3px; }
  .sv-footer-sitemap a:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 2px; border-radius: 3px; }
  .sv-footer-sitemap-bottom {
    display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
    margin-top: 36px; padding-top: 16px; border-top: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-footer-sitemap-bottom p { margin: 0; font-size: 12.5px; color: var(--sg-muted, #64748b); }

  @media (max-width: 860px) {
    .sv-footer-sitemap { padding: 16px 12px; }
    .sv-footer-sitemap-page { padding: 28px 20px; }
    .sv-footer-sitemap-page h2 { font-size: 22px; }
    .sv-footer-sitemap-footer { padding: 28px 20px 16px; }
    .sv-footer-sitemap-top { grid-template-columns: minmax(0, 1fr); gap: 28px; }
    .sv-footer-sitemap-cols { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 340px) {
    .sv-footer-sitemap-cols { grid-template-columns: minmax(0, 1fr); }
  }
</style>
