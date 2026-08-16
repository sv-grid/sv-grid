<script lang="ts">
  // SvComboBox - searchable single-select combobox. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-combo-box
  import { SvComboBox, type ListOption } from '@svgrid/grid'

  const options: ListOption[] = [
    { value: 'us', label: 'United States' },
    { value: 'gb', label: 'United Kingdom' },
    { value: 'de', label: 'Germany' },
  ]
  let value = $state<string | number | null>(null)
</script>

<SvComboBox label="Country" {options} {value} onChange={(v) => (value = v)} required />
