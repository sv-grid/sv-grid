<script lang="ts">
  // SvButton - the themeable press primitive with variants and loading. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-button
  import { SvButton } from '@svgrid/grid'

  let saving = $state(false)
  async function save() {
    saving = true
    try {
      await new Promise((r) => setTimeout(r, 800))
    } finally {
      saving = false
    }
  }
</script>

<SvButton variant="primary" loading={saving} onclick={save}>Save</SvButton>
<SvButton variant="outline">Cancel</SvButton>
