<script lang="ts" module>
  /**
   * Hero with email sign-up block - a centered landing-page hero whose main
   * CTA is an inline form: an SvTextInput work email next to a "Start free
   * trial" SvButton, with fine print under it. Submitting validates the
   * address, shows the button's loading state, puts a server-side refusal
   * under the field, and on success swaps the form for a "check your inbox"
   * state with a way back. A small ledger card drawn in CSS sits below.
   * Pure UI-kit, --sg-* themed.
   *
   * Headless: createSignupHero() below owns the copy, the email field, the
   * validation, the submit flow and the success state with no markup. The
   * component under it is one styled render of that core; import
   * createSignupHero from this file (or `npx @svgrid/ui add hero-signup
   * --headless` for the core alone) to draw your own.
   */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

  export type SignupHeroOptions = {
    headline?: string
    subline?: string
    cta?: string
    finePrint?: string
    /** Called with a valid address; throw to keep the form (an Error's message shows under the field). */
    onStart?: (email: string) => Promise<void> | void
  }

  export function createSignupHero(opts: SignupHeroOptions = {}) {
    let email = $state('')
    let error = $state<string | undefined>()
    let busy = $state(false)
    let sentTo = $state<string | null>(null)

    function validate(): boolean {
      const e = email.trim()
      error = !e ? 'Enter your work email.' : EMAIL_RE.test(e) ? undefined : 'Enter a valid email, like name@agency.com.'
      return !error
    }

    async function submit(ev?: Event) {
      ev?.preventDefault()
      if (busy || !validate()) return
      busy = true
      const address = email.trim()
      try {
        await opts.onStart?.(address)
        sentTo = address
      } catch (e) {
        error = e instanceof Error && e.message ? e.message : 'Could not start your trial. Try again.'
      } finally {
        busy = false
      }
    }

    function reset() {
      sentTo = null
      email = ''
      error = undefined
    }

    return {
      // Defaults are the demo copy; a page passes its own (CMS, +page.ts load).
      headline: opts.headline ?? 'Month-end close for agencies, done by the 3rd',
      subline: opts.subline ?? 'Ledgerline matches bank lines to invoices and timesheets every night. Your accountant reviews the few that do not match instead of rebuilding the spreadsheet.',
      cta: opts.cta ?? 'Start free trial',
      finePrint: opts.finePrint ?? '14 days, no card needed. Export your books to CSV at any time, trial or not.',
      get email() { return email },
      set email(v: string) { email = v; error = undefined },
      get error() { return error },
      get busy() { return busy },
      get sentTo() { return sentTo },
      validate,
      submit,
      reset,
      /** Spread on your <form>. */
      formProps: () => ({ novalidate: true, onsubmit: submit }),
      /** Spread on a plain <input type="email"> when you render your own field. */
      fieldProps: () => ({
        name: 'email',
        type: 'email',
        value: email,
        oninput: (e: Event) => { email = (e.currentTarget as HTMLInputElement).value; error = undefined },
        'aria-invalid': error ? ('true' as const) : undefined,
      }),
    }
  }
</script>

<script lang="ts">
  import { SvTextInput, SvButton, SvToaster, toast } from '@svgrid/grid'

  const hero = createSignupHero({
    // Replace with a POST to your sign-up endpoint. Try taken@ledgerline.app for the refusal.
    onStart: async (address) => {
      await new Promise((res) => setTimeout(res, 1000))
      if (address.toLowerCase() === 'taken@ledgerline.app') throw new Error('That email already has a workspace. Sign in instead.')
      toast.success(`Trial started. Sign-in link sent to ${address}`)
    },
  })

  const lines = [
    { bank: 'Transfer 88213', doc: 'INV-1182', amt: '$4,800.00', ok: true },
    { bank: 'Card 4471', doc: 'Timesheet W38', amt: '$1,265.50', ok: true },
    { bank: 'Transfer 88240', doc: 'No match', amt: '$312.00', ok: false },
  ]
</script>

<section class="sv-hero-signup" aria-labelledby="sv-hero-signup-title">
  <div class="sv-hero-signup-copy">
    <h1 id="sv-hero-signup-title">{hero.headline}</h1>
    <p class="sv-hero-signup-sub">{hero.subline}</p>

    {#if hero.sentTo}
      <div class="sv-hero-signup-done" role="status">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        <p>Check <strong>{hero.sentTo}</strong>. The link in that email opens your workspace.</p>
        <button type="button" class="sv-hero-signup-link" onclick={hero.reset}>Use a different email</button>
      </div>
    {:else}
      <form class="sv-hero-signup-form" {...hero.formProps()}>
        <div class="sv-hero-signup-field">
          <SvTextInput label="Work email" type="email" name="email" autocomplete="email" placeholder="you@agency.com"
            size="lg" bind:value={hero.email} error={hero.error} invalid={!!hero.error} required block />
        </div>
        <SvButton type="submit" variant="primary" size="lg" loading={hero.busy}>{hero.cta}</SvButton>
      </form>
      <p class="sv-hero-signup-fine">{hero.finePrint}</p>
    {/if}
  </div>

  <div class="sv-hero-signup-ledger" aria-hidden="true">
    <div class="sv-hero-signup-ledger-head"><span>September close</span><span>2 of 3 matched</span></div>
    {#each lines as l (l.bank)}
      <div class="sv-hero-signup-line">
        <span>{l.bank}</span><span class:sv-hero-signup-miss={!l.ok}>{l.doc}</span><span>{l.amt}</span>
      </div>
    {/each}
  </div>
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-hero-signup {
    width: 100%; box-sizing: border-box; min-height: 560px;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 44px; padding: 64px 24px;
    background:
      radial-gradient(ellipse 60% 50% at 50% 0%, color-mix(in srgb, var(--sg-accent, #2563eb) 13%, transparent), transparent),
      var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-hero-signup-copy { display: flex; flex-direction: column; align-items: center; text-align: center; width: 100%; max-width: 700px; }
  .sv-hero-signup h1 { margin: 0; font-size: 48px; font-weight: 750; line-height: 1.08; letter-spacing: -.03em; text-wrap: balance; }
  .sv-hero-signup-sub { margin: 18px 0 0; max-width: 56ch; font-size: 17px; line-height: 1.6; color: var(--sg-muted, #64748b); }

  .sv-hero-signup-form { display: flex; align-items: flex-start; gap: 10px; width: 100%; max-width: 480px; margin-top: 30px; text-align: left; }
  .sv-hero-signup-field { flex: 1; min-width: 0; }
  /* Line the button up with the input box, below the field label. */
  .sv-hero-signup-form > :global(.sv-btn) { margin-top: 22px; }
  .sv-hero-signup-fine { margin: 12px 0 0; font-size: 13px; color: var(--sg-muted, #64748b); }

  .sv-hero-signup-done {
    display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 10px; align-items: start;
    width: 100%; max-width: 480px; box-sizing: border-box; margin-top: 30px; padding: 16px 18px; text-align: left;
    border: 1px solid color-mix(in srgb, var(--sg-success, #16a34a) 40%, var(--sg-border, #e2e8f0)); border-radius: var(--sg-radius-lg, 12px);
    background: color-mix(in srgb, var(--sg-success, #16a34a) 8%, var(--sg-bg, #fff));
  }
  .sv-hero-signup-done svg { display: block; grid-row: span 2; }
  .sv-hero-signup-done path { fill: none; stroke: var(--sg-success, #16a34a); stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
  .sv-hero-signup-done p { margin: 0; font-size: 14.5px; line-height: 1.5; }
  .sv-hero-signup-done strong { font-weight: 650; overflow-wrap: anywhere; }
  .sv-hero-signup-link { justify-self: start; padding: 0; border: 0; background: none; font: inherit; font-size: 13.5px; color: var(--sg-accent, #2563eb); cursor: pointer; }
  .sv-hero-signup-link:hover { text-decoration: underline; }
  .sv-hero-signup-link:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 2px; border-radius: 3px; }

  .sv-hero-signup-ledger {
    width: 100%; max-width: 520px; box-sizing: border-box; font-size: 12.5px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px); background: var(--sg-bg, #fff);
    box-shadow: 0 18px 40px -22px color-mix(in srgb, var(--sg-fg, #0f172a) 35%, transparent);
  }
  .sv-hero-signup-ledger-head { display: flex; justify-content: space-between; gap: 12px; padding: 10px 14px; font-weight: 600; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-hero-signup-ledger-head span:last-child { font-weight: 500; color: var(--sg-muted, #64748b); }
  .sv-hero-signup-line { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 80px; gap: 12px; padding: 9px 14px; white-space: nowrap; }
  .sv-hero-signup-line + .sv-hero-signup-line { border-top: 1px solid var(--sg-border, #e2e8f0); }
  .sv-hero-signup-line span { overflow: hidden; text-overflow: ellipsis; }
  .sv-hero-signup-line span:nth-child(2) { color: var(--sg-success, #16a34a); font-weight: 600; }
  .sv-hero-signup-line span.sv-hero-signup-miss { color: var(--sg-warning, #d97706); }
  .sv-hero-signup-line span:last-child { text-align: right; font-variant-numeric: tabular-nums; }

  @media (max-width: 600px) {
    .sv-hero-signup { min-height: 0; padding: 48px 16px; gap: 36px; }
    .sv-hero-signup h1 { font-size: 32px; }
    .sv-hero-signup-sub { font-size: 15.5px; }
    .sv-hero-signup-form { flex-direction: column; align-items: stretch; }
    .sv-hero-signup-form > :global(.sv-btn) { margin-top: 0; width: 100%; }
  }
</style>
