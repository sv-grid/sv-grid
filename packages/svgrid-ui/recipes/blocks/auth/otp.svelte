<script lang="ts" module>
  /**
   * Two-factor verification block - the one-time-code step of a sign-in. A
   * centered SvCard with SvOtpInput (6 digits, auto-advance, verifies on the
   * last digit), a verify SvButton with its loading state, a resend link with
   * an SvBadge countdown, and back / recovery links. Moves through waiting,
   * verifying and verified. Pure UI-kit, --sg-* themed.
   *
   * Headless: createOtp() below owns the code, the verify flow and the resend
   * cooldown with no markup. The component under it is one styled render of
   * that core; import createOtp from this file (or `npx @svgrid/ui add otp
   * --headless` for the core alone) to draw your own.
   */
  type Status = 'idle' | 'verifying' | 'done'
  const DESTINATION = 'ada@northwind.io'

  export type OtpStatus = Status
  export type OtpOptions = {
    /** Where the code went; shown in the copy and passed to onResend. */
    destination?: string
    /** Digits in a code. */
    length?: number
    /** Seconds before another code can be requested. */
    cooldown?: number
    /** Check the code with your API. Return false or throw to reject it. */
    onVerify?: (code: string) => Promise<boolean | void> | boolean | void
    onVerified?: (code: string) => void
    onRejected?: (code: string, error?: unknown) => void
    /** Verify was pressed with fewer than `length` digits. */
    onIncomplete?: (code: string) => void
    /** Send a new code. */
    onResend?: (destination: string) => Promise<void> | void
  }

  /**
   * Call during component init: the resend cooldown ticks in an $effect that
   * is cleared when the component unmounts.
   */
  export function createOtp(opts: OtpOptions = {}) {
    const length = opts.length ?? 6
    const destination = opts.destination ?? DESTINATION
    let code = $state('')
    let status = $state<OtpStatus>('idle')
    let cooldown = $state(0)

    $effect(() => {
      if (cooldown <= 0) return
      const t = setTimeout(() => (cooldown -= 1), 1000)
      return () => clearTimeout(t)
    })

    async function verify(value = code) {
      if (status !== 'idle') return
      if (value.length < length) { opts.onIncomplete?.(value); return }
      status = 'verifying'
      let ok = false
      let error: unknown
      try {
        ok = (await opts.onVerify?.(value)) !== false
      } catch (e) {
        error = e
      }
      status = ok ? 'done' : 'idle'
      if (ok) opts.onVerified?.(value)
      else opts.onRejected?.(value, error)
    }

    function resend() {
      if (cooldown > 0) return
      cooldown = opts.cooldown ?? 30
      opts.onResend?.(destination)
    }

    return {
      length,
      destination,
      get code() { return code },
      set code(v: string) { code = v },
      get status() { return status },
      get cooldown() { return cooldown },
      verify,
      resend,
      /** Spread on a plain <input> if you render one field instead of cells. */
      inputProps: () => ({
        value: code,
        inputmode: 'numeric' as const,
        autocomplete: 'one-time-code',
        maxlength: length,
        oninput: (e: Event) => {
          code = (e.currentTarget as HTMLInputElement).value.replace(/\D/g, '').slice(0, length)
          if (code.length === length) verify(code)
        },
      }),
      /** Spread on the resend <button>. */
      resendProps: () => ({ type: 'button' as const, disabled: cooldown > 0, onclick: resend }),
    }
  }
</script>

<script lang="ts">
  import {
    SvCard, SvOtpInput, SvButton, SvBadge, SvToaster, toast,
  } from '@svgrid/grid'

  const otp = createOtp({
    // Replace with your check; the demo rejects 000000.
    onVerify: (code) => new Promise<boolean>((res) => setTimeout(() => res(code !== '000000'), 900)),
    onVerified: () => toast.success('Identity verified'),
    onRejected: () => toast.error('Invalid code, try again'),
    onIncomplete: () => toast('Enter all 6 digits', { variant: 'warning' }),
    onResend: (to) => { toast('New code sent to ' + to) },
  })
</script>

<div class="sv-verify">
  <SvCard>
    <div class="sv-verify-head">
      <span class="sv-verify-shield">🛡</span>
      <h2>Verify it's you</h2>
      <p class="sv-verify-muted">We sent a {otp.length}-digit code to <strong>{otp.destination}</strong>.</p>
    </div>

    {#if otp.status === 'done'}
      <div class="sv-verify-done">
        <span class="sv-verify-check">✓</span>
        <div>
          <strong>Verified</strong>
          <div class="sv-verify-muted">Redirecting to your dashboard...</div>
        </div>
      </div>
    {:else}
      <div class="sv-verify-code">
        <SvOtpInput bind:value={otp.code} length={otp.length} autofocus onComplete={(v) => otp.verify(v)} />
      </div>

      <SvButton variant="primary" block loading={otp.status === 'verifying'} onclick={() => otp.verify()}>Verify</SvButton>

      <div class="sv-verify-resend">
        <span class="sv-verify-muted">Didn't get a code?</span>
        {#if otp.cooldown > 0}
          <SvBadge variant="neutral">Resend in {otp.cooldown}s</SvBadge>
        {:else}
          <button class="sv-verify-link" {...otp.resendProps()}>Resend code</button>
        {/if}
      </div>
    {/if}

    {#snippet footer()}
      <div class="sv-verify-foot">
        <button type="button" class="sv-verify-link" onclick={() => toast('Back to sign-in')}>← Use a different account</button>
        <button type="button" class="sv-verify-link" onclick={() => toast('Recovery options opened')}>Trouble signing in?</button>
      </div>
    {/snippet}
  </SvCard>

  <p class="sv-verify-hint">Tip: enter <code>000000</code> to see the error state.</p>
</div>

<SvToaster position="bottom-right" />

<style>
  .sv-verify { padding: 32px 24px; display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; box-sizing: border-box; }
  .sv-verify > :global(:first-child) { width: 100%; max-width: 400px; }
  .sv-verify-head { text-align: center; margin-bottom: 18px; }
  .sv-verify-shield { font-size: 30px; display: block; margin-bottom: 8px; }
  .sv-verify-head h2 { margin: 0 0 4px; font-size: 21px; }
  .sv-verify-muted { color: var(--sg-muted, #64748b); font-size: 13.5px; margin: 0; }
  .sv-verify-code { display: flex; justify-content: center; margin: 6px 0 18px; }
  .sv-verify-resend { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 14px; font-size: 13px; }
  .sv-verify-link { background: none; border: 0; padding: 0; font: inherit; color: var(--sg-accent, #4f46e5); cursor: pointer; }
  .sv-verify-link:hover { text-decoration: underline; }
  .sv-verify-link:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #4f46e5)); outline-offset: 2px; border-radius: 3px; }
  .sv-verify-foot { display: flex; flex-direction: column; gap: 6px; align-items: center; font-size: 12.5px; }
  .sv-verify-done { display: flex; align-items: center; gap: 14px; justify-content: center; padding: 18px 0; }
  .sv-verify-check { display: inline-flex; width: 40px; height: 40px; align-items: center; justify-content: center; border-radius: 50%; background: color-mix(in srgb, var(--sg-success, #22c55e) 20%, transparent); color: var(--sg-success, #22c55e); font-size: 20px; font-weight: 700; }
  .sv-verify-done strong { font-size: 15px; }
  .sv-verify-hint { font-size: 12px; color: var(--sg-muted, #94a3b8); margin: 0; }
  .sv-verify-hint code { background: var(--sg-row-hover-bg, #f1f5f9); padding: 1px 5px; border-radius: 4px; }
</style>
