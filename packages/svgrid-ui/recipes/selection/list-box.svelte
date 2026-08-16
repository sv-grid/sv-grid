<script lang="ts">
  // SvListBox - inline single/multi-select list picker. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-list-box
  import { SvListBox, type ListOption } from '@svgrid/grid'

  const options: ListOption[] = [
    { value: 'eng', label: 'Engineering', group: 'Product' },
    { value: 'des', label: 'Design', group: 'Product' },
    { value: 'sal', label: 'Sales', group: 'Go-to-market' },
  ]
  let value = $state<string | null>(null)
</script>

<SvListBox label="Team" {options} {value} onChange={(v) => (value = v)} />
