<script lang="ts">
  // SvPhoneInput - country dial-code selector plus a national number field. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-phone-input
  import { SvPhoneInput } from '@svgrid/grid'

  let phone = $state('')
</script>

<SvPhoneInput label="Mobile" country="US" value={phone} onChange={(v) => (phone = v)} />
