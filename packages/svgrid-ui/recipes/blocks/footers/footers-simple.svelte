<script lang="ts" module>
  /**
   * Simple footer block - the smallest useful site footer: one row with the
   * copyright year on the left and three links on the right, under the end
   * of an app page. The Status link carries a green Operational SvBadge.
   * On phones the row stacks with the links above the copyright.
   * Pure UI-kit, --sg-* themed.
   *
   * Headless: createSimpleFooter() below owns the links, the copyright line
   * and the aria-current wiring with no markup. The component under it is one
   * styled render of that core; import createSimpleFooter from this file (or
   * `npx @svgrid/ui add footers-simple --headless` for the core alone) to
   * draw your own.
   */
  type FooterLink = { label: string; href: string; status?: boolean }
  type SimpleFooterOptions = {
    links?: FooterLink[]
    company?: string
    /** The current path, so the matching link gets aria-current="page". */
    currentPath?: string
  }

  export function createSimpleFooter(opts: SimpleFooterOptions = {}) {
    // Defaults are the demo sample data; pass your own through opts.
    const year = new Date().getFullYear()
    return {
      links: opts.links ?? [
        { label: 'Privacy', href: '/legal/privacy' },
        { label: 'Terms', href: '/legal/terms' },
        { label: 'Status', href: '/status', status: true },
      ],
      year,
      copyright: `© ${year} ${opts.company ?? 'Fieldline Software Ltd.'}`,
      /** Spread on each link's <a>. */
      linkProps: (link: FooterLink) => ({
        href: link.href,
        'aria-current': link.href === opts.currentPath ? ('page' as const) : undefined,
      }),
    }
  }

  export type { FooterLink, SimpleFooterOptions };
</script>

<script lang="ts">
  import { SvBadge } from '@svgrid/grid'

  const footer = createSimpleFooter()
</script>

<div class="sv-footer-simple">
  <div class="sv-footer-simple-site">
    <main class="sv-footer-simple-page">
      <h2>Invoices</h2>
      <div class="sv-footer-simple-rows" aria-hidden="true">
        {#each [78, 64, 82, 58] as w, i (i)}<i style:--w="{w}%"></i>{/each}
      </div>
    </main>

    <footer class="sv-footer-simple-footer">
      <p>{footer.copyright}</p>
      <nav aria-label="Legal and status">
        <ul>
          {#each footer.links as link (link.href)}
            <li>
              <a {...footer.linkProps(link)}>
                {link.label}
                {#if link.status}<SvBadge variant="success" dot size="sm">Operational</SvBadge>{/if}
              </a>
            </li>
          {/each}
        </ul>
      </nav>
    </footer>
  </div>
</div>

<style>
  .sv-footer-simple {
    width: 100%; box-sizing: border-box; padding: 32px 24px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-footer-simple-site {
    max-width: 960px; margin: 0 auto; overflow: hidden;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
  }
  .sv-footer-simple-page { padding: 28px 28px 32px; }
  .sv-footer-simple-page h2 { margin: 0 0 18px; font-size: 22px; font-weight: 700; letter-spacing: -.01em; }
  .sv-footer-simple-rows { display: flex; flex-direction: column; }
  .sv-footer-simple-rows i { display: flex; align-items: center; height: 40px; border-top: 1px solid var(--sg-border, #e2e8f0); }
  .sv-footer-simple-rows i::before {
    content: ''; display: block; width: var(--w); height: 8px; border-radius: 4px;
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 9%, var(--sg-bg, #fff));
  }

  .sv-footer-simple-footer {
    display: flex; align-items: center; justify-content: space-between; gap: 12px 24px;
    padding: 18px 28px; border-top: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-footer-simple-footer p { margin: 0; font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-footer-simple-footer ul { list-style: none; margin: 0; padding: 0; display: flex; gap: 24px; }
  .sv-footer-simple-footer a { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--sg-muted, #64748b); text-decoration: none; }
  .sv-footer-simple-footer a:hover { color: var(--sg-fg, #0f172a); text-decoration: underline; text-underline-offset: 3px; }
  .sv-footer-simple-footer a:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 2px; border-radius: 3px; }

  @media (max-width: 560px) {
    .sv-footer-simple { padding: 16px 12px; }
    .sv-footer-simple-page { padding: 20px 16px 24px; }
    .sv-footer-simple-footer { flex-direction: column-reverse; align-items: flex-start; padding: 18px 16px; }
  }
</style>
