<script lang="ts" module>
  /**
   * Sign-in with providers block - an SSO-first sign-in card. Stacked outline
   * SvButtons for Google, GitHub and Microsoft, plus "Single sign-on (SAML)"
   * that reveals a company-domain SvTextInput. Below an "or" SvDivider sits a
   * passwordless magic-link form; sending it switches the card to a "Check your
   * inbox" state with the address, a resend cooldown and a way back to change
   * the email. Pure UI-kit, --sg-* themed.
   *
   * Headless: createProviderSignIn() below owns the pending provider, the SSO
   * domain and magic-link forms, their validation and the resend cooldown
   * with no markup. The component under it is one styled render of that core;
   * import createProviderSignIn from this file (or `npx @svgrid/ui add
   * auth-providers --headless` for the core alone) to draw your own.
   */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  const DOMAIN_RE = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i

  export type AuthProvider = { id: string; name: string; mark: string }
  export type ProviderSignInErrors = { domain?: string; email?: string }
  export type ProviderSignInOptions = {
    providers?: AuthProvider[]
    /** Start the OAuth flow for a provider (redirect here); throw to stay on the card. */
    onProvider?: (provider: AuthProvider) => Promise<void> | void
    /** Find the SAML connection for a company domain and redirect to it. */
    onSso?: (domain: string) => Promise<void> | void
    /** Email a sign-in link. Throw to keep the form; resolve to show "Check your inbox". */
    onSendLink?: (email: string) => Promise<void> | void
    /** Send the link again from the "Check your inbox" state. */
    onResend?: (email: string) => Promise<void> | void
    /** A flow threw; `flow` is the provider id, 'sso' or 'link'. */
    onError?: (error: unknown, flow: string) => void
    /** Seconds before the link can be sent again. */
    cooldown?: number
  }

  const PROVIDERS: AuthProvider[] = [
    { id: 'google', name: 'Google', mark: 'G' },
    { id: 'github', name: 'GitHub', mark: 'GH' },
    { id: 'microsoft', name: 'Microsoft', mark: 'M' },
  ]

  /**
   * Call during component init: the resend cooldown ticks in an $effect that
   * is cleared when the component unmounts.
   */
  export function createProviderSignIn(opts: ProviderSignInOptions = {}) {
    // One flow runs at a time; `pending` names it so the others can disable.
    const providers = opts.providers ?? PROVIDERS
    const COOLDOWN = opts.cooldown ?? 30
    /** A provider id, 'sso', 'link', or null when nothing is running. */
    let pending = $state<string | null>(null)
    let ssoOpen = $state(false)
    let domain = $state('')
    let email = $state('')
    let errors = $state<ProviderSignInErrors>({})
    let sentTo = $state('')
    let cooldown = $state(0)

    $effect(() => {
      if (cooldown <= 0) return
      const t = setTimeout(() => (cooldown -= 1), 1000)
      return () => clearTimeout(t)
    })

    /** Run one flow with `pending` set; a throw leaves the card as it was.
     *  Resolves true when the flow finished without throwing. */
    async function run(key: string, task: () => Promise<void> | void): Promise<boolean> {
      if (pending) return false
      pending = key
      try {
        await task()
        return true
      } catch (e) {
        opts.onError?.(e, key)
        return false
      } finally {
        pending = null
      }
    }

    const withProvider = (p: AuthProvider) => run(p.id, () => opts.onProvider?.(p))

    async function submitSso(ev?: Event) {
      ev?.preventDefault()
      const d = domain.trim().toLowerCase()
      errors.domain = !d ? 'Enter your company domain.' : DOMAIN_RE.test(d) ? undefined : 'Use a domain like acme.com.'
      if (errors.domain) return
      await run('sso', () => opts.onSso?.(d))
    }

    async function sendLink(ev?: Event) {
      ev?.preventDefault()
      const addr = email.trim()
      errors.email = !addr ? 'Enter your work email.' : EMAIL_RE.test(addr) ? undefined : 'Enter a valid email, like name@company.com.'
      if (errors.email) return
      if (await run('link', () => opts.onSendLink?.(addr))) {
        sentTo = addr
        cooldown = COOLDOWN
      }
    }

    function resend() {
      if (cooldown > 0 || !sentTo) return
      cooldown = COOLDOWN
      opts.onResend?.(sentTo)
    }

    /** Back from "Check your inbox" to the form, with the email kept. */
    function changeEmail() {
      sentTo = ''
      cooldown = 0
      ssoOpen = false
    }

    /** True when another flow is running, so this control should be disabled. */
    const blocked = (key: string) => !!pending && pending !== key

    return {
      providers,
      get pending() { return pending },
      get ssoOpen() { return ssoOpen },
      set ssoOpen(v: boolean) { ssoOpen = v },
      get domain() { return domain },
      set domain(v: string) { domain = v; errors.domain = undefined },
      get email() { return email },
      set email(v: string) { email = v; errors.email = undefined },
      get errors() { return errors },
      /** The address the link went to; empty while the form is showing. */
      get sentTo() { return sentTo },
      get cooldown() { return cooldown },
      blocked,
      withProvider,
      toggleSso: () => { ssoOpen = !ssoOpen },
      submitSso,
      sendLink,
      resend,
      changeEmail,
      /** Spread on a plain <button> for one provider. */
      providerProps: (p: AuthProvider) => ({
        type: 'button' as const,
        disabled: blocked(p.id),
        'aria-busy': pending === p.id,
        onclick: () => withProvider(p),
      }),
      /** Spread on the button that shows or hides the SSO domain form. */
      ssoToggleProps: () => ({
        type: 'button' as const,
        disabled: blocked('sso'),
        'aria-expanded': ssoOpen,
        onclick: () => { ssoOpen = !ssoOpen },
      }),
      /** Spread on the SSO <form> and the magic-link <form>. */
      ssoFormProps: () => ({ novalidate: true, onsubmit: submitSso }),
      linkFormProps: () => ({ novalidate: true, onsubmit: sendLink }),
    }
  }
</script>

<script lang="ts">
  import {
    SvCard, SvTextInput, SvButton, SvDivider, SvToaster, toast,
  } from '@svgrid/grid'

  const wait = (ms: number) => new Promise<void>((res) => setTimeout(res, ms))

  // Each stand-in below waits on a timer; swap in your OAuth redirect, SSO
  // lookup and magic-link request. A throw leaves the card as it was.
  const auth = createProviderSignIn({
    onProvider: (p) =>
      toast.promise(wait(1000), {
        loading: `Redirecting to ${p.name}...`,
        success: `Signed in with ${p.name}`,
        error: `${p.name} sign-in was cancelled`,
      }),
    onSso: (d) =>
      toast.promise(wait(1100), {
        loading: `Looking up single sign-on for ${d}...`,
        success: `Redirecting to the ${d} identity provider`,
        error: `No SSO connection found for ${d}`,
      }),
    onSendLink: async (addr) => {
      await wait(900)
      toast.success(`Sign-in link sent to ${addr}`)
    },
    onResend: (addr) => { toast(`A new link is on its way to ${addr}`) },
  })
</script>

<main class="sv-providers">
  <div class="sv-providers-card">
    <SvCard>
      {#if !auth.sentTo}
        <div class="sv-providers-head">
          <h1>Sign in to Lumen</h1>
          <p class="sv-providers-muted">Use your work account. No password needed.</p>
        </div>

        <div class="sv-providers-stack">
          {#each auth.providers as p (p.id)}
            <SvButton variant="secondary" block loading={auth.pending === p.id} disabled={auth.blocked(p.id)}
              onclick={() => auth.withProvider(p)}>
              <span class="sv-providers-prov"><span class="sv-providers-glyph" aria-hidden="true">{p.mark}</span>Continue with {p.name}</span>
            </SvButton>
          {/each}
          <SvButton variant="secondary" block disabled={auth.blocked('sso')} onclick={auth.toggleSso}>
            <span class="sv-providers-prov">
              <svg class="sv-providers-glyph" viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="9" width="12" height="8" rx="2" /><path d="M7 9V6.5a3 3 0 0 1 6 0V9" /></svg>
              Single sign-on (SAML)
            </span>
          </SvButton>

          {#if auth.ssoOpen}
            <form class="sv-providers-sso" {...auth.ssoFormProps()}>
              <SvTextInput label="Company domain" name="domain" placeholder="acme.com" bind:value={auth.domain} block
                autofocus error={auth.errors.domain} invalid={!!auth.errors.domain} />
              <SvButton type="submit" variant="primary" block loading={auth.pending === 'sso'}>Continue with SSO</SvButton>
            </form>
          {/if}
        </div>

        <SvDivider label="or" />

        <form class="sv-providers-fields" {...auth.linkFormProps()}>
          <SvTextInput label="Work email" type="email" name="email" autocomplete="email" placeholder="name@company.com"
            bind:value={auth.email} block required error={auth.errors.email} invalid={!!auth.errors.email} />
          <SvButton type="submit" variant="primary" block loading={auth.pending === 'link'} disabled={auth.blocked('link')}>
            Email me a sign-in link
          </SvButton>
        </form>
      {:else}
        <div class="sv-providers-sent" aria-live="polite">
          <svg class="sv-providers-env" viewBox="0 0 48 48" aria-hidden="true">
            <rect x="6" y="12" width="36" height="26" rx="4" />
            <path d="M8 15l16 12 16-12" />
          </svg>
          <h1>Check your inbox</h1>
          <p class="sv-providers-muted">We sent a sign-in link to</p>
          <p class="sv-providers-addr">{auth.sentTo}</p>
          <p class="sv-providers-muted sv-providers-small">The link works once and expires in 15 minutes. Open it on this device.</p>
          <div class="sv-providers-resend">
            <SvButton variant="secondary" block disabled={auth.cooldown > 0} onclick={auth.resend}>
              {auth.cooldown > 0 ? `Resend link in ${auth.cooldown}s` : 'Resend link'}
            </SvButton>
          </div>
          <button type="button" class="sv-providers-link" onclick={auth.changeEmail}>Use a different email</button>
        </div>
      {/if}

      {#snippet footer()}
        <p class="sv-providers-foot">New to Lumen? <button type="button" class="sv-providers-link" onclick={() => toast('Opening sign-up')}>Create a workspace</button></p>
      {/snippet}
    </SvCard>
  </div>
</main>

<SvToaster position="bottom-right" />

<style>
  .sv-providers {
    display: flex; align-items: center; justify-content: center;
    width: 100%; min-height: 600px; padding: 40px 24px; box-sizing: border-box;
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 3%, var(--sg-bg, #fff));
    color: var(--sg-fg, #0f172a);
    font-family: var(--sg-font, inherit);
  }
  .sv-providers-card { width: 100%; max-width: 400px; }
  .sv-providers-head { text-align: center; margin: 6px 0 20px; }
  .sv-providers-head h1, .sv-providers-sent h1 { margin: 0 0 4px; font-size: 21px; font-weight: 650; letter-spacing: -.01em; }
  .sv-providers-muted { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; }
  .sv-providers-small { font-size: 12.5px; }
  .sv-providers-stack { display: flex; flex-direction: column; gap: 8px; }
  .sv-providers-prov { display: inline-flex; align-items: center; gap: 10px; }
  .sv-providers-glyph {
    display: inline-grid; place-items: center; flex: none; min-width: 20px; height: 20px; padding: 0 3px; border-radius: 5px;
    font-size: 9.5px; font-weight: 800; letter-spacing: -.02em; box-sizing: border-box;
    border: 1.5px solid color-mix(in srgb, currentColor 45%, transparent); color: inherit;
  }
  svg.sv-providers-glyph { width: 20px; padding: 0; border: 0; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; }
  .sv-providers-sso {
    display: flex; flex-direction: column; gap: 10px; padding: 12px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 8px);
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 3%, var(--sg-bg, #fff));
  }
  .sv-providers-fields { display: flex; flex-direction: column; gap: 12px; }
  .sv-providers-sent { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; padding: 8px 0 4px; }
  .sv-providers-resend { width: 100%; margin-top: 12px; }
  .sv-providers-env { width: 52px; height: 52px; margin-bottom: 8px; fill: color-mix(in srgb, var(--sg-accent, #4f46e5) 12%, transparent); stroke: var(--sg-accent, #4f46e5); stroke-width: 2; stroke-linejoin: round; }
  .sv-providers-addr { margin: 0; font-weight: 600; font-size: 14.5px; overflow-wrap: anywhere; }
  .sv-providers-link {
    background: none; border: 0; padding: 0; font: inherit; font-size: 13px; cursor: pointer;
    color: var(--sg-accent, #4f46e5);
  }
  .sv-providers-sent .sv-providers-link { margin-top: 6px; }
  .sv-providers-link:hover { text-decoration: underline; }
  .sv-providers-link:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #4f46e5)); outline-offset: 2px; border-radius: 3px; }
  .sv-providers-foot { margin: 0; text-align: center; font-size: 13px; color: var(--sg-muted, #64748b); }

  @media (max-width: 480px) {
    .sv-providers { padding: 24px 16px; align-items: flex-start; }
  }
</style>
