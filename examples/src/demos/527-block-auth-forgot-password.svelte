<script lang="ts" module>
  /**
   * Forgot password block - password recovery in two states. Request: one
   * email SvTextInput with format validation and a submit SvButton that shows
   * its loading state. Sent: a "check your email" confirmation naming the
   * address, a resend SvButton with a 60 s cooldown and a way back to sign-in.
   * Built on SvCard. Pure UI-kit, --sg-* themed.
   *
   * Headless: createForgotPassword() below owns the email, its validation,
   * the request and resend flow and the cooldown with no markup. The
   * component under it is one styled render of that core; import
   * createForgotPassword from this file (or `npx @svgrid/ui add
   * auth-forgot-password --headless` for the core alone) to draw your own.
   */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

  type Action = 'request' | 'resend'

  export type ForgotPasswordAction = Action
  export type ForgotPasswordOptions = {
    /** POST the address to your reset endpoint; throw when it fails. */
    onRequest?: (email: string) => Promise<void> | void
    /** The resend button's request. Defaults to onRequest. */
    onResend?: (email: string) => Promise<void> | void
    /** A request or resend threw. */
    onError?: (error: unknown, action: ForgotPasswordAction) => void
    /** Seconds before the email can be sent again. */
    cooldown?: number
  }

  /**
   * Call during component init: the resend cooldown ticks in an $effect that
   * is cleared when the component unmounts.
   */
  export function createForgotPassword(opts: ForgotPasswordOptions = {}) {
    const COOLDOWN = opts.cooldown ?? 60
    let email = $state('')
    let error = $state('')
    let busy = $state(false)
    let sentTo = $state('')
    let cooldown = $state(0)

    $effect(() => {
      if (cooldown <= 0) return
      const t = setTimeout(() => (cooldown -= 1), 1000)
      return () => clearTimeout(t)
    })

    async function send(action: ForgotPasswordAction, addr: string) {
      busy = true
      try {
        await (action === 'resend' && opts.onResend ? opts.onResend(addr) : opts.onRequest?.(addr))
        sentTo = addr
        cooldown = COOLDOWN
      } catch (e) {
        opts.onError?.(e, action)
      } finally {
        busy = false
      }
    }

    async function submit(ev?: Event) {
      ev?.preventDefault()
      const addr = email.trim()
      error = !addr ? 'Enter the email on your account.' : EMAIL_RE.test(addr) ? '' : 'Enter a valid email, like name@company.com.'
      if (error || busy) return
      await send('request', addr)
    }

    function resend() {
      if (cooldown > 0 || busy || !sentTo) return
      return send('resend', sentTo)
    }

    /** Back to the request form (another email, or leaving for sign-in). */
    function reset() {
      sentTo = ''
      cooldown = 0
    }

    return {
      get email() { return email },
      set email(v: string) { email = v; error = '' },
      /** The inline message for the email field, '' when valid. */
      get error() { return error },
      get busy() { return busy },
      /** The address the link went to; empty while the form is showing. */
      get sentTo() { return sentTo },
      get cooldown() { return cooldown },
      submit,
      resend,
      reset,
      /** Spread on your <form>. */
      formProps: () => ({ novalidate: true, onsubmit: submit }),
      /** Spread on a plain email <input>. */
      fieldProps: () => ({
        name: 'email',
        type: 'email' as const,
        value: email,
        oninput: (e: Event) => { email = (e.currentTarget as HTMLInputElement).value; error = '' },
        'aria-invalid': error ? ('true' as const) : undefined,
      }),
      /** Spread on the resend <button>. */
      resendProps: () => ({ type: 'button' as const, disabled: cooldown > 0 || busy, onclick: resend }),
    }
  }
</script>

<script lang="ts">
  import { SvCard, SvTextInput, SvButton, SvToaster, toast } from '@svgrid/grid'

  // Stand-in for your API: POST the address to your reset endpoint here.
  const requestReset = (_addr: string) => new Promise<void>((res) => setTimeout(res, 1000))

  const forgot = createForgotPassword({
    onRequest: requestReset,
    onResend: (addr) =>
      toast.promise(requestReset(addr), {
        loading: 'Sending a new link...',
        success: `New reset link sent to ${addr}`,
        error: 'Could not resend. Try again.',
      }),
    onError: (_e, action) => {
      if (action === 'request') toast.error('Could not send the reset email. Try again.')
    },
  })
</script>

<main class="sv-forgot">
  <div class="sv-forgot-card">
    <SvCard>
      <div class="sv-forgot-badge" class:sv-forgot-is-sent={!!forgot.sentTo} aria-hidden="true">
        {#if forgot.sentTo}
          <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M4 7l8 6 8-6" /></svg>
        {:else}
          <svg viewBox="0 0 24 24"><circle cx="8" cy="15" r="4" /><path d="M11 12l8-8M16 7l2.5 2.5M14 9l2 2" /></svg>
        {/if}
      </div>

      {#if !forgot.sentTo}
        <h1>Forgot your password?</h1>
        <p class="sv-forgot-muted">Enter the email on your Fieldline account and we will send you a link to set a new one.</p>
        <form class="sv-forgot-fields" {...forgot.formProps()}>
          <SvTextInput label="Email" type="email" name="email" autocomplete="email" placeholder="name@company.com"
            bind:value={forgot.email} block required error={forgot.error} invalid={!!forgot.error} />
          <SvButton type="submit" variant="primary" block loading={forgot.busy}>Send reset link</SvButton>
        </form>
      {:else}
        <div aria-live="polite">
          <h1>Check your email</h1>
          <p class="sv-forgot-muted">If an account exists for <strong class="sv-forgot-addr">{forgot.sentTo}</strong>, a reset link is on its way. It expires in 30 minutes.</p>
          <div class="sv-forgot-sent-actions">
            <SvButton variant="secondary" block loading={forgot.busy} disabled={forgot.cooldown > 0} onclick={forgot.resend}>
              {forgot.cooldown > 0 ? `Resend in ${forgot.cooldown}s` : 'Resend email'}
            </SvButton>
            <p class="sv-forgot-muted sv-forgot-small">Nothing yet? Check your spam folder, or
              <button type="button" class="sv-forgot-link" onclick={forgot.reset}>try another email</button>.
            </p>
          </div>
        </div>
      {/if}

      {#snippet footer()}
        <button type="button" class="sv-forgot-link sv-forgot-back" onclick={() => { toast('Opening sign-in'); forgot.reset() }}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" /></svg>
          Back to sign-in
        </button>
      {/snippet}
    </SvCard>
  </div>
</main>

<SvToaster position="bottom-right" />

<style>
  .sv-forgot {
    display: flex; align-items: center; justify-content: center;
    width: 100%; min-height: 520px; padding: 40px 24px; box-sizing: border-box;
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 3%, var(--sg-bg, #fff));
    color: var(--sg-fg, #0f172a);
    font-family: var(--sg-font, inherit);
  }
  .sv-forgot-card { width: 100%; max-width: 400px; }
  .sv-forgot-badge {
    display: grid; place-items: center; width: 44px; height: 44px; margin: 4px 0 16px;
    border-radius: var(--sg-radius, 10px);
    border: 1px solid var(--sg-border, #e2e8f0); box-sizing: border-box;
    background: var(--sg-header-bg, #f8fafc); color: var(--sg-fg, #0f172a);
  }
  .sv-forgot-badge.sv-forgot-is-sent {
    border-color: transparent;
    background: color-mix(in srgb, var(--sg-success, #16a34a) 14%, transparent);
    color: var(--sg-success, #16a34a);
  }
  .sv-forgot-badge svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  h1 { margin: 0 0 6px; font-size: 21px; font-weight: 650; letter-spacing: -.01em; }
  .sv-forgot-muted { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  .sv-forgot-small { font-size: 12.5px; }
  .sv-forgot-addr { color: var(--sg-fg, #0f172a); font-weight: 600; overflow-wrap: anywhere; }
  .sv-forgot-fields { display: flex; flex-direction: column; gap: 14px; margin-top: 20px; }
  .sv-forgot-sent-actions { display: flex; flex-direction: column; gap: 12px; margin-top: 20px; }
  .sv-forgot-link {
    background: none; border: 0; padding: 0; font: inherit; cursor: pointer;
    color: var(--sg-accent, #4f46e5);
  }
  .sv-forgot-link:hover { text-decoration: underline; }
  .sv-forgot-link:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #4f46e5)); outline-offset: 2px; border-radius: 3px; }
  .sv-forgot-back { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-forgot-back:hover { color: var(--sg-fg, #0f172a); }
  .sv-forgot-back svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }

  @media (max-width: 480px) {
    .sv-forgot { padding: 24px 16px; align-items: flex-start; }
  }
</style>
