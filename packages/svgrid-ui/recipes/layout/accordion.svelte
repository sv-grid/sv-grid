<script lang="ts">
  // SvAccordion - collapsible WAI-ARIA sections, single or multi expand. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-accordion
  import { SvAccordion, type AccordionItem } from '@svgrid/grid'

  const items: AccordionItem[] = [
    { id: 'ship', label: 'Shipping' },
    { id: 'pay', label: 'Payment' },
    { id: 'gift', label: 'Gift options' },
  ]
  let expanded = $state(['ship'])
</script>

<SvAccordion {items} {expanded} onChange={(ids) => (expanded = ids)}>
  {#snippet panel(item)}
    <p>Details for {item.label}.</p>
  {/snippet}
</SvAccordion>
