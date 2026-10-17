<script lang="ts" module>
  /**
   * Centered hero block - a landing-page hero: headline, one subline, a
   * primary and a secondary SvButton and a short note, centered over a
   * product shot. The shot is an app window drawn in CSS (sidebar, toolbar,
   * a mini data grid with status pills) whose lower half fades into the
   * page background. Pure UI-kit, --sg-* themed.
   *
   * Headless: createCenteredHero() below owns the copy, the two CTAs and
   * their click handling with no markup. The component under it is one
   * styled render of that core; import createCenteredHero from this file (or
   * `npx @svgrid/ui add hero-centered --headless` for the core alone) to
   * draw your own.
   */
  export type HeroCta = { label: string; href: string }
  export type CenteredHeroOptions = {
    headline?: string
    subline?: string
    note?: string
    primary?: HeroCta
    secondary?: HeroCta
    /** Handle a CTA in-app; the link then does not navigate. Omit it and the links go to href. */
    onCta?: (cta: HeroCta, kind: 'primary' | 'secondary') => void
  }

  export function createCenteredHero(opts: CenteredHeroOptions = {}) {
    // Defaults are the demo copy; a page passes its own (CMS, +page.ts load).
    const primary = opts.primary ?? { label: 'Start free', href: '/signup' }
    const secondary = opts.secondary ?? { label: 'Open the live demo', href: '/demo' }

    return {
      headline: opts.headline ?? 'Ship the admin your ops team actually opens',
      subline: opts.subline ?? 'Northwind turns your Postgres tables into editable grids with roles, approvals and an audit log. Connect the database, pick the tables, send the link.',
      note: opts.note ?? 'Free for up to 3 editors. Runs against a read replica if you prefer.',
      primary,
      secondary,
      /** Spread on the CTA link (or pass to a button component with href + onclick). */
      ctaProps: (kind: 'primary' | 'secondary') => {
        const cta = kind === 'primary' ? primary : secondary
        return {
          href: cta.href,
          onclick: (e: MouseEvent) => {
            if (!opts.onCta) return
            e.preventDefault()
            opts.onCta(cta, kind)
          },
        }
      },
    }
  }
</script>

<script lang="ts">
  import { SvButton, SvToaster, toast } from '@svgrid/grid'

  const hero = createCenteredHero({
    // Demo only: a real page leaves onCta out so the links navigate.
    onCta: (cta) => toast(`${cta.label}: this opens ${cta.href}`),
  })

  // Decorative rows for the product shot.
  const rows = [
    { id: 'RF-2041', who: 'Halden Outdoor', amt: '$412.00', st: 'Approved', tone: 'ok' },
    { id: 'RF-2040', who: 'Marta Ruiz', amt: '$89.50', st: 'Needs review', tone: 'warn' },
    { id: 'RF-2039', who: 'Pinecrest Dental', amt: '$1,240.00', st: 'Approved', tone: 'ok' },
    { id: 'RF-2038', who: 'Owen Clarke', amt: '$36.00', st: 'Escalated', tone: 'bad' },
    { id: 'RF-2037', who: 'Brightside Cafe', amt: '$218.75', st: 'Needs review', tone: 'warn' },
  ]
</script>

<section class="sv-hero-centered" aria-labelledby="sv-hero-centered-title">
  <div class="sv-hero-centered-copy">
    <h1 id="sv-hero-centered-title">{hero.headline}</h1>
    <p class="sv-hero-centered-sub">{hero.subline}</p>
    <div class="sv-hero-centered-ctas">
      <SvButton variant="primary" size="lg" {...hero.ctaProps('primary')}>{hero.primary.label}</SvButton>
      <SvButton variant="outline" size="lg" {...hero.ctaProps('secondary')}>{hero.secondary.label}</SvButton>
    </div>
    <p class="sv-hero-centered-note">{hero.note}</p>
  </div>

  <div class="sv-hero-centered-shot" aria-hidden="true">
    <div class="sv-hero-centered-window">
      <div class="sv-hero-centered-titlebar"><i></i><i></i><i></i><span>admin.northwind.app/refunds</span></div>
      <div class="sv-hero-centered-app">
        <div class="sv-hero-centered-side">
          <b></b><span class="sv-hero-centered-on">Refunds</span><span>Orders</span><span>Customers</span><span>Audit log</span>
        </div>
        <div class="sv-hero-centered-main">
          <div class="sv-hero-centered-tools"><strong>Refund requests</strong><em>Approve 2</em></div>
          <div class="sv-hero-centered-grid">
            <div class="sv-hero-centered-tr sv-hero-centered-th"><span>ID</span><span>Customer</span><span>Amount</span><span>Status</span></div>
            {#each rows as r (r.id)}
              <div class="sv-hero-centered-tr">
                <span>{r.id}</span><span>{r.who}</span><span>{r.amt}</span>
                <span><mark class="sv-hero-centered-pill sv-hero-centered-{r.tone}">{r.st}</mark></span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-hero-centered {
    width: 100%; box-sizing: border-box; overflow: hidden;
    display: flex; flex-direction: column; align-items: center; gap: 48px;
    padding: 72px 24px 0;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-hero-centered-copy { display: flex; flex-direction: column; align-items: center; text-align: center; max-width: 720px; }
  .sv-hero-centered h1 { margin: 0; font-size: 48px; font-weight: 750; line-height: 1.08; letter-spacing: -.03em; text-wrap: balance; }
  .sv-hero-centered-sub { margin: 18px 0 0; max-width: 58ch; font-size: 17px; line-height: 1.6; color: var(--sg-muted, #64748b); }
  .sv-hero-centered-ctas { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 30px; }
  .sv-hero-centered-note { margin: 14px 0 0; font-size: 13px; color: var(--sg-muted, #64748b); }

  .sv-hero-centered-shot { position: relative; width: 100%; max-width: 980px; height: 300px; overflow: hidden; }
  .sv-hero-centered-shot::after {
    content: ''; position: absolute; inset: 35% 0 0;
    background: linear-gradient(to bottom, transparent, var(--sg-bg, #fff));
  }
  .sv-hero-centered-window {
    border: 1px solid var(--sg-border, #e2e8f0); border-bottom: 0; border-radius: var(--sg-radius-lg, 12px) var(--sg-radius-lg, 12px) 0 0;
    background: var(--sg-bg, #fff); overflow: hidden;
    box-shadow: 0 24px 60px -24px color-mix(in srgb, var(--sg-fg, #0f172a) 30%, transparent);
  }
  .sv-hero-centered-titlebar {
    display: flex; align-items: center; gap: 6px; padding: 10px 14px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0); background: var(--sg-header-bg, #f8fafc);
  }
  .sv-hero-centered-titlebar i { width: 9px; height: 9px; border-radius: 50%; background: color-mix(in srgb, var(--sg-fg, #0f172a) 18%, var(--sg-bg, #fff)); }
  .sv-hero-centered-titlebar span { margin-left: 10px; font-size: 11.5px; color: var(--sg-muted, #64748b); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sv-hero-centered-app { display: grid; grid-template-columns: 170px minmax(0, 1fr); font-size: 12.5px; }
  .sv-hero-centered-side {
    display: flex; flex-direction: column; gap: 4px; padding: 14px 10px;
    border-right: 1px solid var(--sg-border, #e2e8f0); background: color-mix(in srgb, var(--sg-fg, #0f172a) 3%, var(--sg-bg, #fff));
  }
  .sv-hero-centered-side b { display: block; width: 26px; height: 26px; margin: 0 0 12px 6px; border-radius: 7px; background: var(--sg-accent, #2563eb); }
  .sv-hero-centered-side span { padding: 6px 8px; border-radius: 6px; color: var(--sg-muted, #64748b); }
  .sv-hero-centered-side .sv-hero-centered-on { color: var(--sg-fg, #0f172a); background: var(--sg-selection-bg, color-mix(in srgb, var(--sg-accent, #2563eb) 12%, transparent)); }
  .sv-hero-centered-main { padding: 14px 16px; min-width: 0; }
  .sv-hero-centered-tools { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .sv-hero-centered-tools strong { font-size: 14px; font-weight: 650; }
  .sv-hero-centered-tools em { font-style: normal; font-weight: 600; padding: 5px 10px; border-radius: 6px; background: var(--sg-accent, #2563eb); color: var(--sg-on-accent, #fff); }
  .sv-hero-centered-grid { border: 1px solid var(--sg-border, #e2e8f0); border-radius: 8px; overflow: hidden; }
  .sv-hero-centered-tr {
    display: grid; grid-template-columns: 90px minmax(0, 1.4fr) 100px 120px; align-items: center; column-gap: 10px;
    padding: 9px 12px; border-top: 1px solid var(--sg-border, #e2e8f0); white-space: nowrap;
  }
  .sv-hero-centered-tr span { overflow: hidden; text-overflow: ellipsis; }
  .sv-hero-centered-th { border-top: 0; font-weight: 600; color: var(--sg-muted, #64748b); background: var(--sg-header-bg, #f8fafc); }
  .sv-hero-centered-pill { padding: 2px 8px; border-radius: 999px; font-size: 11.5px; font-weight: 600; --_c: var(--sg-info, #0284c7); color: var(--_c); background: color-mix(in srgb, var(--_c) 14%, transparent); }
  .sv-hero-centered-ok { --_c: var(--sg-success, #16a34a); }
  .sv-hero-centered-warn { --_c: var(--sg-warning, #d97706); }
  .sv-hero-centered-bad { --_c: var(--sg-danger, #dc2626); }

  @media (max-width: 640px) {
    .sv-hero-centered { padding: 48px 16px 0; gap: 36px; }
    .sv-hero-centered h1 { font-size: 32px; }
    .sv-hero-centered-sub { font-size: 15.5px; }
    .sv-hero-centered-ctas { flex-direction: column; align-self: stretch; }
    .sv-hero-centered-shot { height: 240px; }
    .sv-hero-centered-app { grid-template-columns: minmax(0, 1fr); }
    .sv-hero-centered-side { display: none; }
    .sv-hero-centered-tr { grid-template-columns: minmax(0, 1fr) 72px 96px; }
    .sv-hero-centered-tr > :first-child { display: none; }
  }
</style>
