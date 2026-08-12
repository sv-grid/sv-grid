<script lang="ts">
  /**
   * Two-factor verification block - the OTP step of a sign-in flow. A centered
   * card with SvOtpInput (6 digits, auto-advance + onComplete), a resend timer,
   * and verify / back actions. Shows the "waiting -> verifying -> done" states.
   * Pure UI-kit, --sg-* themed.
   */
  import {
    SvCard, SvOtpInput, SvButton, SvBadge, SvDivider, SvToaster, toast,
  } from '@svgrid/grid'

  let code = $state('')
  let status = $state<'idle' | 'verifying' | 'done'>('idle')
  let cooldown = $state(0)

  const dest = 'ada@northwind.io'

  function verify(value = code) {
    if (value.length < 6) { toast('Enter all 6 digits', { variant: 'warning' }); return }
    status = 'verifying'
    setTimeout(() => {
      if (value === '000000') { status = 'idle'; toast.error('Invalid code, try again'); return }
      status = 'done'
      toast.success('Identity verified')
    }, 900)
  }

  let timer: ReturnType<typeof setInterval> | undefined
  function resend() {
    if (cooldown > 0) return
    toast('New code sent to ' + dest)
    cooldown = 30
    timer = setInterval(() => {
      cooldown -= 1
      if (cooldown <= 0 && timer) clearInterval(timer)
    }, 1000)
  }
</script>

<div class="otp-wrap">
  <SvCard>
    <div class="head">
      <span class="shield">🛡</span>
      <h2>Verify it's you</h2>
      <p class="muted">We sent a 6-digit code to <strong>{dest}</strong>.</p>
    </div>

    {#if status === 'done'}
      <div class="done">
        <span class="check">✓</span>
        <div>
          <strong>Verified</strong>
          <div class="muted">Redirecting to your dashboard...</div>
        </div>
      </div>
    {:else}
      <div class="otp">
        <SvOtpInput
          bind:value={code}
          length={6}
          autofocus
          onComplete={(v) => verify(v)}
        />
      </div>

      <SvButton
        variant="primary"
        block
        loading={status === 'verifying'}
        onclick={() => verify()}
      >Verify</SvButton>

      <div class="resend">
        <span class="muted">Didn't get a code?</span>
        {#if cooldown > 0}
          <SvBadge variant="neutral">Resend in {cooldown}s</SvBadge>
        {:else}
          <button class="link" onclick={resend}>Resend code</button>
        {/if}
      </div>
    {/if}

    {#snippet footer()}
      <div class="foot">
        <button class="link" onclick={() => toast('Back to sign-in')}>← Use a different account</button>
        <button class="link" onclick={() => toast('Recovery options opened')}>Trouble signing in?</button>
      </div>
    {/snippet}
  </SvCard>

  <p class="hint">Tip: enter <code>000000</code> to see the error state.</p>
</div>

<SvToaster position="bottom-right" />

<style>
  .otp-wrap { padding: 32px 24px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  /* Scoped to this demo's unique wrapper class so the global card-width rule
     can't leak onto other demos that also use a `.wrap` container. */
  .otp-wrap :global(> *:first-child) { width: 100%; max-width: 400px; }
  .head { text-align: center; margin-bottom: 18px; }
  .shield { font-size: 30px; display: block; margin-bottom: 8px; }
  .head h2 { margin: 0 0 4px; font-size: 21px; }
  .muted { color: var(--sg-muted, #64748b); font-size: 13.5px; margin: 0; }
  .otp { display: flex; justify-content: center; margin: 6px 0 18px; }
  .resend { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 14px; font-size: 13px; }
  .link { background: none; border: 0; padding: 0; font: inherit; color: var(--sg-accent, #4f46e5); cursor: pointer; }
  .link:hover { text-decoration: underline; }
  .foot { display: flex; flex-direction: column; gap: 6px; align-items: center; font-size: 12.5px; }
  .done { display: flex; align-items: center; gap: 14px; justify-content: center; padding: 18px 0; }
  .check { display: inline-flex; width: 40px; height: 40px; align-items: center; justify-content: center; border-radius: 50%; background: color-mix(in srgb, #22c55e 20%, transparent); color: #22c55e; font-size: 20px; font-weight: 700; }
  .done strong { font-size: 15px; }
  .hint { font-size: 12px; color: var(--sg-muted, #94a3b8); margin: 0; }
  .hint code { background: var(--sg-row-hover-bg, #f1f5f9); padding: 1px 5px; border-radius: 4px; }
</style>
