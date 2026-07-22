<script lang="ts">
  /**
   * SvNavPane - an Outlook-style navigation pane: collapsible sections, items with
   * icons and unread badges, nested folders, single-select highlight and an
   * icon-only collapsed rail. The app-shell sidebar primitive.
   */
  import { SvNavPane, SvSwitchButton } from '@svgrid/grid'
  import type { NavSection, NavModule } from '@svgrid/grid'

  let selected = $state('inbox')
  let collapsed = $state(false)
  let activeModule = $state('mail')
  let moduleRows = $state(2)

  const sections: NavSection[] = [
    {
      id: 'fav',
      label: 'Favorites',
      items: [
        { id: 'inbox', label: 'Inbox', icon: inboxIcon, badge: 12 },
        { id: 'sent', label: 'Sent', icon: sentIcon },
        { id: 'drafts', label: 'Drafts', icon: draftIcon, badge: 3 },
      ],
    },
    {
      id: 'folders',
      label: 'Folders',
      items: [
        { id: 'inbox2', label: 'Inbox', icon: inboxIcon, badge: 12, children: [
          { id: 'team', label: 'Team', badge: 4 },
          { id: 'clients', label: 'Clients' },
          { id: 'receipts', label: 'Receipts', badge: 1 },
        ] },
        { id: 'archive', label: 'Archive', icon: archiveIcon },
        { id: 'spam', label: 'Junk', icon: spamIcon, badge: 47 },
        { id: 'trash', label: 'Deleted', icon: trashIcon },
      ],
    },
  ]
</script>

{#snippet calIcon()}<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>{/snippet}
{#snippet peopleIcon()}<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></svg>{/snippet}
{#snippet tasksIcon()}<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></svg>{/snippet}
{#snippet notesIcon()}<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h4" /></svg>{/snippet}
{#snippet inboxIcon()}<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z" /></svg>{/snippet}
{#snippet sentIcon()}<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>{/snippet}
{#snippet draftIcon()}<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>{/snippet}
{#snippet archiveIcon()}<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="5" rx="1" /><path d="M4 8v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8M10 12h4" /></svg>{/snippet}
{#snippet spamIcon()}<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" /></svg>{/snippet}
{#snippet trashIcon()}<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>{/snippet}

<div class="wrap">
  <header>
    <h2>Navigation pane</h2>
    <p>An Outlook-style sidebar: collapsible sections, unread badges, nested folders, single selection, and an icon-only rail. Arrow keys move between items.</p>
    <label class="toggle">Collapse to rail <SvSwitchButton checked={collapsed} onChange={(v) => (collapsed = v)} /></label>
  </header>

  <div class="stage">
    <SvNavPane
      {sections}
      value={selected}
      {collapsed}
      height={420}
      modules={[
        { id: 'mail', label: 'Mail', icon: inboxIcon },
        { id: 'calendar', label: 'Calendar', icon: calIcon },
        { id: 'people', label: 'People', icon: peopleIcon },
        { id: 'tasks', label: 'Tasks', icon: tasksIcon, badge: 5 },
        { id: 'notes', label: 'Notes', icon: notesIcon },
      ]}
      moduleValue={activeModule}
      bind:moduleRows
      onSelect={(id) => (selected = id)}
      onModuleSelect={(id) => (activeModule = id)}
    />
    <div class="content">
      <h3>{selected}</h3>
      <p>Module: <strong>{activeModule}</strong>. Drag the grip above the module buttons <strong>up</strong> to collapse them into an icon rail (like Outlook), <strong>down</strong> to expand. Showing {moduleRows} full rows.</p>
    </div>
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 720px; display: flex; flex-direction: column; gap: 14px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .toggle { display: inline-flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 13px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .stage { display: flex; gap: 18px; align-items: flex-start; }
  .content { flex: 1; padding: 16px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; min-height: 200px; }
  .content h3 { margin: 0 0 8px; font-size: 16px; text-transform: capitalize; }
  .content p { margin: 0; font-size: 13.5px; color: var(--sg-muted, #64748b); line-height: 1.6; }
</style>
