<script lang="ts" module>
  /**
   * Page heading with breadcrumbs block - the heading of a detail page three
   * levels deep: an SvBreadcrumb trail (Projects / Fieldline Mobile / Releases)
   * above the h1, a status SvBadge, and "Edit notes" + "Publish release"
   * SvButtons on the right. Below 640 px the trail is replaced by a single
   * "Back to Releases" link. Publishing shows the button's loading state, flips
   * the badge and confirms with SvToaster. Pure UI-kit, --sg-* themed.
   *
   * Headless: createReleaseHeading() below owns the trail, the parent crumb
   * the back link points at and the publish flow with no markup. The
   * component under it is one styled render of that core; import
   * createReleaseHeading from this file (or `npx @svgrid/ui add
   * page-headings-breadcrumbs --headless` for the core alone) to draw your own.
   */
  import type { BreadcrumbItem } from '@svgrid/grid'

  export type ReleaseHeadingOptions = {
    /** Crumb labels from the root down; the last one is the current page. */
    path?: string[]
    published?: boolean
    /** Called when a crumb (or the back link) is followed. */
    onNavigate?: (label: string) => void
    /** Called to publish; throw (or reject) to stay in review. */
    onPublish?: () => Promise<void> | void
  }

  export function createReleaseHeading(opts: ReleaseHeadingOptions = {}) {
    // Every crumb but the last is a link; the back link points at the parent crumb.
    const path = opts.path ?? ['Projects', 'Fieldline Mobile', 'Releases', 'v2.4.0']
    let published = $state(opts.published ?? false)
    let publishing = $state(false)

    const trail: BreadcrumbItem[] = path.map((label, i) =>
      i < path.length - 1 ? { label, onClick: () => opts.onNavigate?.(label) } : { label },
    )
    const parent = trail[trail.length - 2] ?? trail[0]!

    async function publish() {
      if (publishing || published) return
      publishing = true
      try {
        await opts.onPublish?.()
        published = true
      } catch {
        // Stays in review.
      } finally {
        publishing = false
      }
    }

    return {
      trail, parent,
      get published() { return published },
      get publishing() { return publishing },
      publish,
      /** Spread on a plain <button> that goes one level up. */
      backProps: () => ({ type: 'button' as const, onclick: () => parent.onClick?.() }),
    }
  }
</script>

<script lang="ts">
  import { SvBreadcrumb, SvButton, SvBadge, SvToaster, toast } from '@svgrid/grid'

  const release = createReleaseHeading({
    onNavigate: (where) => toast(`Opening ${where}`),
    // Replace with your request; a thrown error keeps the release in review.
    onPublish: () =>
      toast.promise(new Promise<void>((res) => setTimeout(res, 1000)), {
        loading: 'Publishing v2.4.0 to the App Store and Play...',
        success: 'v2.4.0 is live',
        error: 'Publish failed',
      }),
  })
</script>

<div class="sv-ph-crumbs">
  <header class="sv-ph-crumbs-head">
    <div class="sv-ph-crumbs-titles">
      <div class="sv-ph-crumbs-trail"><SvBreadcrumb items={release.trail} separator="/" /></div>
      <button class="sv-ph-crumbs-back" {...release.backProps()}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        Back to {release.parent.label}
      </button>
      <div class="sv-ph-crumbs-title-row">
        <h1>Release v2.4.0</h1>
        <SvBadge variant={release.published ? 'success' : 'warning'} dot>{release.published ? 'Live' : 'In review'}</SvBadge>
      </div>
      <p class="sv-ph-crumbs-sub">Cut from <code>main</code> on Oct 12 by Jonah Reyes. 18 changes, 3 fixes.</p>
    </div>
    <div class="sv-ph-crumbs-actions">
      <SvButton variant="secondary" onclick={() => toast('Editing release notes')}>Edit notes</SvButton>
      <SvButton variant="primary" loading={release.publishing} disabled={release.published} onclick={release.publish}>
        {release.published ? 'Published' : 'Publish release'}
      </SvButton>
    </div>
  </header>

  <section class="sv-ph-crumbs-body" aria-label="Release notes">
    <h2>What's new</h2>
    <ul>
      <li>Offline mode keeps the last 7 days of routes on the device.</li>
      <li>Driver sign-off now captures a photo with the signature.</li>
      <li>Fixed: stops reordered twice after a manual edit.</li>
    </ul>
    <div class="sv-ph-crumbs-skel" aria-hidden="true"><span></span><span></span><span class="sv-ph-crumbs-short"></span></div>
  </section>
</div>

<SvToaster position="bottom-right" />

<style>
  .sv-ph-crumbs {
    min-height: 360px; padding: 24px 32px 28px; box-sizing: border-box;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 14px);
  }
  .sv-ph-crumbs-head {
    display: flex; align-items: flex-end; justify-content: space-between; gap: 16px 24px; flex-wrap: wrap;
    padding-bottom: 20px; border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-ph-crumbs-titles { min-width: 0; }
  .sv-ph-crumbs-trail { font-size: 13px; color: var(--sg-muted, #64748b); margin-bottom: 10px; }
  .sv-ph-crumbs-back {
    display: none; align-items: center; gap: 4px; margin: 0 0 10px -4px; padding: 4px;
    background: none; border: 0; font: inherit; font-size: 13.5px; color: var(--sg-muted, #64748b); cursor: pointer;
  }
  .sv-ph-crumbs-back:hover { color: var(--sg-fg, #0f172a); }
  .sv-ph-crumbs-back:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); border-radius: 6px; }
  .sv-ph-crumbs-title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  h1 { margin: 0; font-weight: 700; font-size: 26px; line-height: 1.2; letter-spacing: -.02em; }
  .sv-ph-crumbs-sub { margin: 6px 0 0; font-size: 14px; color: var(--sg-muted, #64748b); }
  code {
    font-size: 12.5px; padding: 1px 5px; border-radius: 4px;
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 9%, transparent); color: var(--sg-fg, #0f172a);
  }
  .sv-ph-crumbs-actions { display: flex; gap: 8px; }

  .sv-ph-crumbs-body { padding-top: 20px; max-width: 640px; }
  h2 { margin: 0 0 8px; font-size: 15px; font-weight: 650; }
  ul { margin: 0 0 18px; padding-left: 18px; list-style: disc; font-size: 14px; line-height: 1.7; color: var(--sg-fg, #0f172a); }
  .sv-ph-crumbs-skel { display: flex; flex-direction: column; gap: 8px; }
  .sv-ph-crumbs-skel span { height: 10px; border-radius: 5px; background: color-mix(in srgb, var(--sg-fg, #0f172a) 9%, transparent); }
  .sv-ph-crumbs-skel .sv-ph-crumbs-short { width: 55%; }

  @media (max-width: 640px) {
    .sv-ph-crumbs { padding: 16px 16px 24px; }
    .sv-ph-crumbs-trail { display: none; }
    .sv-ph-crumbs-back { display: inline-flex; }
    h1 { font-size: 22px; }
    .sv-ph-crumbs-actions { width: 100%; flex-wrap: wrap; }
    .sv-ph-crumbs-actions > :global(*) { flex: 1; }
  }
</style>
