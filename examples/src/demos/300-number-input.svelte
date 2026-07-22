<script lang="ts">
  /**
   * SvNumberInput on its own - min/max/step, thousands grouping, precision,
   * prefix/suffix, spinner buttons, plus the shared field contract (label, hint,
   * required/error validation). The SvGrid number cell editor, standalone.
   */
  import { SvNumberInput } from '@svgrid/grid'

  let qty = $state<number | null>(3)
  let price = $state<number | null>(1299.5)
  let pct = $state<number | null>(20)
  let budget = $state<number | null>(null)
  const budgetError = $derived(budget == null ? 'Enter a budget' : budget < 100 ? 'Minimum is 100' : undefined)
</script>

<div class="wrap">
  <header>
    <h2>Number input</h2>
    <p><code>SvNumberInput</code> - typed numeric entry with clamping, grouping, precision and spinners. Emits <code>number | null</code>.</p>
  </header>

  <div class="grid">
    <label class="cell">Quantity (0-99, step 1)
      <SvNumberInput value={qty} min={0} max={99} step={1} onChange={(v) => (qty = v)} />
      <span class="val">{qty}</span>
    </label>

    <label class="cell">Price (grouped, 2dp, prefix)
      <SvNumberInput value={price} min={0} precision={2} grouping prefix="$" step={0.5} onChange={(v) => (price = v)} />
      <span class="val">{price}</span>
    </label>

    <label class="cell">Percent (suffix, no spinners)
      <SvNumberInput value={pct} min={0} max={100} suffix="%" spinButtons={false} onChange={(v) => (pct = v)} />
      <span class="val">{pct}</span>
    </label>

    <div class="cell">
      <SvNumberInput
        value={budget}
        label="Monthly budget"
        hint="At least 100 - clearable"
        prefix="$"
        grouping
        clearable
        required
        invalid={!!budgetError}
        error={budgetError}
        onChange={(v) => (budget = v)}
      />
    </div>
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 720px; display: flex; flex-direction: column; gap: 18px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; align-items: start; }
  .cell { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .val { font-size: 12px; color: var(--sg-muted, #94a3b8); font-weight: 400; }
</style>
