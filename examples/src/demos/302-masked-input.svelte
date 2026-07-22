<script lang="ts">
  /**
   * SvMaskedInput on its own - a pattern mask (# = digit, A = letter, * = alnum;
   * other chars are literals). Emits the masked display value and the raw value,
   * plus a `complete` flag. The SvGrid masked cell editor, standalone.
   */
  import { SvMaskedInput } from '@svgrid/grid'

  let card = $state('')
  let cardRaw = $state('')
  let phone = $state('')
  let date = $state('')
  let complete = $state(false)
</script>

<div class="wrap">
  <header>
    <h2>Masked input</h2>
    <p><code>SvMaskedInput</code> - fixed-pattern entry. <code>#</code> digit, <code>A</code> letter, <code>*</code> alphanumeric; everything else is a literal.</p>
  </header>

  <div class="grid">
    <label class="cell">Credit card (clearable, icon)
      <SvMaskedInput mask="#### #### #### ####" placeholder="0000 0000 0000 0000" clearable value={card} onChange={(m, r, c) => { card = m; cardRaw = r; complete = c }}>
        {#snippet prefixIcon()}<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>{/snippet}
      </SvMaskedInput>
      <span class="val">raw: {cardRaw || '-'} &middot; {complete ? 'complete' : 'incomplete'}</span>
    </label>

    <label class="cell">Phone (US)
      <SvMaskedInput mask="(###) ###-####" placeholder="(555) 123-4567" onChange={(m) => (phone = m)} />
      <span class="val">{phone || '-'}</span>
    </label>

    <label class="cell">Date
      <SvMaskedInput mask="##/##/####" placeholder="MM/DD/YYYY" onChange={(m) => (date = m)} />
      <span class="val">{date || '-'}</span>
    </label>

    <label class="cell">Licence plate (AA-###)
      <SvMaskedInput mask="AA-###" placeholder="AB-123" />
    </label>
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 720px; display: flex; flex-direction: column; gap: 18px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 20px; align-items: start; }
  .cell { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .val { font-size: 12px; color: var(--sg-muted, #94a3b8); font-weight: 400; font-variant-numeric: tabular-nums; }
</style>
