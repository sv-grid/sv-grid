<script lang="ts" module>
  /**
   * Centered call to action block - a closing section on an accent band: one
   * heading, one line of copy and two SvButtons. The primary action shows its
   * loading state, resolves through an SvToaster toast and leaves a status
   * line under the buttons; the secondary is a plain link. Pure UI-kit,
   * --sg-* themed.
   *
   * Headless: createCtaCentered() below owns the copy, the two actions, click
   * tracking and the pending/done state with no markup. The component under it
   * is one styled render of that core; import createCtaCentered from this file
   * (or `npx @svgrid/ui add cta-centered --headless` for the core alone) to
   * draw your own.
   */
  export type CtaAction = { id: string; label: string; href?: string }
  export type CtaCenteredOptions = {
    heading?: string
    body?: string
    primary?: CtaAction
    secondary?: CtaAction
    /** Shown once the primary action resolves. */
    doneText?: string
    /** Fires on every press, before anything else. Send it to your analytics. */
    onTrack?: (action: CtaAction) => void
    /** Runs a press. Leave it out and the action's href navigates as a normal link. Throw to stay idle. */
    onAction?: (action: CtaAction) => Promise<void> | void
    onError?: (error: unknown) => void
  }

  export function createCtaCentered(opts: CtaCenteredOptions = {}) {
    // Defaults are the demo copy; pass your own through opts.
    const primary = opts.primary ?? { id: 'trial', label: 'Start free trial', href: '/signup' }
    const secondary = opts.secondary ?? { id: 'sales', label: 'Talk to sales', href: '/contact/sales' }
    let pending = $state<string | null>(null)
    let done = $state<string | null>(null)

    async function run(action: CtaAction, ev?: Event) {
      opts.onTrack?.(action)
      if (!opts.onAction) return
      ev?.preventDefault()
      if (pending) return
      pending = action.id
      try {
        await opts.onAction(action)
        done = action.id
      } catch (e) {
        opts.onError?.(e)
      } finally {
        pending = null
      }
    }

    return {
      heading: opts.heading ?? 'Start your 14-day Northwind trial',
      body: opts.body ?? 'Connect a database or upload a CSV and build your first dashboard in about ten minutes. No credit card needed.',
      doneText: opts.doneText ?? 'Your trial workspace is ready. Setup steps are on their way to your inbox.',
      primary,
      secondary,
      /** Id of the action whose request is running, or null. */
      get pending() { return pending },
      /** Id of the last action that resolved, or null. */
      get done() { return done },
      run,
      /** Spread on a plain <a> or <button> for one action. */
      actionProps: (action: CtaAction) => ({
        href: action.href,
        'aria-busy': pending === action.id,
        'aria-disabled': !!pending && pending !== action.id,
        onclick: (e: MouseEvent) => run(action, e),
      }),
    }
  }
</script>

<script lang="ts">
  import { SvButton, SvToaster, toast } from '@svgrid/grid'

  const cta = createCtaCentered({
    // onTrack: (a) => analytics.track('cta_click', { id: a.id }),
    // Replace with your request (or drop onAction to let the href navigate).
    onAction: (a) =>
      a.id === 'trial'
        ? toast.promise(new Promise<void>((res) => setTimeout(res, 1200)), {
            loading: 'Creating your workspace...',
            success: 'Workspace created',
            error: 'Could not start the trial. Try again.',
          }).then(() => {})
        : void toast('Opening the sales contact form'),
  })
</script>

<section class="sv-cta-center" aria-labelledby="sv-cta-center-title">
  <div class="sv-cta-center-band">
    <svg class="sv-cta-center-rings" viewBox="0 0 400 400" aria-hidden="true">
      <circle cx="200" cy="200" r="80" /><circle cx="200" cy="200" r="130" /><circle cx="200" cy="200" r="180" />
    </svg>
    <h2 id="sv-cta-center-title">{cta.heading}</h2>
    <p>{cta.body}</p>
    <div class="sv-cta-center-actions">
      <SvButton variant="primary" size="lg" href={cta.primary.href} loading={cta.pending === cta.primary.id}
        disabled={cta.done === cta.primary.id || (!!cta.pending && cta.pending !== cta.primary.id)} onclick={(e) => cta.run(cta.primary, e)}>{cta.primary.label}</SvButton>
      <SvButton variant="ghost" size="lg" href={cta.secondary.href} loading={cta.pending === cta.secondary.id}
        disabled={!!cta.pending && cta.pending !== cta.secondary.id} onclick={(e) => cta.run(cta.secondary, e)}>{cta.secondary.label} <span aria-hidden="true">&rarr;</span></SvButton>
    </div>
    <p class="sv-cta-center-status" role="status">{cta.done === cta.primary.id ? cta.doneText : ''}</p>
  </div>
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-cta-center {
    width: 100%; box-sizing: border-box; padding: 56px 24px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-cta-center-band {
    /* --_band is the band color; --_ink is the text on it. */
    --_band: var(--sg-accent, #2563eb);
    --_ink: var(--sg-on-accent, #fff);
    position: relative; overflow: hidden; isolation: isolate;
    max-width: 960px; margin: 0 auto; padding: 64px 32px 40px; box-sizing: border-box;
    display: flex; flex-direction: column; align-items: center; text-align: center;
    border-radius: var(--sg-radius-lg, 14px); background: var(--_band); color: var(--_ink);
  }
  /* Push the accent away from its text color, so body copy clears 4.5:1 even
     where the raw accent and --sg-on-accent only reach 3:1 (orange, light blue). */
  @supports (color: rgb(from red r g b)) {
    .sv-cta-center-band {
      --_band: color-mix(in srgb, var(--sg-accent, #2563eb) 76%, rgb(from var(--sg-on-accent, #fff) calc(255 - r) calc(255 - g) calc(255 - b)));
    }
  }
  .sv-cta-center-rings { display: block; position: absolute; z-index: -1; width: 520px; height: 520px; top: -230px; right: -170px; }
  .sv-cta-center-rings circle { fill: none; stroke: var(--_ink); stroke-opacity: .14; stroke-width: 1.5; }
  .sv-cta-center-band h2 { margin: 0 0 12px; max-width: 22ch; font-size: 32px; font-weight: 700; line-height: 1.15; letter-spacing: -.02em; }
  .sv-cta-center-band > p { margin: 0; max-width: 52ch; font-size: 16px; line-height: 1.55; }
  .sv-cta-center-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 28px; }
  /* Kit buttons inverted for the band: a light pill with band-colored text, and a quiet link. */
  .sv-cta-center-actions :global(.sv-btn--primary) { background: var(--_ink); color: var(--_band); }
  .sv-cta-center-actions :global(.sv-btn--primary:hover:not([aria-disabled='true'])) { background: color-mix(in srgb, var(--_ink) 88%, var(--_band)); }
  .sv-cta-center-actions :global(.sv-btn--ghost) { color: var(--_ink); }
  .sv-cta-center-actions :global(.sv-btn--ghost:hover:not([aria-disabled='true'])) { background: color-mix(in srgb, var(--_ink) 14%, transparent); }
  .sv-cta-center-actions :global(.sv-btn:focus-visible) { outline-color: var(--_ink); }
  .sv-cta-center-band > .sv-cta-center-status { min-height: 1.5em; max-width: 52ch; margin: 20px 0 0; font-size: 14px; font-weight: 500; line-height: 1.5; }

  @media (max-width: 560px) {
    .sv-cta-center { padding: 24px 16px; }
    .sv-cta-center-band { padding: 44px 20px 28px; }
    .sv-cta-center-band h2 { font-size: 26px; }
    .sv-cta-center-band > p { font-size: 15px; }
    .sv-cta-center-actions { flex-direction: column; align-self: stretch; }
  }
</style>
