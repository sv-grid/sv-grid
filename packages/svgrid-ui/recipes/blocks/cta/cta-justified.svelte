<script lang="ts" module>
  /**
   * Justified call to action block - one bordered row with the heading and a
   * line of copy on the left and two SvButtons on the right, stacking on
   * phones. The primary action shows its loading state, reports through an
   * SvToaster toast and swaps the buttons for a confirmation once it
   * resolves. Pure UI-kit, --sg-* themed.
   *
   * Headless: createCtaJustified() below owns the copy, the two actions,
   * click tracking and the pending/done state with no markup. The component
   * under it is one styled render of that core; import createCtaJustified
   * from this file (or `npx @svgrid/ui add cta-justified --headless` for the
   * core alone) to draw your own.
   */
  export type CtaAction = { id: string; label: string; href?: string }
  export type CtaJustifiedOptions = {
    heading?: string
    body?: string
    primary?: CtaAction
    secondary?: CtaAction
    /** Replaces the buttons once the primary action resolves. */
    doneText?: string
    /** Fires on every press, before anything else. Send it to your analytics. */
    onTrack?: (action: CtaAction) => void
    /** Runs a press. Leave it out and the action's href navigates as a normal link. Throw to stay idle. */
    onAction?: (action: CtaAction) => Promise<void> | void
    onError?: (error: unknown) => void
  }

  export function createCtaJustified(opts: CtaJustifiedOptions = {}) {
    // Defaults are the demo copy; pass your own through opts.
    const primary = opts.primary ?? { id: 'start', label: 'Get started', href: '/signup' }
    const secondary = opts.secondary ?? { id: 'demo', label: 'Book a demo', href: '/demo' }
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
      heading: opts.heading ?? 'Plan next season\'s routes in Fieldline',
      body: opts.body ?? 'Free for crews of up to five. Bring your job list as a CSV and see the week laid out on a map.',
      doneText: opts.doneText ?? 'Account created. Check your inbox to confirm it.',
      primary,
      secondary,
      get pending() { return pending },
      /** True once the primary action has resolved. */
      get finished() { return done === primary.id },
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

  const cta = createCtaJustified({
    // Replace with your request (or drop onAction to let the href navigate).
    onAction: (a) =>
      a.id === 'start'
        ? toast.promise(new Promise<void>((res) => setTimeout(res, 1100)), {
            loading: 'Creating your account...',
            success: 'Welcome to Fieldline',
            error: 'Could not create the account. Try again.',
          }).then(() => {})
        : void toast('Opening the demo calendar'),
  })
</script>

<section class="sv-cta-just" aria-labelledby="sv-cta-just-title">
  <div class="sv-cta-just-row">
    <div class="sv-cta-just-copy">
      <h2 id="sv-cta-just-title">{cta.heading}</h2>
      <p>{cta.body}</p>
    </div>
    <div class="sv-cta-just-side" role="status">
      {#if cta.finished}
        <p class="sv-cta-just-done">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10.5l3.4 3.4L15 7" /></svg>
          {cta.doneText}
        </p>
      {:else}
        <div class="sv-cta-just-actions">
          <SvButton variant="secondary" size="lg" href={cta.secondary.href} loading={cta.pending === cta.secondary.id}
            disabled={!!cta.pending && cta.pending !== cta.secondary.id} onclick={(e) => cta.run(cta.secondary, e)}>{cta.secondary.label}</SvButton>
          <SvButton variant="primary" size="lg" href={cta.primary.href} loading={cta.pending === cta.primary.id}
            disabled={!!cta.pending && cta.pending !== cta.primary.id} onclick={(e) => cta.run(cta.primary, e)}>{cta.primary.label}</SvButton>
        </div>
      {/if}
    </div>
  </div>
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-cta-just {
    width: 100%; box-sizing: border-box; padding: 56px 24px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-cta-just-row {
    display: flex; align-items: center; justify-content: space-between; gap: 32px;
    max-width: 1040px; margin: 0 auto; padding: 36px 40px; box-sizing: border-box;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 14px);
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 4%, var(--sg-bg, #fff));
  }
  .sv-cta-just-copy { min-width: 0; }
  .sv-cta-just-copy h2 { margin: 0 0 8px; font-size: 24px; font-weight: 700; line-height: 1.25; letter-spacing: -.015em; }
  .sv-cta-just-copy p { margin: 0; max-width: 54ch; font-size: 15px; line-height: 1.55; color: var(--sg-muted, #64748b); }
  .sv-cta-just-side { flex: none; }
  .sv-cta-just-actions { display: flex; gap: 10px; }
  .sv-cta-just-done { display: flex; align-items: center; gap: 8px; max-width: 30ch; margin: 0; font-size: 14.5px; font-weight: 500; }
  .sv-cta-just-done svg { display: block; flex: none; width: 22px; height: 22px; padding: 3px; box-sizing: border-box; border-radius: 50%; background: color-mix(in srgb, var(--sg-success, #16a34a) 16%, transparent); }
  .sv-cta-just-done path { fill: none; stroke: var(--sg-success, #16a34a); stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }

  @media (max-width: 760px) {
    .sv-cta-just { padding: 24px 16px; }
    .sv-cta-just-row { flex-direction: column; align-items: stretch; gap: 22px; padding: 28px 20px; }
    .sv-cta-just-copy h2 { font-size: 22px; }
    .sv-cta-just-actions { flex-direction: column-reverse; }
    .sv-cta-just-done { max-width: none; }
  }
</style>
