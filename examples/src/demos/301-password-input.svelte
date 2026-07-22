<script lang="ts">
  /**
   * SvPasswordInput on its own - a reveal toggle and an optional 4-level strength
   * meter, plus the shared field contract (label / hint / validation) and
   * localizable strings. The SvGrid password cell editor, standalone.
   */
  import { SvPasswordInput } from '@svgrid/grid'

  let pw = $state('')
  let confirm = $state('')
  const mismatch = $derived(confirm && confirm !== pw ? 'Passwords do not match' : undefined)
</script>

<div class="wrap">
  <header>
    <h2>Password input</h2>
    <p><code>SvPasswordInput</code> - reveal toggle + strength heuristic. Every string (Show/Hide, Weak..Strong) is overridable via <code>messages</code>.</p>
  </header>

  <div class="col">
    <SvPasswordInput
      value={pw}
      label="New password"
      hint="8+ chars with a mix of cases, digits and symbols"
      showStrength
      autocomplete="new-password"
      onChange={(v) => (pw = v)}
    />
    <SvPasswordInput
      value={confirm}
      label="Confirm password"
      required
      invalid={!!mismatch}
      error={mismatch}
      autocomplete="new-password"
      onChange={(v) => (confirm = v)}
    />
    <SvPasswordInput
      value="hunter2"
      label="French labels"
      showStrength
      messages={{ show: 'Afficher', hide: 'Masquer', weak: 'Faible', fair: 'Moyen', good: 'Bon', strong: 'Fort' }}
    />
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 520px; display: flex; flex-direction: column; gap: 18px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .col { display: flex; flex-direction: column; gap: 18px; align-items: flex-start; }
</style>
