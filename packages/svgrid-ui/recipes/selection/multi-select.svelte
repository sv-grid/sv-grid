<script lang="ts">
  // SvMultiSelect - multi-select dropdown with a chip trigger. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-multi-select
  import { SvMultiSelect, type MultiSelectOption } from '@svgrid/grid'

  const options: MultiSelectOption[] = [
    { value: 'ts', label: 'TypeScript' },
    { value: 'svelte', label: 'Svelte' },
    { value: 'rust', label: 'Rust' },
  ]
  let value = $state<Array<string | number>>([])
</script>

<SvMultiSelect label="Skills" {options} bind:value maxTagCount={2} />
