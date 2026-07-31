<script lang="ts">
  // SvMaskedInput - pattern-masked text that formats as you type. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-masked-input
  import { SvMaskedInput } from '@svgrid/grid'

  let card = $state('')
  let complete = $state(false)
</script>

<SvMaskedInput
  label="Card number"
  mask="#### #### #### ####"
  value={card}
  onChange={(masked, raw, done) => { card = masked; complete = done }}
/>
