<script lang="ts">
  // SvNavPane - an Outlook-style app-shell navigation sidebar. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-nav-pane
  import { SvNavPane, type NavSection } from '@svgrid/grid'

  let value = $state<string | null>('inbox')
  const sections: NavSection[] = [
    { id: 'mail', label: 'Mail', items: [
      { id: 'inbox', label: 'Inbox', badge: 12 },
      { id: 'sent', label: 'Sent' },
    ] },
  ]
</script>

<SvNavPane {sections} bind:value onSelect={(id) => console.log(id)} />
