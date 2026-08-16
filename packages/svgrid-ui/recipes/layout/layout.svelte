<script lang="ts">
  // Layout primitives - SvStack (column), SvGroup (row), SvSimpleGrid (responsive grid).
  // Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-layout-primitives
  import { SvStack, SvGroup, SvSimpleGrid, SvCard } from '@svgrid/grid'
</script>

<SvStack gap={16}>
  <SvGroup gap={8} justify="between">
    <strong>Team</strong>
    <button>Invite</button>
  </SvGroup>

  <SvSimpleGrid minChildWidth={180} gap={12}>
    <SvCard>One</SvCard>
    <SvCard>Two</SvCard>
    <SvCard>Three</SvCard>
  </SvSimpleGrid>
</SvStack>
