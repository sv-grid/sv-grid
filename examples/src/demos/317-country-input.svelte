<script lang="ts">
  /**
   * SvCountryInput - a production checkout field: a searchable country picker
   * (flag + name + optional dial code) emitting the ISO code. Copy-paste ready.
   */
  import { SvCountryInput } from '@svgrid/grid'

  let country = $state<string | null>('US')
  let billing = $state<string | null>(null)
  const billingError = $derived(billing == null ? 'Select a billing country' : undefined)
</script>

<div class="wrap">
  <header>
    <h2>Country input</h2>
    <p>A searchable country picker (search by name, dial code or ISO) emitting the alpha-2 code - checkout, profiles, phone defaults.</p>
  </header>

  <form class="form" onsubmit={(e) => e.preventDefault()}>
    <label class="f">Shipping country
      <SvCountryInput value={country} showDial onChange={(v) => (country = v)} />
      <span class="val">ISO: {country ?? '-'}</span>
    </label>

    <SvCountryInput
      value={billing}
      label="Billing country"
      required
      invalid={!!billingError}
      error={billingError}
      onChange={(v) => (billing = v)}
    />
  </form>
</div>

<style>
  .wrap { padding: 20px; max-width: 380px; display: flex; flex-direction: column; gap: 16px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  .form { display: flex; flex-direction: column; gap: 18px; }
  .f { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .val { font-size: 12px; color: var(--sg-muted, #94a3b8); font-weight: 400; }
</style>
