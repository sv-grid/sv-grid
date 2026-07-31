<script lang="ts">
  // SvField - shared label / hint / error chrome for any control. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-field
  import { SvField } from '@svgrid/grid'

  let role = $state('')
  const err = $derived(role ? undefined : 'Pick a role')
</script>

<SvField id="role" label="Role" hint="Sets the default permissions" error={err} required block>
  <select id="role" bind:value={role}>
    <option value="">Choose...</option>
    <option value="admin">Admin</option>
    <option value="member">Member</option>
  </select>
</SvField>
