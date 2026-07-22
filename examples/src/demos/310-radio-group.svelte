<script lang="ts">
  /**
   * SvRadioGroup - a production plan picker and a shipping-method selector.
   * Arrow-key navigable (WAI-ARIA radiogroup), with label + validation. Copy-paste
   * ready.
   */
  import { SvRadioGroup } from '@svgrid/grid'

  const plans = [
    { value: 'starter', label: 'Starter - $0 / mo' },
    { value: 'pro', label: 'Pro - $29 / mo' },
    { value: 'team', label: 'Team - $99 / mo' },
    { value: 'enterprise', label: 'Enterprise - contact us' },
  ]
  const shipping = [
    { value: 'standard', label: 'Standard (5-7 days)' },
    { value: 'express', label: 'Express (2 days)' },
    { value: 'overnight', label: 'Overnight', disabled: true },
  ]
  let plan = $state<string | number | null>('pro')
  let ship = $state<string | number | null>(null)
  let submitted = $state(false)
  const shipError = $derived(submitted && !ship ? 'Choose a shipping method' : undefined)
</script>

<div class="wrap">
  <header>
    <h2>Radio group</h2>
    <p>Single choice with roving arrow-key focus (WAI-ARIA radiogroup) - plans, shipping, payment.</p>
  </header>

  <div class="cols">
    <section>
      <h3>Choose a plan</h3>
      <SvRadioGroup options={plans} value={plan} onChange={(v) => (plan = v)} />
    </section>

    <section>
      <SvRadioGroup
        options={shipping}
        value={ship}
        label="Shipping method"
        required
        invalid={!!shipError}
        error={shipError}
        onChange={(v) => (ship = v)}
      />
      <button class="btn" onclick={() => (submitted = true)}>Place order</button>
    </section>
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 640px; display: flex; flex-direction: column; gap: 16px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 28px; align-items: start; }
  section h3 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .btn { margin-top: 14px; font: inherit; font-size: 13px; font-weight: 600; padding: 7px 16px; border: 0; border-radius: 8px; background: var(--sg-accent, #2563eb); color: #fff; cursor: pointer; }
</style>
