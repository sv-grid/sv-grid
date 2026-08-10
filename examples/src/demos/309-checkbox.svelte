<script lang="ts">
  /**
   * SvCheckBox - a production permissions block with a tri-state "select all"
   * parent (indeterminate when partial) plus a required terms checkbox with
   * validation. Copy-paste ready.
   */
  import { SvCheckBox } from '@svgrid/grid'

  const perms = ['Read', 'Write', 'Delete', 'Invite members']
  let checked = $state<boolean[]>([true, true, false, false])
  const allOn = $derived(checked.every(Boolean))
  const someOn = $derived(checked.some(Boolean) && !allOn)
  function toggleAll(v: boolean) { checked = checked.map(() => v) }

  let agree = $state(false)
  let submitted = $state(false)
  const agreeError = $derived(submitted && !agree ? 'You must accept the terms' : undefined)
</script>

<div class="wrap">
  <header>
    <h2>Checkbox</h2>
    <p>Tri-state (checked / unchecked / indeterminate) - a "select all" parent plus a validated terms box.</p>
  </header>

  <section class="block">
    <h3>Role permissions</h3>
    <div class="parent">
      <SvCheckBox checked={allOn} indeterminate={someOn} onChange={toggleAll}>All permissions</SvCheckBox>
    </div>
    <div class="children">
      {#each perms as p, i (p)}
        <SvCheckBox checked={checked[i]} onChange={(v) => (checked[i] = v)}>{p}</SvCheckBox>
      {/each}
    </div>
  </section>

  <section class="block">
    <h3>Terms</h3>
    <SvCheckBox checked={agree} required invalid={!!agreeError} error={agreeError} onChange={(v) => (agree = v)}>
      I agree to the terms of service
    </SvCheckBox>
    <div class="submit"><button class="btn" onclick={() => (submitted = true)}>Submit</button></div>
  </section>
</div>

<style>
  .wrap { padding: 20px; max-width: 460px; display: flex; flex-direction: column; gap: 22px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  .block h3 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .parent { padding-bottom: 8px; border-bottom: 1px solid var(--sg-border, #e2e8f0); font-weight: 600; }
  .children { display: flex; flex-direction: column; gap: 8px; padding: 10px 0 0 18px; }
  .submit { margin-top: 12px; }
  .btn { font: inherit; font-size: 13px; font-weight: 600; padding: 7px 16px; border: 0; border-radius: 8px; background: var(--sg-accent, #2563eb); color: var(--sg-on-accent, #fff); cursor: pointer; }
</style>
