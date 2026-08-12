<script lang="ts">
  /**
   * SvListBox / SvDropDownList virtualization - huge option sets rendered
   * smoothly by windowing (only the visible rows exist in the DOM), now over the
   * shared virtualizer: rows are RECYCLED on scroll (no mount/unmount churn),
   * GROUPED lists window too (headings included), and `rowHeight` can be a
   * function for variable-height rows. The public API is unchanged; add
   * `virtual`.
   */
  import { SvListBox, SvDropDownList } from '@svgrid/grid'
  import type { ListOption } from '@svgrid/grid'

  const N = 50000
  const options: ListOption[] = Array.from({ length: N }, (_, i) => ({
    value: i,
    label: `Item ${(i + 1).toLocaleString()}`,
  }))

  // A grouped dataset: 8,000 people bucketed by role. Grouped lists are now
  // windowed too - previously enabling `virtual` fell back to rendering every
  // node, so a list this size mounted 8,000 rows.
  const roles = ['Engineering', 'Design', 'Product', 'Analytics', 'Support']
  const people: ListOption[] = Array.from({ length: 8000 }, (_, i) => ({
    value: `u${i}`,
    label: `User ${i + 1}`,
    group: roles[i % roles.length],
  }))
  const initials = (v: string | number) => `U${(Number(String(v).replace('u', '')) % 99) + 1}`

  // Variable-height rows: `rowHeight` as a function. Every 4th row is taller.
  const mixed: ListOption[] = Array.from({ length: 3000 }, (_, i) => ({
    value: i,
    label: i % 4 === 0 ? `Row ${i + 1}  -  tall (56px)` : `Row ${i + 1}  -  compact (30px)`,
  }))
  const mixedHeight = (_opt: ListOption, i: number) => (i % 4 === 0 ? 56 : 30)

  let picked = $state<string | number | null>(42)
  let member = $state<string | number | null>('u3')
  let tall = $state<string | number | null>(0)
  let ddlValue = $state<string | number | null>(1234)
</script>

<div class="wrap">
  <header>
    <h2>Virtualized list</h2>
    <p>Selects backed by up to <strong>{N.toLocaleString()}</strong> options. Only the visible rows are in the DOM and they are <strong>recycled</strong> as you scroll - grouped lists and variable-height rows window too. Just add <code>virtual</code>.</p>
  </header>

  <div class="cols">
    <div class="cell">
      <span class="ttl">{N.toLocaleString()} items · recycled</span>
      <SvListBox {options} value={picked} rows={9} virtual onChange={(v) => (picked = v)} />
      <span class="val">Selected: {picked}</span>
    </div>

    <div class="cell">
      <span class="ttl">Grouped + templated</span>
      <SvListBox options={people} value={member} rows={9} virtual rowHeight={44} groupHeaderHeight={26} onChange={(v) => (member = v)}>
        {#snippet itemTemplate(opt)}
          <span class="av">{initials(opt.value)}</span>
          <span class="who"><strong>{opt.label}</strong><em>{opt.group}</em></span>
        {/snippet}
      </SvListBox>
      <span class="val">8,000 people, windowed by group</span>
    </div>

    <div class="cell">
      <span class="ttl">Variable row heights</span>
      <SvListBox options={mixed} value={tall} rows={7} virtual rowHeight={mixedHeight} onChange={(v) => (tall = v)} />
      <span class="val"><code>rowHeight</code> is a function</span>
    </div>

    <div class="cell">
      <span class="ttl">Virtualized dropdown</span>
      <SvDropDownList {options} value={ddlValue} virtual onChange={(v) => (ddlValue = v)} />
      <span class="val">The dropdown panel windows the {N.toLocaleString()} options too.</span>
    </div>
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 900px; display: flex; flex-direction: column; gap: 18px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; max-width: 70ch; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .cols { display: flex; gap: 28px; flex-wrap: wrap; align-items: start; }
  .cell { display: flex; flex-direction: column; gap: 8px; }
  .ttl { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .val { font-size: 12px; color: var(--sg-muted, #94a3b8); }
  .av { width: 28px; height: 28px; flex: none; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 700; background: color-mix(in srgb, var(--sg-accent, #2563eb) 16%, transparent); color: var(--sg-accent, #2563eb); }
  .who { display: flex; flex-direction: column; line-height: 1.25; overflow: hidden; }
  .who strong { font-size: 13px; }
  .who em { font-size: 11px; font-style: normal; color: var(--sg-muted, #94a3b8); }
</style>
