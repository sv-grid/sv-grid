<script lang="ts">
  // SvTabs - WAI-ARIA tab strip with roving arrow-key nav. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-tabs
  import { SvTabs, type TabItem } from '@svgrid/grid'

  const tabs: TabItem[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'activity', label: 'Activity' },
    { id: 'settings', label: 'Settings' },
  ]
  let tab = $state('overview')
</script>

<SvTabs {tabs} value={tab} onChange={(id) => (tab = id)} variant="line">
  {#snippet panel(active)}
    <p>Content for the {active} tab.</p>
  {/snippet}
</SvTabs>
