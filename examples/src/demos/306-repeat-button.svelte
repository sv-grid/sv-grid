<script lang="ts">
  /**
   * SvRepeatButton - hold-to-repeat. A production quantity stepper + a volume
   * control block: press and hold to fire repeatedly with acceleration. Copy-paste
   * ready.
   */
  import { SvRepeatButton } from '@svgrid/grid'

  let qty = $state(1)
  let volume = $state(40)
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
</script>

<div class="wrap">
  <header>
    <h2>Repeat button</h2>
    <p>Hold to fire repeatedly (with an initial delay, then acceleration) - steppers, spinners, seek controls.</p>
  </header>

  <section class="block">
    <h3>Quantity stepper</h3>
    <div class="stepper">
      <SvRepeatButton variant="outline" ariaLabel="Decrease" onclick={() => (qty = clamp(qty - 1, 0, 99))}>-</SvRepeatButton>
      <span class="num">{qty}</span>
      <SvRepeatButton variant="outline" ariaLabel="Increase" onclick={() => (qty = clamp(qty + 1, 0, 99))}>+</SvRepeatButton>
    </div>
  </section>

  <section class="block">
    <h3>Volume</h3>
    <div class="vol">
      <SvRepeatButton variant="ghost" ariaLabel="Volume down" onclick={() => (volume = clamp(volume - 2, 0, 100))}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4zM23 9l-6 6M17 9l6 6" /></svg>
      </SvRepeatButton>
      <div class="meter"><span style:width={`${volume}%`}></span></div>
      <SvRepeatButton variant="ghost" ariaLabel="Volume up" onclick={() => (volume = clamp(volume + 2, 0, 100))}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" /></svg>
      </SvRepeatButton>
      <span class="num sm">{volume}%</span>
    </div>
  </section>
</div>

<style>
  .wrap { padding: 20px; max-width: 560px; display: flex; flex-direction: column; gap: 22px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  .block h3 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .stepper { display: inline-flex; align-items: center; gap: 4px; }
  .num { min-width: 44px; text-align: center; font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .num.sm { min-width: 40px; font-size: 13px; }
  .vol { display: flex; align-items: center; gap: 10px; }
  .meter { width: 180px; height: 6px; border-radius: 999px; background: var(--sg-border, #e2e8f0); overflow: hidden; }
  .meter span { display: block; height: 100%; background: var(--sg-accent, #2563eb); }
</style>
