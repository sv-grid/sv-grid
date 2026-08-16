<script lang="ts">
  // SvRepeatButton - a button that keeps firing while held. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-repeat-button
  import { SvRepeatButton } from '@svgrid/grid'

  let qty = $state(1)
</script>

<SvRepeatButton ariaLabel="Decrease" onclick={() => (qty = Math.max(0, qty - 1))}>-</SvRepeatButton>
<span>{qty}</span>
<SvRepeatButton ariaLabel="Increase" onclick={() => (qty += 1)}>+</SvRepeatButton>
