<script lang="ts">
  // SvOtpInput - segmented one-time-code / PIN entry that auto-advances. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-otp-input
  import { SvOtpInput } from '@svgrid/grid'

  let code = $state('')
</script>

<SvOtpInput
  label="Verification code"
  length={6}
  bind:value={code}
  onComplete={(v) => console.log('verify', v)}
/>
