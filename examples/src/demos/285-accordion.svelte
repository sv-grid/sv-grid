<script lang="ts">
  /**
   * SvAccordion - collapsible sections with single- or multiple-expand, roving
   * header focus (Up/Down/Home/End) and full WAI-ARIA. The panel body is a
   * snippet that receives the item. RTL mirrors the chevron + layout.
   */
  import { SvAccordion } from '@svgrid/grid'
  import type { AccordionItem } from '@svgrid/grid'

  const faq: AccordionItem[] = [
    { id: 'ship', label: 'How does shipping work?' },
    { id: 'returns', label: 'What is your return policy?' },
    { id: 'warranty', label: 'Is there a warranty?' },
  ]
  const bodies: Record<string, string> = {
    ship: 'Orders ship within 2 business days. Tracking is emailed the moment your parcel leaves the warehouse.',
    returns: 'Return anything within 30 days for a full refund - no questions asked. We even cover the return label.',
    warranty: 'Every product carries a 2-year limited warranty against manufacturing defects.',
  }

  let single = $state<string[]>(['ship'])
  let multi = $state<string[]>(['ship', 'warranty'])
  let rtl = $state(false)
</script>

<div class="wrap">
  <header>
    <h2>Accordion</h2>
    <p>Collapsible sections. <code>expandMode="single"</code> keeps one panel open (FAQ style); <code>"multiple"</code> lets several stay open. Arrow keys move between headers.</p>
    <label class="rtl-toggle"><input type="checkbox" bind:checked={rtl} /> Right-to-left</label>
  </header>

  <div class="cols">
    <section>
      <h3>Single (FAQ)</h3>
      <SvAccordion items={faq} expanded={single} expandMode="single" dir={rtl ? 'rtl' : undefined} onChange={(ids) => (single = ids)}>
        {#snippet panel(item)}
          <p>{bodies[item.id]}</p>
        {/snippet}
      </SvAccordion>
    </section>

    <section>
      <h3>Multiple</h3>
      <SvAccordion items={faq} expanded={multi} expandMode="multiple" dir={rtl ? 'rtl' : undefined} onChange={(ids) => (multi = ids)}>
        {#snippet panel(item)}
          <p>{bodies[item.id]}</p>
        {/snippet}
      </SvAccordion>
      <p class="out">Open: <strong>{multi.length ? multi.join(', ') : 'none'}</strong></p>
    </section>
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 860px; display: flex; flex-direction: column; gap: 18px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; max-width: 640px; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .rtl-toggle { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; font-size: 13px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; align-items: start; }
  section h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  section :global(.sv-acc__body p) { margin: 0; }
  .out { margin: 12px 0 0; font-size: 13px; color: var(--sg-muted, #64748b); }
</style>
