<script lang="ts">
  /**
   * Command palette & data bits: SvCommand (⌘K fuzzy palette on the shared
   * focus-trap / scroll-lock / dismissable primitives), SvSparkline (inline
   * charts), SvAvatarGroup (stacked members) and SvScrollArea (themed scrollbars).
   */
  import { SvCommand, SvSparkline, SvAvatarGroup, SvScrollArea, SvStat, SvButton, toast, SvToaster, type CommandItem } from '@svgrid/grid'

  let paletteOpen = $state(false)

  const commands: CommandItem[] = [
    { id: 'new-invoice', label: 'New invoice', group: 'Create', icon: '＋', shortcut: '⌘N', onRun: () => toast.success('New invoice') },
    { id: 'new-customer', label: 'New customer', group: 'Create', icon: '＋' },
    { id: 'export-csv', label: 'Export as CSV', group: 'Data', icon: '↧', shortcut: '⌘E', onRun: () => toast('Exporting CSV…') },
    { id: 'import', label: 'Import data', group: 'Data', icon: '↥' },
    { id: 'refresh', label: 'Refresh data', group: 'Data', icon: '↻' },
    { id: 'settings', label: 'Open settings', group: 'App', icon: '⚙', shortcut: '⌘,' },
    { id: 'theme', label: 'Toggle dark mode', group: 'App', icon: '◐', onRun: () => toast('Theme toggled') },
    { id: 'help', label: 'Keyboard shortcuts', group: 'App', icon: '?', shortcut: '?' },
    { id: 'logout', label: 'Sign out', group: 'App', icon: '⎋' },
  ]

  const team = [
    { name: 'Ada Lovelace' }, { name: 'Alan Turing' }, { name: 'Grace Hopper' },
    { name: 'Katherine Johnson' }, { name: 'Edsger Dijkstra' }, { name: 'Barbara Liskov' },
  ]

  const activity = Array.from({ length: 14 }, (_, i) => ({
    who: team[i % team.length]!.name,
    what: ['created an invoice', 'exported a report', 'edited a customer', 'closed a ticket'][i % 4],
    when: `${i + 1}h ago`,
  }))
</script>

<div class="wrap">
  <header>
    <h2>Command palette &amp; data</h2>
    <p>Press <kbd>⌘K</kbd> / <kbd>Ctrl K</kbd> (or the button) for the fuzzy command palette. Below: inline sparklines, a stacked avatar group, and a themed scroll area.</p>
  </header>

  <div class="bar">
    <SvButton onclick={() => (paletteOpen = true)}>⌘K&nbsp; Command palette</SvButton>
    <span class="who">Team</span>
    <SvAvatarGroup avatars={team} max={4} size="sm" />
  </div>

  <div class="stats">
    <SvStat label="Revenue" value="$48.2k" delta={12.4} hint="30d">{#snippet chart()}<SvSparkline data={[8, 11, 9, 14, 12, 16, 15, 19]} type="area" />{/snippet}</SvStat>
    <SvStat label="Signups" value="1,204" delta={6.1} hint="30d">{#snippet chart()}<SvSparkline data={[20, 24, 22, 28, 26, 30, 34]} />{/snippet}</SvStat>
    <SvStat label="Refunds" value="12" delta={-8} invert hint="30d">{#snippet chart()}<SvSparkline data={[6, 4, 5, 3, 4, 2, 1]} color="#dc2626" />{/snippet}</SvStat>
    <SvStat label="Net flow" value="+$7.4k" hint="this week">{#snippet chart()}<SvSparkline data={[2, -1, 3, -2, 4, 5, -1, 6]} type="winloss" />{/snippet}</SvStat>
  </div>

  <div class="feed">
    <div class="feed__head">Activity</div>
    <SvScrollArea maxHeight="220px">
      <ul class="feed__list">
        {#each activity as a, i (i)}
          <li class="feed__item"><strong>{a.who}</strong> {a.what} <span class="feed__when">{a.when}</span></li>
        {/each}
      </ul>
    </SvScrollArea>
  </div>
</div>

<SvCommand bind:open={paletteOpen} {commands} onRun={(c) => console.log('run', c.id)} />
<SvToaster position="bottom-right" />

<style>
  .wrap { padding: 20px; max-width: 880px; display: flex; flex-direction: column; gap: 18px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; }
  kbd { font: inherit; font-size: 11px; padding: 1px 6px; border-radius: 5px; border: 1px solid var(--sg-border, #cbd5e1); background: var(--sg-row-hover-bg, #f1f5f9); }
  .bar { display: flex; align-items: center; gap: 12px; }
  .who { margin-inline-start: auto; font-size: 12px; color: var(--sg-muted, #64748b); }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
  .feed { border: 1px solid var(--sg-border, #e2e8f0); border-radius: 12px; overflow: hidden; background: var(--sg-bg, #fff); }
  .feed__head { padding: 10px 14px; border-bottom: 1px solid var(--sg-border, #e2e8f0); font-size: 12px; font-weight: 650; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .feed__list { list-style: none; margin: 0; padding: 4px; }
  .feed__item { padding: 8px 10px; border-radius: 8px; font-size: 13px; }
  .feed__item:hover { background: var(--sg-row-hover-bg, #f7f9fc); }
  .feed__when { color: var(--sg-muted, #94a3b8); font-size: 11.5px; margin-inline-start: 4px; }
</style>
