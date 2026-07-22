<script lang="ts">
  /**
   * SvPhoneInput on its own - a country dial-code selector plus a national number
   * field, emitting an E.164-ish string. Carries the shared field contract
   * (label / validation / dir). The SvGrid phone cell editor, standalone.
   */
  import { SvPhoneInput } from '@svgrid/grid'

  let a = $state('')
  let b = $state('')
  let work = $state('')
  // Per-country length validation from the phone parts (valid/complete).
  let workValid = $state(true)
  const workError = $derived(work && !workValid ? 'Not a valid number for the selected country' : undefined)
</script>

<div class="wrap">
  <header>
    <h2>Phone input</h2>
    <p><code>SvPhoneInput</code> - pick a country (flag + dial code), type the national number; emits <code>+&lt;dial&gt;&lt;digits&gt;</code>.</p>
  </header>

  <div class="col">
    <label class="cell">Default (US)
      <SvPhoneInput value={a} onChange={(v) => (a = v)} />
      <span class="val">{a || '-'}</span>
    </label>

    <label class="cell">Default country GB
      <SvPhoneInput value={b} country="GB" onChange={(v) => (b = v)} />
      <span class="val">{b || '-'}</span>
    </label>

    <div class="cell">
      <SvPhoneInput
        value={work}
        label="Work phone"
        hint="Validated against the selected country"
        required
        invalid={!!workError}
        error={workError}
        onChange={(v, parts) => { work = v; workValid = parts.valid }}
      />
    </div>
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 560px; display: flex; flex-direction: column; gap: 18px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .col { display: flex; flex-direction: column; gap: 18px; align-items: flex-start; }
  .cell { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .val { font-size: 12px; color: var(--sg-muted, #94a3b8); font-weight: 400; font-variant-numeric: tabular-nums; }
</style>
