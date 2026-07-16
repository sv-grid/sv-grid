<script lang="ts">
  /**
   * Buttons & Toggles - the SvGrid UI kit's press/toggle primitives. Every one
   * is theme-driven (--sg-*) and works standalone or as a grid cell control.
   */
  import {
    SvButton, SvRepeatButton, SvToggleButton, SvSwitchButton,
    SvCheckBox, SvRadioGroup, SvRating,
  } from '@svgrid/grid'

  let count = $state(0)
  let bold = $state(false)
  let italic = $state(false)
  let notify = $state(true)
  let agree = $state(false)
  let some = $state(true)
  let plan = $state<string>('pro')
  let stars = $state(3)

  const plans = [
    { value: 'free', label: 'Free' },
    { value: 'pro', label: 'Pro' },
    { value: 'ent', label: 'Enterprise', disabled: true },
  ]
</script>

<div class="wrap">
  <header>
    <h2>Buttons &amp; Toggles</h2>
    <p>Press and toggle primitives from <code>@svgrid/grid</code>. Theme-driven, keyboard-accessible, standalone or in-grid.</p>
  </header>

  <section>
    <h3>SvButton</h3>
    <div class="row">
      <SvButton>Primary</SvButton>
      <SvButton variant="secondary">Secondary</SvButton>
      <SvButton variant="outline">Outline</SvButton>
      <SvButton variant="ghost">Ghost</SvButton>
      <SvButton variant="danger">Danger</SvButton>
      <SvButton loading>Loading</SvButton>
      <SvButton disabled>Disabled</SvButton>
    </div>
    <div class="row">
      <SvButton size="sm">Small</SvButton>
      <SvButton size="md">Medium</SvButton>
      <SvButton size="lg">Large</SvButton>
    </div>
  </section>

  <section>
    <h3>SvRepeatButton <span class="muted">(hold to repeat)</span></h3>
    <div class="row center">
      <SvRepeatButton onclick={() => (count -= 1)} ariaLabel="Decrease">&minus;</SvRepeatButton>
      <strong class="count">{count}</strong>
      <SvRepeatButton onclick={() => (count += 1)} ariaLabel="Increase">+</SvRepeatButton>
    </div>
  </section>

  <section>
    <h3>SvToggleButton &amp; SvSwitchButton</h3>
    <div class="row center">
      <SvToggleButton pressed={bold} onChange={(v) => (bold = v)} ariaLabel="Bold"><strong>B</strong></SvToggleButton>
      <SvToggleButton pressed={italic} onChange={(v) => (italic = v)} ariaLabel="Italic"><em>I</em></SvToggleButton>
      <span class="sep"></span>
      <SvSwitchButton checked={notify} onChange={(v) => (notify = v)} ariaLabel="Notifications" />
      <span class="muted">Notifications {notify ? 'on' : 'off'}</span>
    </div>
  </section>

  <section>
    <h3>SvCheckBox</h3>
    <div class="row col">
      <SvCheckBox checked={agree} onChange={(v) => (agree = v)}>I agree to the terms</SvCheckBox>
      <SvCheckBox indeterminate={some} checked={some} onChange={() => (some = !some)}>Partially selected (indeterminate)</SvCheckBox>
      <SvCheckBox checked disabled>Disabled, checked</SvCheckBox>
    </div>
  </section>

  <section>
    <h3>SvRadioGroup <span class="muted">(arrow keys navigate)</span></h3>
    <SvRadioGroup options={plans} value={plan} onChange={(v) => (plan = String(v))} orientation="horizontal" ariaLabel="Plan" />
    <p class="muted">Selected: <strong>{plan}</strong></p>
  </section>

  <section>
    <h3>SvRating</h3>
    <div class="row center">
      <SvRating value={stars} onChange={(v) => (stars = v)} />
      <span class="muted">{stars} / 5</span>
      <span class="sep"></span>
      <SvRating value={4.5} allowHalf readOnly size="sm" />
      <span class="muted">read-only, half</span>
    </div>
  </section>
</div>

<style>
  .wrap { padding: 22px; max-width: 820px; display: flex; flex-direction: column; gap: 22px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  section h3 { margin: 0 0 10px; font-size: 14px; font-weight: 650; }
  .row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 8px; }
  .row.center { align-items: center; }
  .row.col { flex-direction: column; align-items: flex-start; gap: 8px; }
  .muted { color: var(--sg-muted, #64748b); font-size: 12.5px; }
  .count { font-size: 20px; min-width: 40px; text-align: center; font-variant-numeric: tabular-nums; }
  .sep { width: 1px; height: 22px; background: var(--sg-border, #e2e8f0); margin: 0 6px; }
</style>
