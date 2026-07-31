<script lang="ts">
  // SvDropDownList - single-select dropdown with no typing. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-drop-down-list
  import { SvDropDownList, type ListOption } from '@svgrid/grid'

  const options: ListOption[] = [
    { value: 'open', label: 'Open' },
    { value: 'wip', label: 'In progress' },
    { value: 'done', label: 'Done' },
  ]
  let value = $state<string | number | null>(null)
</script>

<SvDropDownList label="Status" {options} {value} onChange={(v) => (value = v)} />
