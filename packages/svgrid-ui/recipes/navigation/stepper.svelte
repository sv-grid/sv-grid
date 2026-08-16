<script lang="ts">
  // SvStepper - a progress stepper for wizards and multi-step forms. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-stepper
  import { SvStepper } from '@svgrid/grid'

  let current = $state(0)
  const steps = [
    { label: 'Cart' },
    { label: 'Shipping', description: 'Where to send it' },
    { label: 'Payment', optional: true },
  ]
</script>

<SvStepper {steps} {current} onChange={(n) => (current = n)} />
