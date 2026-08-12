<script lang="ts">
  /**
   * Sign-up block - a centered account-creation card composed from the UI kit.
   * Two-up name fields, email, a password with the live strength meter, a plan
   * SvSegmented switch, terms SvCheckBox, and a submit SvButton. A compact
   * benefits rail sits beside the card. Pure UI-kit, --sg-* themed.
   */
  import {
    SvCard, SvTextInput, SvPasswordInput, SvSegmented, SvCheckBox, SvButton,
    SvDivider, SvList, SvBadge, SvToaster, toast,
  } from '@svgrid/grid'

  let first = $state('Ada')
  let last = $state('Lovelace')
  let email = $state('')
  let password = $state('')
  let plan = $state<string | number>('pro')
  let agree = $state(false)
  let busy = $state(false)

  const canSubmit = $derived(!!email && password.length >= 8 && agree)

  function submit(e: Event) {
    e.preventDefault()
    if (!canSubmit) { toast('Fill the form and accept the terms', { variant: 'warning' }); return }
    busy = true
    toast.promise(new Promise<void>((res) => setTimeout(res, 1200)), {
      loading: 'Creating your account...',
      success: () => { busy = false; return 'Account created - check your inbox' },
      error: () => { busy = false; return 'Could not create account' },
    })
  }
</script>

<div class="wrap">
  <div class="su-grid">
    <!-- Benefits rail -->
    <aside class="rail">
      <SvBadge variant="accent" pill>14-day free trial</SvBadge>
      <h1>Start building today.</h1>
      <p class="muted">No credit card required. Cancel anytime.</p>
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
      <form onsubmit={submit} class="fields">
        <div class="two">
          <SvTextInput label="First name" bind:value={first} block />
          <SvTextInput label="Last name" bind:value={last} block />
        </div>
        <SvTextInput label="Work email" type="email" bind:value={email} block required>
          {#snippet leading()}<span class="ic">✉</span>{/snippet}
        </SvTextInput>
        <SvPasswordInput label="Password" bind:value={password} showStrength block required
          hint="At least 8 characters." />

        <div>
          <div class="lbl">Choose a plan</div>
          <SvSegmented
            bind:value={plan}
            block
            options={[
              { value: 'starter', label: 'Starter' },
              { value: 'pro', label: 'Pro' },
              { value: 'team', label: 'Team' },
            ]}
          />
        </div>

        <SvCheckBox checked={agree} onChange={(v) => (agree = v)}>
          I agree to the Terms of Service and Privacy Policy
        </SvCheckBox>

        <SvButton type="submit" variant="primary" block loading={busy} disabled={!canSubmit}>
          Create account
        </SvButton>
      </form>

      {#snippet footer()}
        <p class="foot">Already have an account? <button class="link" onclick={() => toast('Opening sign-in')}>Sign in</button></p>
      {/snippet}
    </SvCard>
  </div>
</div>

<SvToaster position="bottom-right" />

<style>
  .wrap { padding: 24px; }
  /* Full-width grid that centers its two fixed tracks via justify-content, so
     nothing shrinks the card and no percentage max-width can clamp it. */
  .su-grid { display: grid; grid-template-columns: 300px 420px; justify-content: center; gap: 28px; align-items: start; width: 100%; box-sizing: border-box; }
  .rail { padding: 8px 4px; display: flex; flex-direction: column; gap: 12px; }
  .rail h1 { font-size: 26px; margin: 8px 0 0; letter-spacing: -.02em; line-height: 1.15; }
  .muted { color: var(--sg-muted, #64748b); font-size: 13.5px; margin: 0; }
  .fields { display: flex; flex-direction: column; gap: 15px; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .lbl { font-size: 12.5px; font-weight: 500; margin-bottom: 6px; }
  .foot { margin: 0; text-align: center; font-size: 13px; color: var(--sg-muted, #64748b); }
  .link { background: none; border: 0; padding: 0; font: inherit; color: var(--sg-accent, #4f46e5); cursor: pointer; }
  .link:hover { text-decoration: underline; }
  .ic { display: inline-flex; font-size: 13px; }

  @media (max-width: 820px) {
    .su-grid { grid-template-columns: minmax(0, 420px); }
    .rail { display: none; }
  }
</style>
