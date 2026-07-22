<script lang="ts">
  /**
   * The Tier-1 input editors: SvTextInput, SvTextArea, SvOtpInput,
   * SvDurationInput and SvMultiSelect. Each is a standalone control on the shared
   * editor contract (label / hint / error / a11y) that also works as a SvGrid
   * cell editor via the interaction contract.
   */
  import {
    SvTextInput, SvTextArea, SvOtpInput, SvDurationInput, SvMultiSelect,
    type MultiSelectOption,
  } from '@svgrid/grid'

  let name = $state('Ada Lovelace')
  let email = $state('')
  let bio = $state('')
  let code = $state('')
  let minutes = $state<number | null>(90)
  let tags = $state<Array<string | number>>(['svelte', 'grid'])

  const tagOptions: MultiSelectOption[] = [
    { value: 'svelte', label: 'Svelte' },
    { value: 'grid', label: 'Data grid' },
    { value: 'ts', label: 'TypeScript' },
    { value: 'a11y', label: 'Accessibility' },
    { value: 'charts', label: 'Charts' },
    { value: 'forms', label: 'Forms' },
  ]
</script>

<div class="wrap">
  <header>
    <h2>Input editors</h2>
    <p>Standalone controls that double as grid cell editors: Enter commits, Escape cancels, all themed from the grid's <code>--sg-*</code> tokens.</p>
  </header>

  <section>
    <h3>Text &amp; textarea</h3>
    <div class="row">
      <SvTextInput label="Name" value={name} onChange={(v) => (name = v)} clearable />
      <SvTextInput label="Email" type="email" value={email} onChange={(v) => (email = v)} placeholder="you@example.com" />
    </div>
    <SvTextArea label="Bio" value={bio} onChange={(v) => (bio = v)} rows={3} maxlength={140} showCount autoGrow placeholder="A short bio…" />
  </section>

  <section>
    <h3>OTP &amp; duration</h3>
    <div class="row">
      <div>
        <div class="lbl">Verification code</div>
        <SvOtpInput length={6} value={code} onChange={(v) => (code = v)} onComplete={(v) => console.log('code', v)} />
      </div>
      <SvDurationInput label="Estimate" value={minutes} onChange={(m) => (minutes = m)} style="units" />
    </div>
  </section>

  <section>
    <h3>Multi-select</h3>
    <SvMultiSelect label="Topics" options={tagOptions} value={tags} onChange={(v) => (tags = v)} maxTagCount={3} />
    <p class="muted">Selected: {tags.join(', ') || '(none)'}</p>
  </section>
</div>

<style>
  .wrap { padding: 20px; max-width: 820px; display: flex; flex-direction: column; gap: 22px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  header code { background: var(--sg-row-hover-bg, #f1f5f9); padding: 1px 5px; border-radius: 4px; font-size: 12px; }
  section h3 { margin: 0 0 12px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .row { display: flex; gap: 18px; flex-wrap: wrap; align-items: flex-start; margin-bottom: 12px; }
  .lbl { font-size: 12.5px; font-weight: 600; color: var(--sg-fg, #0f172a); margin-bottom: 5px; }
  .muted { color: var(--sg-muted, #94a3b8); font-size: 12.5px; margin: 10px 0 0; }
</style>
