<script lang="ts" module>
  /**
   * Announcement bar block - a slim bar across the top of the app with one
   * line of news, a link to read more and a dismiss button, shown above a
   * mock page header. Dismissing hides it and fires an SvToaster toast with
   * Undo; an SvButton in the page brings it back. SvBadge marks it as new.
   * Pure UI-kit, --sg-* themed.
   *
   * Headless: createAnnouncement() below owns the bar's visibility and the
   * dismiss / undo / show-again actions with no markup. The component under it
   * is one styled render of that core; import createAnnouncement from this
   * file (or `npx @svgrid/ui add banners-announcement --headless` for the core
   * alone) to draw your own.
   */
  export type AnnouncementOptions = {
    /** Start visible (default true); pass false when the user already dismissed it. */
    open?: boolean
    /** Called after a dismiss; call `undo` to show the bar again. */
    onDismiss?: (undo: () => void) => void
    onShow?: () => void
  }

  export function createAnnouncement(opts: AnnouncementOptions = {}) {
    let open = $state(opts.open ?? true)

    function show() {
      open = true
      opts.onShow?.()
    }

    function dismiss() {
      if (!open) return
      open = false
      opts.onDismiss?.(() => { open = true })
    }

    return {
      get open() { return open },
      show,
      dismiss,
      /** Spread on the bar's wrapper. */
      regionProps: (label = 'Announcement') => ({ role: 'region' as const, 'aria-label': label }),
      /** Spread on a plain dismiss <button>. */
      dismissProps: () => ({ type: 'button' as const, 'aria-label': 'Dismiss announcement', onclick: dismiss }),
    }
  }
</script>

<script lang="ts">
  import { SvBadge, SvButton, SvToaster, toast } from '@svgrid/grid'

  const bar = createAnnouncement({
    onDismiss: (undo) => toast('Announcement dismissed', { action: { label: 'Undo', onClick: undo } }),
  })

  function readMore(e: MouseEvent) {
    // Demo only: in your app let the link navigate to the changelog.
    e.preventDefault()
    toast.info('Opening the 4.2 changelog')
  }
</script>

<div class="sv-bn-announce">
  <div class="sv-bn-announce-frame">
    {#if bar.open}
      <div class="sv-bn-announce-bar" {...bar.regionProps()}>
        <span class="sv-bn-announce-tag"><SvBadge size="sm" variant="neutral">New</SvBadge></span>
        <p>
          Scheduled exports can now run on weekends and public holidays.
          <a href="/changelog/4-2" onclick={readMore}>Read what changed <span aria-hidden="true">&rarr;</span></a>
        </p>
        <button class="sv-bn-announce-x" {...bar.dismissProps()}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
        </button>
      </div>
    {/if}

    <header class="sv-bn-announce-nav">
      <span class="sv-bn-announce-logo"><span class="sv-bn-announce-mark" aria-hidden="true"></span>Acme Analytics</span>
      <span class="sv-bn-announce-links" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span class="sv-bn-announce-avatar" aria-hidden="true"></span>
    </header>

    <main class="sv-bn-announce-page">
      <div class="sv-bn-announce-head">
        <div>
          <h2>Scheduled exports</h2>
          <p class="sv-bn-announce-muted">12 exports, next run today at 18:00</p>
        </div>
        {#if !bar.open}
          <SvButton variant="outline" size="sm" onclick={bar.show}>Show announcement again</SvButton>
        {/if}
      </div>
      <div class="sv-bn-announce-rows" aria-hidden="true">
        {#each [72, 58, 84, 64, 76] as w}
          <div class="sv-bn-announce-row"><i class="sv-bn-announce-dot"></i><i style:width="{w * 0.4}%"></i><i class="sv-bn-announce-end"></i></div>
        {/each}
      </div>
    </main>
  </div>
</div>

<SvToaster position="bottom-right" />

<style>
  .sv-bn-announce {
    width: 100%; box-sizing: border-box; padding: 32px 24px; min-height: 460px;
    display: flex; align-items: flex-start; justify-content: center;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-bn-announce-frame {
    width: 100%; max-width: 920px; overflow: hidden;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
    background: var(--sg-bg, #fff);
  }
  /* Inverted neutral bar: fg as the surface reads as "system message" in both themes. */
  .sv-bn-announce-bar {
    display: flex; align-items: center; gap: 12px; padding: 9px 12px 9px 16px;
    background: var(--sg-fg, #0f172a); color: var(--sg-bg, #fff);
    font-size: 13px; line-height: 1.45;
  }
  .sv-bn-announce-tag { flex: none; }
  .sv-bn-announce-tag :global(.sv-badge) { color: inherit; background: color-mix(in srgb, currentColor 16%, transparent); border-color: color-mix(in srgb, currentColor 30%, transparent); }
  .sv-bn-announce-bar p { flex: 1; min-width: 0; margin: 0; text-align: center; }
  .sv-bn-announce-bar a { color: inherit; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; white-space: nowrap; }
  .sv-bn-announce-bar a:focus-visible, .sv-bn-announce-x:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 2px; border-radius: 4px; }
  .sv-bn-announce-x {
    flex: none; display: grid; place-items: center; width: 28px; height: 28px; padding: 0;
    border: 0; border-radius: 6px; background: none; color: inherit; cursor: pointer; opacity: .75;
  }
  .sv-bn-announce-x:hover { opacity: 1; background: color-mix(in srgb, currentColor 14%, transparent); }
  .sv-bn-announce-x svg { display: block; }

  .sv-bn-announce-nav {
    display: flex; align-items: center; gap: 24px; padding: 14px 20px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-bn-announce-logo { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; }
  .sv-bn-announce-mark { width: 18px; height: 18px; border-radius: 5px; background: var(--sg-fg, #0f172a); }
  .sv-bn-announce-links { display: flex; gap: 16px; flex: 1; }
  .sv-bn-announce-links i, .sv-bn-announce-row i { display: block; height: 8px; border-radius: 4px; background: color-mix(in srgb, var(--sg-fg, #0f172a) 10%, var(--sg-bg, #fff)); }
  .sv-bn-announce-links i { width: 54px; }
  .sv-bn-announce-avatar { width: 28px; height: 28px; border-radius: 50%; background: color-mix(in srgb, var(--sg-fg, #0f172a) 12%, var(--sg-bg, #fff)); }

  .sv-bn-announce-page { padding: 24px 20px 28px; }
  .sv-bn-announce-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
  h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; letter-spacing: -.01em; }
  .sv-bn-announce-muted { margin: 0; font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-bn-announce-rows { display: flex; flex-direction: column; border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 8px); }
  .sv-bn-announce-row { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-bn-announce-row:last-child { border-bottom: 0; }
  .sv-bn-announce-row i.sv-bn-announce-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
  .sv-bn-announce-row i.sv-bn-announce-end { width: 60px; margin-left: auto; }

  @media (max-width: 640px) {
    .sv-bn-announce { padding: 16px 12px; }
    .sv-bn-announce-bar { align-items: flex-start; padding: 10px 8px 10px 14px; }
    .sv-bn-announce-bar p { text-align: left; }
    .sv-bn-announce-tag, .sv-bn-announce-links { display: none; }
    .sv-bn-announce-nav { justify-content: space-between; padding: 12px 14px; }
    .sv-bn-announce-page { padding: 18px 14px 20px; }
  }
</style>
