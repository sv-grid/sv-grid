<script lang="ts">
  // SvCommand - a Cmd+K fuzzy command palette. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-command
  import { SvCommand, type CommandItem } from '@svgrid/grid'

  const commands: CommandItem[] = [
    { id: 'new', label: 'New record', group: 'Actions', shortcut: '⌘N', onRun: () => console.log('new') },
    { id: 'export', label: 'Export CSV', group: 'Actions', onRun: () => console.log('export') },
  ]
</script>

<!-- Cmd/Ctrl+K opens it -->
<SvCommand {commands} onRun={(c) => console.log(c.id)} />
