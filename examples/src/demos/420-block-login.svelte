<script lang="ts" module>
  /**
   * Login block - a two-column sign-in page: a branded panel on the left, the
   * sign-in SvCard on the right. SvButton provider buttons, an "or"
   * SvDivider, SvTextInput for the email, SvPasswordInput with reveal, an
   * SvCheckBox remember-me and a submit SvButton with its loading state.
   * Pure UI-kit, --sg-* themed.
   *
   * Headless: createLogin() below owns the state, validation, provider and
   * submit flow with no markup. The component under it is one styled render
   * of that core; import createLogin from this file (or `npx @svgrid/ui add
   * login --headless` for the core alone) to draw your own.
   */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

  export type LoginProvider = { id: string; name: string; mark: string }
  export type LoginValues = { email: string; password: string; remember: boolean }
  export type LoginErrors = { email?: string; password?: string }
  export type LoginOptions = {
    /** Called with valid values; throw (or reject) to keep the form open. */
    onSubmit?: (values: LoginValues) => Promise<void> | void
    /** onSubmit or onProvider threw; show your own message here. */
    onError?: (error: unknown) => void
    /** A provider button was pressed: start that provider's OAuth flow here. */
    onProvider?: (provider: LoginProvider) => Promise<void> | void
    providers?: LoginProvider[]
    initial?: Partial<LoginValues>
  }

  const PROVIDERS: LoginProvider[] = [
    { id: 'google', name: 'Google', mark: 'G' },
    { id: 'github', name: 'GitHub', mark: '⌘' },
  ]

  export function createLogin(opts: LoginOptions = {}) {
    const providers = opts.providers ?? PROVIDERS
    let email = $state(opts.initial?.email ?? '')
    let password = $state(opts.initial?.password ?? '')
    let remember = $state(opts.initial?.remember ?? false)
    let errors = $state<LoginErrors>({})
    let busy = $state(false)
    let pending = $state<string | null>(null)

    function validate(): boolean {
      const e = email.trim()
      errors = {
        email: !e ? 'Enter your email address.' : EMAIL_RE.test(e) ? undefined : 'Enter a valid email, like name@company.com.',
        password: password ? undefined : 'Enter your password.',
      }
      return !errors.email && !errors.password
    }

    async function submit(ev?: Event) {
      ev?.preventDefault()
      if (busy || !validate()) return
      busy = true
      try {
        await opts.onSubmit?.({ email: email.trim(), password, remember })
      } catch (e) {
        opts.onError?.(e)
      } finally {
        busy = false
      }
    }

    async function continueWith(p: LoginProvider) {
      if (pending) return
      pending = p.id
      try {
        await opts.onProvider?.(p)
      } catch (e) {
        opts.onError?.(e)
      } finally {
        pending = null
      }
    }

    return {
      providers,
      get email() { return email },
      set email(v: string) { email = v; errors.email = undefined },
      get password() { return password },
      set password(v: string) { password = v; errors.password = undefined },
      get remember() { return remember },
      set remember(v: boolean) { remember = v },
      get errors() { return errors },
      get busy() { return busy },
      /** Id of the provider whose flow is running, or null. */
      get pending() { return pending },
      validate,
      submit,
      continueWith,
      /** Spread on your <form>. */
      formProps: () => ({ novalidate: true, onsubmit: submit }),
      /** Spread on a plain <input> when you render your own fields. */
      fieldProps: (name: 'email' | 'password') => ({
        name,
        value: name === 'email' ? email : password,
        oninput: (e: Event) => {
          const v = (e.currentTarget as HTMLInputElement).value
          if (name === 'email') { email = v; errors.email = undefined } else { password = v; errors.password = undefined }
        },
        'aria-invalid': errors[name] ? ('true' as const) : undefined,
      }),
      /** Spread on a plain <button> for one provider. */
      providerProps: (p: LoginProvider) => ({
        type: 'button' as const,
        disabled: !!pending && pending !== p.id,
        'aria-busy': pending === p.id,
        onclick: () => continueWith(p),
      }),
    }
  }
</script>

<script lang="ts">
  import {
    SvCard, SvTextInput, SvPasswordInput, SvCheckBox, SvButton, SvDivider,
    SvBadge, SvToaster, toast,
  } from '@svgrid/grid'

  const login = createLogin({
    initial: { email: 'ada@northwind.io', remember: true },
    onProvider: (p) => { toast(`Redirecting to ${p.name}...`) },
    // Replace with your request; a thrown error leaves the form as it was.
    onSubmit: () =>
      toast.promise(new Promise<void>((res) => setTimeout(res, 1100)), {
        loading: 'Signing in...',
        success: 'Welcome back, Ada',
        error: 'Sign-in failed',
      }).then(() => {}),
  })
</script>

<div class="sv-login">
  <!-- Brand panel -->
  <aside class="sv-login-brand">
    <div class="sv-login-brand-top">
      <span class="sv-login-logo">◧</span>
      <strong>Northwind</strong>
    </div>
    <div class="sv-login-brand-mid">
      <SvBadge variant="accent" pill>Analytics Cloud</SvBadge>
      <h2>Sign in to your workspace.</h2>
      <p>Dashboards, pipelines and reports for the whole team - in one place.</p>
    </div>
    <blockquote class="sv-login-quote">
      "We replaced three internal tools with Northwind in a weekend."
      <cite>- Grace H., Head of Data</cite>
    </blockquote>
  </aside>

  <!-- Form panel -->
  <main class="sv-login-form">
    <SvCard>
      <div class="sv-login-head">
        <h2>Welcome back</h2>
        <p class="sv-login-muted">Enter your credentials to access your account.</p>
      </div>

      <div class="sv-login-social">
        {#each login.providers as p (p.id)}
          <SvButton variant="outline" block loading={login.pending === p.id} onclick={() => login.continueWith(p)}>
            <span class="sv-login-prov"><span class="sv-login-prov-mark">{p.mark}</span>Continue with {p.name}</span>
          </SvButton>
        {/each}
      </div>

      <SvDivider label="or" />

      <form class="sv-login-fields" {...login.formProps()}>
        <SvTextInput
          label="Email" type="email" name="email" autocomplete="email" bind:value={login.email} block required
          error={login.errors.email} invalid={!!login.errors.email}
        >
          {#snippet leading()}<span class="sv-login-ic">✉</span>{/snippet}
        </SvTextInput>

        <div>
          <div class="sv-login-pw-label">
            <span>Password</span>
            <button type="button" class="sv-login-link" onclick={() => toast('Reset link sent')}>Forgot?</button>
          </div>
          <SvPasswordInput
            name="password" bind:value={login.password} block required
            error={login.errors.password} invalid={!!login.errors.password}
          >
            {#snippet leading()}<span class="sv-login-ic">🔒</span>{/snippet}
          </SvPasswordInput>
        </div>

        <SvCheckBox checked={login.remember} onChange={(v) => (login.remember = v)}>Remember me for 30 days</SvCheckBox>

        <SvButton type="submit" variant="primary" block loading={login.busy}>Sign in</SvButton>
      </form>

      {#snippet footer()}
        <p class="sv-login-foot">No account? <button type="button" class="sv-login-link" onclick={() => toast('Opening sign-up')}>Create one</button></p>
      {/snippet}
    </SvCard>
    <p class="sv-login-legal">By continuing you agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.</p>
  </main>
</div>

<SvToaster position="bottom-right" />

<style>
  .sv-login {
    display: grid;
    grid-template-columns: 1.1fr 1fr;
    width: 100%;
    box-sizing: border-box;
    min-height: 560px;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #eef2f7);
    border-radius: 14px;
    overflow: hidden;
  }
  .sv-login-brand {
    display: flex; flex-direction: column; justify-content: space-between;
    gap: 28px; padding: 32px;
    color: var(--sg-on-accent, #fff);
    background: var(--sg-accent, #4338ca);
  }
  .sv-login-brand-top { display: flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 700; }
  .sv-login-logo { font-size: 22px; }
  .sv-login-brand-mid h2 { font-size: 30px; line-height: 1.15; margin: 14px 0 10px; letter-spacing: -.02em; }
  .sv-login-brand-mid p { margin: 0; opacity: .82; max-width: 34ch; line-height: 1.5; }
  /* currentColor so the rule tracks whatever sits legibly on the accent. */
  .sv-login-quote { margin: 0; font-size: 14px; line-height: 1.55; opacity: .9; border-left: 3px solid color-mix(in srgb, currentColor 40%, transparent); padding-left: 14px; }
  .sv-login-quote cite { display: block; margin-top: 8px; font-style: normal; opacity: .7; font-size: 12.5px; }

  .sv-login-form { display: flex; flex-direction: column; justify-content: center; gap: 12px; padding: 32px; max-width: 420px; margin: 0 auto; width: 100%; }
  .sv-login-head h2 { margin: 0 0 4px; font-size: 22px; letter-spacing: -.01em; }
  .sv-login-muted { color: var(--sg-muted, #64748b); font-size: 13.5px; margin: 0; }
  .sv-login-social { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
  .sv-login-prov { display: inline-flex; align-items: center; gap: 8px; }
  .sv-login-prov-mark { display: inline-flex; width: 18px; height: 18px; align-items: center; justify-content: center; font-weight: 700; }
  .sv-login-fields { display: flex; flex-direction: column; gap: 14px; }
  .sv-login-pw-label { display: flex; justify-content: space-between; align-items: baseline; font-size: 12.5px; font-weight: 500; margin-bottom: 5px; }
  .sv-login-link { background: none; border: 0; padding: 0; font: inherit; color: var(--sg-accent, #4f46e5); cursor: pointer; font-size: 12.5px; }
  .sv-login-link:hover { text-decoration: underline; }
  .sv-login-link:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #4f46e5)); outline-offset: 2px; border-radius: 3px; }
  .sv-login-foot { margin: 0; text-align: center; font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-login-legal { text-align: center; font-size: 11.5px; color: var(--sg-muted, #94a3b8); margin: 0; }
  .sv-login-legal a { color: inherit; text-decoration: underline; }
  .sv-login-ic { display: inline-flex; font-size: 13px; }

  @media (max-width: 720px) {
    .sv-login { grid-template-columns: 1fr; }
    .sv-login-brand { display: none; }
  }
</style>
