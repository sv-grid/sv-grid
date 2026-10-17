<script lang="ts" module>
  /**
   * Cookie consent block - a consent bar at the bottom of a site with Accept
   * all, Reject non-essential and Customize. Customize opens an SvModal with
   * one SvSwitchButton per cookie category (Necessary is on and disabled) and
   * a Save SvButton. The saved choice replaces the bar with a one-line summary
   * and a Change settings link, and every decision is confirmed through an
   * SvToaster toast. Pure UI-kit, --sg-* themed.
   *
   * Headless: createCookieConsent() below owns the saved choice, the draft the
   * switches edit, the settings dialog's open state and the accept / reject /
   * save actions with no markup. The component under it is one styled render
   * of that core; import createCookieConsent from this file (or
   * `npx @svgrid/ui add banners-cookie-consent --headless` for the core alone)
   * to draw your own.
   */
  export type CookieCategory = 'necessary' | 'preferences' | 'analytics' | 'marketing'
  export type Consent = Record<CookieCategory, boolean>
  export type ConsentDecision = 'accept-all' | 'reject' | 'custom'
  export type CookieCategoryInfo = { id: CookieCategory; name: string; about: string }
  export type CookieConsentOptions = {
    categories?: CookieCategoryInfo[]
    /** A choice made on an earlier visit (from your consent cookie); null shows the bar. */
    saved?: Consent | null
    /** Persist the choice (cookie, form action, API). */
    onDecide?: (consent: Consent, how: ConsentDecision) => void
  }

  const SAMPLE_CATEGORIES: CookieCategoryInfo[] = [
    { id: 'necessary', name: 'Necessary', about: 'Sign-in, security and load balancing. The site does not work without them.' },
    { id: 'preferences', name: 'Preferences', about: 'Remember your language, region and table layout.' },
    { id: 'analytics', name: 'Analytics', about: 'Count visits and page speed so we can find slow pages. No ads.' },
    { id: 'marketing', name: 'Marketing', about: 'Measure which campaigns bring people to Fieldline.' },
  ]
  const NECESSARY_ONLY: Consent = { necessary: true, preferences: false, analytics: false, marketing: false }
  const EVERYTHING: Consent = { necessary: true, preferences: true, analytics: true, marketing: true }

  export function createCookieConsent(opts: CookieConsentOptions = {}) {
    const categories = opts.categories ?? SAMPLE_CATEGORIES
    let saved = $state<Consent | null>(opts.saved ? { ...opts.saved } : null)
    let draft = $state<Consent>({ ...NECESSARY_ONLY })
    let settingsOpen = $state(false)

    const summary = $derived(saved ? categories.filter((c) => saved?.[c.id]).map((c) => c.name).join(', ') : '')

    function decide(choice: Consent, how: ConsentDecision) {
      // Necessary cookies need no consent, so they are on in every choice.
      saved = { ...choice, necessary: true }
      settingsOpen = false
      opts.onDecide?.({ ...saved }, how)
    }

    return {
      categories,
      get saved() { return saved },
      get draft() { return draft },
      /** Comma list of the allowed category names. */
      get summary() { return summary },
      get settingsOpen() { return settingsOpen },
      set settingsOpen(v: boolean) { settingsOpen = v },
      acceptAll: () => decide(EVERYTHING, 'accept-all'),
      rejectAll: () => decide(NECESSARY_ONLY, 'reject'),
      /** Open the settings, starting from the saved choice (or necessary only). */
      customize: () => { draft = saved ? { ...saved } : { ...NECESSARY_ONLY }; settingsOpen = true },
      setDraft: (id: CookieCategory, v: boolean) => { if (id !== 'necessary') draft[id] = v },
      save: () => decide(draft, 'custom'),
      cancel: () => { settingsOpen = false },
      /** Forget the choice and show the bar again. */
      reset: () => { saved = null },
      /** Spread on a plain <input type="checkbox" role="switch"> per category. */
      switchProps: (id: CookieCategory) => ({
        type: 'checkbox' as const, role: 'switch' as const, name: id, checked: draft[id], disabled: id === 'necessary',
        onchange: (e: Event) => { if (id !== 'necessary') draft[id] = (e.currentTarget as HTMLInputElement).checked },
      }),
    }
  }
</script>

<script lang="ts">
  import { SvButton, SvModal, SvSwitchButton, SvToaster, toast } from '@svgrid/grid'

  const MESSAGES: Record<ConsentDecision, string> = {
    'accept-all': 'All cookies allowed',
    reject: 'Only necessary cookies are on',
    custom: 'Cookie settings saved',
  }

  const consent = createCookieConsent({
    // Write a consent cookie here (see the docs for a SvelteKit form action).
    onDecide: (_c, how) => toast.success(MESSAGES[how]),
  })
</script>

<div class="sv-bn-consent">
  <div class="sv-bn-consent-site">
    <header class="sv-bn-consent-top">
      <span class="sv-bn-consent-logo"><span class="sv-bn-consent-mark" aria-hidden="true"></span>Fieldline</span>
      <span class="sv-bn-consent-links" aria-hidden="true"><i></i><i></i><i></i></span>
    </header>

    <main class="sv-bn-consent-hero">
      <h2>Schedule crews without the spreadsheet</h2>
      <div class="sv-bn-consent-lines" aria-hidden="true"><i style:--w="88%"></i><i style:--w="72%"></i><i style:--w="48%"></i></div>
      <div class="sv-bn-consent-art" aria-hidden="true"><i></i><i></i><i></i></div>
    </main>

    {#if consent.saved}
      <div class="sv-bn-consent-summary" role="status">
        <span>Cookies allowed: <strong>{consent.summary}</strong></span>
        <button type="button" class="sv-bn-consent-link" onclick={consent.customize}>Change settings</button>
        <button type="button" class="sv-bn-consent-link sv-bn-consent-quiet" onclick={consent.reset}>Show banner again</button>
      </div>
    {:else}
      <section class="sv-bn-consent-bar" aria-labelledby="sv-bn-consent-title">
        <div class="sv-bn-consent-text">
          <h3 id="sv-bn-consent-title">We use cookies</h3>
          <p>Necessary cookies keep Fieldline running. With your OK we also use them to remember settings and measure traffic. Read the <a href="/legal/cookies">cookie policy</a>.</p>
        </div>
        <div class="sv-bn-consent-actions">
          <SvButton variant="ghost" onclick={consent.customize}>Customize</SvButton>
          <SvButton variant="outline" onclick={consent.rejectAll}>Reject non-essential</SvButton>
          <SvButton variant="primary" onclick={consent.acceptAll}>Accept all</SvButton>
        </div>
      </section>
    {/if}
  </div>
</div>

<SvModal bind:open={consent.settingsOpen} title="Cookie settings" width={480}>
  <p class="sv-bn-consent-intro">Choose which cookies Fieldline may set. You can change this any time from the footer.</p>
  <ul class="sv-bn-consent-cats">
    {#each consent.categories as c (c.id)}
      <li>
        <div>
          <strong>{c.name}</strong>
          <p>{c.about}</p>
        </div>
        <SvSwitchButton
          ariaLabel="{c.name} cookies"
          checked={consent.draft[c.id]}
          disabled={c.id === 'necessary'}
          onChange={(v) => consent.setDraft(c.id, v)}
        />
      </li>
    {/each}
  </ul>
  {#snippet footer()}
    <SvButton variant="ghost" onclick={consent.cancel}>Cancel</SvButton>
    <SvButton variant="primary" onclick={consent.save}>Save settings</SvButton>
  {/snippet}
</SvModal>

<SvToaster position="bottom-right" />

<style>
  .sv-bn-consent {
    width: 100%; box-sizing: border-box; padding: 32px 24px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-bn-consent-site {
    position: relative; display: flex; flex-direction: column; max-width: 960px; min-height: 520px; margin: 0 auto; overflow: hidden;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
  }
  .sv-bn-consent-top { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-bn-consent-logo { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; }
  .sv-bn-consent-mark { width: 18px; height: 18px; border-radius: 50%; background: var(--sg-fg, #0f172a); }
  .sv-bn-consent-links { display: flex; gap: 14px; }
  .sv-bn-consent-links i, .sv-bn-consent-lines i { display: block; height: 8px; border-radius: 4px; background: color-mix(in srgb, var(--sg-fg, #0f172a) 10%, var(--sg-bg, #fff)); }
  .sv-bn-consent-links i { width: 48px; }
  .sv-bn-consent-hero { flex: 1; padding: 40px 32px 32px; display: flex; flex-direction: column; gap: 18px; }
  h2 { margin: 0; max-width: 24ch; font-size: 28px; line-height: 1.15; font-weight: 700; letter-spacing: -.02em; }
  .sv-bn-consent-lines { display: flex; flex-direction: column; gap: 10px; max-width: 420px; }
  .sv-bn-consent-lines i { width: var(--w); }
  .sv-bn-consent-art { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .sv-bn-consent-art i { display: block; height: 90px; border-radius: var(--sg-radius, 8px); background: color-mix(in srgb, var(--sg-fg, #0f172a) 6%, var(--sg-bg, #fff)); }

  .sv-bn-consent-bar {
    display: flex; align-items: center; gap: 24px; padding: 18px 20px;
    border-top: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff); box-shadow: 0 -10px 24px -16px rgba(0, 0, 0, .35);
  }
  .sv-bn-consent-text { flex: 1; min-width: 0; }
  h3 { margin: 0 0 4px; font-size: 15px; font-weight: 650; }
  .sv-bn-consent-text p { margin: 0; font-size: 13px; line-height: 1.5; color: var(--sg-muted, #64748b); }
  .sv-bn-consent-text a { color: var(--sg-fg, #0f172a); text-decoration: underline; text-underline-offset: 2px; }
  .sv-bn-consent-actions { flex: none; display: flex; gap: 8px; }
  .sv-bn-consent-summary {
    display: flex; align-items: center; flex-wrap: wrap; gap: 6px 16px; padding: 12px 20px; font-size: 13px;
    border-top: 1px solid var(--sg-border, #e2e8f0); color: var(--sg-muted, #64748b);
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 4%, var(--sg-bg, #fff));
  }
  .sv-bn-consent-summary strong { color: var(--sg-fg, #0f172a); font-weight: 600; }
  .sv-bn-consent-link { padding: 0; border: 0; background: none; font: inherit; color: var(--sg-accent, #2563eb); cursor: pointer; }
  .sv-bn-consent-link.sv-bn-consent-quiet { color: var(--sg-muted, #64748b); margin-left: auto; }
  .sv-bn-consent-link:hover { text-decoration: underline; }

  .sv-bn-consent-intro { margin: 0 0 12px; font-size: 13px; line-height: 1.5; color: var(--sg-muted, #64748b); }
  .sv-bn-consent-cats { list-style: none; margin: 0; padding: 0; }
  .sv-bn-consent-cats li { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 0; border-top: 1px solid var(--sg-border, #e2e8f0); }
  .sv-bn-consent-cats strong { font-size: 14px; }
  .sv-bn-consent-cats p { margin: 2px 0 0; font-size: 12.5px; line-height: 1.45; color: var(--sg-muted, #64748b); }

  @media (max-width: 720px) {
    .sv-bn-consent { padding: 16px 12px; }
    .sv-bn-consent-links { display: none; }
    .sv-bn-consent-hero { padding: 24px 16px; }
    h2 { font-size: 22px; }
    .sv-bn-consent-art i { height: 60px; }
    .sv-bn-consent-bar { flex-direction: column; align-items: stretch; gap: 14px; padding: 16px; }
    .sv-bn-consent-actions { flex-direction: column-reverse; }
    .sv-bn-consent-actions :global(.sv-btn) { width: 100%; }
    .sv-bn-consent-summary { padding: 12px 16px; }
    .sv-bn-consent-link.sv-bn-consent-quiet { margin-left: 0; }
  }
</style>
