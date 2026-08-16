<script lang="ts">
  // SvRadioGroup - an accessible single-select radio group. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-radio-group
  import { SvRadioGroup, type RadioOption } from '@svgrid/grid'

  const plans: RadioOption[] = [
    { value: 'free', label: 'Free' },
    { value: 'pro', label: 'Pro' },
    { value: 'team', label: 'Team' },
  ]
  let plan = $state<string | number | null>('pro')
</script>

<SvRadioGroup
  label="Plan"
  options={plans}
  value={plan}
  onChange={(v) => (plan = v)}
/>
