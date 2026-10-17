<script lang="ts" module>
  /**
   * Features with icons block - a landing-page section for a data product: a
   * heading, a one-line intro and six features, each a small inline-SVG icon,
   * a title and two lines of text, three across on desktop, two on tablets and
   * one on phones. An SvButton trial CTA shows its loading state, an SvBadge
   * marks the newest feature, and an SvToaster confirms. Pure UI-kit, --sg-*
   * themed.
   *
   * Headless: createFeatureGrid() below owns the feature list and the trial
   * request with no markup. The component under it is one styled render of
   * that core; import createFeatureGrid from this file (or `npx @svgrid/ui add
   * features-icons --headless` for the core alone) to draw your own.
   */
  export type IconFeature = {
    id: string
    title: string
    text: string
    /** SVG path data for a 24x24 stroke icon. */
    icon: string
    /** Short tag shown next to the title, e.g. "New". */
    tag?: string
  }
  export type FeatureGridOptions = {
    features?: IconFeature[]
    /** The trial CTA was pressed; throw (or reject) to let the user retry. */
    onStart?: () => Promise<void> | void
  }

  const FEATURES: IconFeature[] = [
    { id: 'sync', title: 'Warehouse sync', text: 'Reads Postgres, MySQL and BigQuery tables every 15 minutes. No CSV exports to keep up to date.', icon: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zm0 0v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3' },
    { id: 'queries', title: 'Saved queries', text: 'Every SQL edit is versioned. Compare two runs side by side and roll a query back in one click.', icon: 'M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14' },
    { id: 'access', title: 'Row-level access', text: 'Rules per team decide which rows each person sees, down to region or account owner.', icon: 'M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6zM9.5 12l2 2 3.5-4' },
    { id: 'reports', title: 'Scheduled reports', text: 'Email a PDF or CSV every Monday at 9:00 in each reader\'s own time zone.', icon: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3M8 17h6' },
    { id: 'alerts', title: 'Metric alerts', text: 'Get a message when a metric crosses a threshold or drifts three deviations from its weekly norm.', icon: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4', tag: 'New' },
    { id: 'audit', title: 'Audit log', text: 'Every query, export and permission change, kept for 400 days and exportable as CSV.', icon: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01' },
  ]

  let uid = 0

  export function createFeatureGrid(opts: FeatureGridOptions = {}) {
    const features = opts.features ?? FEATURES
    const base = `sv-features-${uid++}`
    let busy = $state(false)

    async function start() {
      if (busy) return
      busy = true
      try {
        await opts.onStart?.()
      } catch {
        // Leave the button enabled for a retry.
      } finally {
        busy = false
      }
    }

    return {
      features,
      get busy() { return busy },
      start,
      /** Spread on the section heading. */
      headingProps: () => ({ id: `${base}-title` }),
      /** Spread on the <section> or list that holds the features. */
      sectionProps: () => ({ 'aria-labelledby': `${base}-title` }),
      /** Spread on the title element of feature `f`. */
      titleProps: (f: IconFeature) => ({ id: `${base}-${f.id}` }),
      /** Spread on the item of feature `f`. */
      itemProps: (f: IconFeature) => ({ 'aria-labelledby': `${base}-${f.id}` }),
      /** Spread on a plain trial <button>. */
      startProps: () => ({ type: 'button' as const, disabled: busy, 'aria-busy': busy, onclick: start }),
    }
  }
</script>

<script lang="ts">
  import { SvButton, SvBadge, SvToaster, toast } from '@svgrid/grid'

  const grid = createFeatureGrid({
    // Replace with your sign-up route or request.
    onStart: () =>
      toast.promise(new Promise<void>((res) => setTimeout(res, 900)), {
        loading: 'Creating your workspace...',
        success: 'Workspace ready. Connect your first source to see data.',
        error: 'Could not create the workspace. Try again.',
      }).then(() => {}),
  })
</script>

<section class="sv-fic" {...grid.sectionProps()}>
  <div class="sv-fic-head">
    <p class="sv-fic-kicker">Lumen for data teams</p>
    <h2 {...grid.headingProps()}>What runs in your workspace</h2>
    <p class="sv-fic-lead">Connect a database once. Queries, reports, alerts and access rules all read from it.</p>
  </div>

  <ul class="sv-fic-list">
    {#each grid.features as f (f.id)}
      <li class="sv-fic-item" {...grid.itemProps(f)}>
        <span class="sv-fic-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d={f.icon} /></svg></span>
        <div>
          <h3 {...grid.titleProps(f)}>{f.title}{#if f.tag}<span class="sv-fic-tag"><SvBadge variant="accent" size="sm">{f.tag}</SvBadge></span>{/if}</h3>
          <p>{f.text}</p>
        </div>
      </li>
    {/each}
  </ul>

  <div class="sv-fic-cta">
    <SvButton variant="primary" loading={grid.busy} onclick={grid.start}>Start a 14-day trial</SvButton>
    <span class="sv-fic-note">No card needed. Your data stays in your warehouse.</span>
  </div>
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-fic {
    width: 100%; box-sizing: border-box; padding: 56px 40px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    font-family: var(--sg-font, inherit);
  }
  .sv-fic-head { max-width: 620px; margin: 0 auto 40px; text-align: center; }
  .sv-fic-kicker { margin: 0 0 8px; font-size: 13px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .sv-fic-head h2 { margin: 0 0 10px; font-size: 30px; font-weight: 700; line-height: 1.2; letter-spacing: -.02em; }
  .sv-fic-lead { margin: 0; font-size: 15.5px; line-height: 1.55; color: var(--sg-muted, #64748b); }
  .sv-fic-list {
    list-style: none; margin: 0 auto; padding: 0; max-width: 1040px;
    display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 32px 36px;
  }
  .sv-fic-item { display: flex; gap: 14px; align-items: flex-start; }
  .sv-fic-icon {
    display: grid; place-items: center; flex: none; width: 38px; height: 38px; box-sizing: border-box; border-radius: var(--sg-radius, 8px);
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 6%, var(--sg-bg, #fff));
    border: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-fic-icon svg { display: block; width: 20px; height: 20px; }
  .sv-fic-icon path { fill: none; stroke: var(--sg-fg, #0f172a); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
  .sv-fic-item h3 { display: flex; align-items: center; gap: 8px; margin: 2px 0 6px; font-size: 15px; font-weight: 650; }
  .sv-fic-tag { display: inline-flex; }
  .sv-fic-item p { margin: 0; font-size: 14px; line-height: 1.55; color: var(--sg-muted, #64748b); }
  .sv-fic-cta { display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap; margin-top: 44px; }
  .sv-fic-note { font-size: 13px; color: var(--sg-muted, #64748b); }

  @media (max-width: 900px) {
    .sv-fic-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 560px) {
    .sv-fic { padding: 36px 16px; }
    .sv-fic-head { margin-bottom: 28px; }
    .sv-fic-head h2 { font-size: 24px; }
    .sv-fic-list { grid-template-columns: 1fr; gap: 24px; }
  }
</style>
