<script lang="ts">
  /**
   * Selection controls - the SvGrid UI kit's list & overlay pickers. All share
   * the portal engine so their popovers never clip, and theme from --sg-*.
   */
  import { SvListBox, SvDropDownList, SvComboBox, SvAutoComplete, SvTagsInput, SvCountryInput } from '@svgrid/grid'

  const fruit = [
    { value: 'apple', label: 'Apple' }, { value: 'banana', label: 'Banana' },
    { value: 'cherry', label: 'Cherry' }, { value: 'date', label: 'Date' },
    { value: 'elderberry', label: 'Elderberry' }, { value: 'fig', label: 'Fig', disabled: true },
    { value: 'grape', label: 'Grape' },
  ]
  const frameworks = ['Svelte', 'SvelteKit', 'React', 'Vue', 'Angular', 'Solid', 'Qwik', 'Astro']

  let picked = $state<string[]>(['apple'])
  let ddl = $state<string | null>('banana')
  let combo = $state<string | null>(null)
  let ac = $state('')
  let tags = $state<string[]>(['grid', 'svelte'])
  let country = $state<string | null>('US')
</script>

<div class="wrap">
  <header>
    <h2>Selection controls</h2>
    <p>List and overlay pickers from <code>@svgrid/grid</code>. Every popover portals out of the scroll container, and all are keyboard-accessible.</p>
  </header>

  <div class="grid">
    <div class="cell">
      <label>SvListBox <span class="muted">(inline, multi-select)</span></label>
      <SvListBox options={fruit} value={picked} multiple onChange={(v) => (picked = v)} rows={5} />
      <code class="out">{picked.join(', ') || '-'}</code>
    </div>

    <div class="col">
      <div class="cell">
        <label>SvDropDownList</label>
        <SvDropDownList options={fruit} value={ddl} onChange={(v) => (ddl = String(v))} />
      </div>
      <div class="cell">
        <label>SvComboBox <span class="muted">(type to filter)</span></label>
        <SvComboBox options={fruit} value={combo} onChange={(v) => (combo = v as string)} />
      </div>
      <div class="cell">
        <label>SvAutoComplete <span class="muted">(free text + suggestions)</span></label>
        <SvAutoComplete value={ac} suggestions={frameworks} onChange={(v) => (ac = v)} placeholder="Type a framework…" />
      </div>
      <div class="cell">
        <label>SvTagsInput</label>
        <SvTagsInput value={tags} onChange={(t) => (tags = t)} />
      </div>
      <div class="cell">
        <label>SvCountryInput <span class="muted">(searchable, flags)</span></label>
        <SvCountryInput value={country} showDial onChange={(v) => (country = v)} />
      </div>
    </div>
  </div>
</div>

<style>
  .wrap { padding: 22px; max-width: 820px; display: flex; flex-direction: column; gap: 18px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; max-width: 620px; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .grid { display: flex; gap: 40px; flex-wrap: wrap; align-items: flex-start; }
  .col { display: flex; flex-direction: column; gap: 16px; }
  .cell { display: flex; flex-direction: column; gap: 7px; align-items: flex-start; }
  label { font-size: 12.5px; font-weight: 600; }
  .muted { color: var(--sg-muted, #64748b); font-weight: 400; }
  .out { align-self: stretch; }
</style>
