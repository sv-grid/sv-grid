<script lang="ts" module>
  /**
   * Sign-up block - a centered account-creation SvCard: two-up name fields
   * (SvTextInput), work email, an SvPasswordInput with the live strength
   * meter, a plan SvSegmented switch, a terms SvCheckBox and a submit
   * SvButton. A compact benefits rail (SvBadge, SvList) sits beside the card.
   * Pure UI-kit, --sg-* themed.
   *
   * Headless: createSignup() below owns the fields, the plan, the
   * can-submit rule and the submit flow with no markup. The component under
   * it is one styled render of that core; import createSignup from this file
   * (or `npx @svgrid/ui add signup --headless` for the core alone) to draw
   * your own.
   */
  export type SignupPlan = { value: string; label: string }
  export type SignupValues = {
    first: string; last: string; email: string; password: string; plan: string; agree: boolean
  }
  type TextField = 'first' | 'last' | 'email' | 'password'
  export type SignupOptions = {
    /** Called with the values once the form is complete; throw to keep it open. */
    onSubmit?: (values: SignupValues) => Promise<void> | void
    /** onSubmit threw; show your own message here. */
    onError?: (error: unknown) => void
    /** Submit was pressed before the form was complete. */
    onIncomplete?: () => void
    plans?: SignupPlan[]
    initial?: Partial<SignupValues>
    /** Shortest password that enables submit. */
    minPassword?: number
  }

  const PLANS: SignupPlan[] = [
    { value: 'starter', label: 'Starter' },
    { value: 'pro', label: 'Pro' },
    { value: 'team', label: 'Team' },
  ]

  export function createSignup(opts: SignupOptions = {}) {
    const plans = opts.plans ?? PLANS
    const minPassword = opts.minPassword ?? 8
    const init = opts.initial ?? {}
    let fields = $state<Record<TextField, string>>({
      first: init.first ?? '', last: init.last ?? '', email: init.email ?? '', password: init.password ?? '',
    })
    let plan = $state(init.plan ?? plans[0]?.value ?? '')
    let agree = $state(init.agree ?? false)
    let busy = $state(false)

    const canSubmit = $derived(!!fields.email.trim() && fields.password.length >= minPassword && agree)

    async function submit(ev?: Event) {
      ev?.preventDefault()
      if (busy) return
      if (!canSubmit) { opts.onIncomplete?.(); return }
      busy = true
      try {
        await opts.onSubmit?.({
          first: fields.first.trim(), last: fields.last.trim(), email: fields.email.trim(),
          password: fields.password, plan, agree,
        })
      } catch (e) {
        opts.onError?.(e)
      } finally {
        busy = false
      }
    }

    return {
      plans,
      minPassword,
      get first() { return fields.first },
      set first(v: string) { fields.first = v },
      get last() { return fields.last },
      set last(v: string) { fields.last = v },
      get email() { return fields.email },
      set email(v: string) { fields.email = v },
      get password() { return fields.password },
      set password(v: string) { fields.password = v },
      get plan() { return plan },
      /** Accepts a number too, so a segmented control can bind to it. */
      set plan(v: string | number | null) { if (v != null) plan = String(v) },
      get agree() { return agree },
      set agree(v: boolean) { agree = v },
      get canSubmit() { return canSubmit },
      get busy() { return busy },
      submit,
      /** Spread on your <form>. */
      formProps: () => ({ onsubmit: submit }),
      /** Spread on a plain <input> when you render your own fields. */
      fieldProps: (name: TextField) => ({
        name,
        value: fields[name],
        oninput: (e: Event) => { fields[name] = (e.currentTarget as HTMLInputElement).value },
      }),
      /** Spread on a plain checkbox for the terms. */
      agreeProps: () => ({
        type: 'checkbox' as const,
        checked: agree,
        onchange: (e: Event) => { agree = (e.currentTarget as HTMLInputElement).checked },
      }),
    }
  }
</script>

<script lang="ts">
  import {
    SvCard, SvTextInput, SvPasswordInput, SvSegmented, SvCheckBox, SvButton,
    SvDivider, SvList, SvBadge, SvToaster, toast,
  } from '@svgrid/grid'

  const signup = createSignup({
    initial: { first: 'Ada', last: 'Lovelace', plan: 'pro' },
    onIncomplete: () => toast('Fill the form and accept the terms', { variant: 'warning' }),
    // Replace with your request; a thrown error leaves the form as it was.
    onSubmit: () =>
      toast.promise(new Promise<void>((res) => setTimeout(res, 1200)), {
        loading: 'Creating your account...',
        success: 'Account created - check your inbox',
        error: 'Could not create account',
      }).then(() => {}),
  })
</script>

<div class="sv-signup">
  <div class="sv-signup-grid">
    <!-- Benefits rail -->
    <aside class="sv-signup-rail">
      <SvBadge variant="accent" pill>14-day free trial</SvBadge>
      <h2>Start building today.</h2>
      <p class="sv-signup-muted">No credit card required. Cancel anytime.</p>
      <SvDivider />
      <SvList type="none" spacing="md">
        <li>✓ Unlimited dashboards & reports</li>
        <li>✓ Live SQL and REST data sources</li>
        <li>✓ Role-based access for your team</li>
        <li>✓ Export to Excel, PDF and CSV</li>
      </SvList>
    </aside>

    <!-- Form card -->
    <SvCard title="Create your account" subtitle="Get your workspace up in under a minute.">
      <form class="sv-signup-fields" {...signup.formProps()}>
        <div class="sv-signup-two">
          <SvTextInput label="First name" name="first" autocomplete="given-name" bind:value={signup.first} block />
          <SvTextInput label="Last name" name="last" autocomplete="family-name" bind:value={signup.last} block />
        </div>
        <SvTextInput label="Work email" type="email" name="email" autocomplete="email" bind:value={signup.email} block required>
          {#snippet leading()}<span class="sv-signup-ic">✉</span>{/snippet}
        </SvTextInput>
        <SvPasswordInput label="Password" name="password" bind:value={signup.password} showStrength block required
          hint="At least {signup.minPassword} characters." />

        <div>
          <div class="sv-signup-lbl">Choose a plan</div>
          <SvSegmented bind:value={signup.plan} block options={signup.plans} />
        </div>

        <SvCheckBox checked={signup.agree} onChange={(v) => (signup.agree = v)}>
          I agree to the Terms of Service and Privacy Policy
        </SvCheckBox>

        <SvButton type="submit" variant="primary" block loading={signup.busy} disabled={!signup.canSubmit}>
          Create account
        </SvButton>
      </form>

      {#snippet footer()}
        <p class="sv-signup-foot">Already have an account? <button type="button" class="sv-signup-link" onclick={() => toast('Opening sign-in')}>Sign in</button></p>
      {/snippet}
    </SvCard>
  </div>
</div>

<SvToaster position="bottom-right" />

<style>
  .sv-signup { padding: 24px; width: 100%; box-sizing: border-box; }
  /* Full-width grid that centers its two fixed tracks via justify-content, so
     nothing shrinks the card and no percentage max-width can clamp it. */
  .sv-signup-grid { display: grid; grid-template-columns: 300px 420px; justify-content: center; gap: 28px; align-items: start; width: 100%; box-sizing: border-box; }
  .sv-signup-rail { padding: 8px 4px; display: flex; flex-direction: column; gap: 12px; }
  .sv-signup-rail h2 { font-size: 26px; margin: 8px 0 0; letter-spacing: -.02em; line-height: 1.15; }
  .sv-signup-muted { color: var(--sg-muted, #64748b); font-size: 13.5px; margin: 0; }
  .sv-signup-fields { display: flex; flex-direction: column; gap: 15px; }
  .sv-signup-two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .sv-signup-lbl { font-size: 12.5px; font-weight: 500; margin-bottom: 6px; }
  .sv-signup-foot { margin: 0; text-align: center; font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-signup-link { background: none; border: 0; padding: 0; font: inherit; color: var(--sg-accent, #4f46e5); cursor: pointer; }
  .sv-signup-link:hover { text-decoration: underline; }
  .sv-signup-link:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #4f46e5)); outline-offset: 2px; border-radius: 3px; }
  .sv-signup-ic { display: inline-flex; font-size: 13px; }

  @media (max-width: 820px) {
    .sv-signup { padding: 14px; }
    .sv-signup-grid { grid-template-columns: minmax(0, 420px); }
    .sv-signup-rail { display: none; }
    .sv-signup-two { grid-template-columns: minmax(0, 1fr); }
  }
</style>
