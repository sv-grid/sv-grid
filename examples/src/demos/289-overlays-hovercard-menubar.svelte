<script lang="ts">
  /**
   * SvHoverCard, SvPopconfirm and SvMenubar - three overlays built on the shared
   * positioning engine. HoverCard previews on hover, Popconfirm asks a quick
   * confirm in a popover, and Menubar is an app-style row of dropdown menus with
   * full keyboard support. All portal to <body>, flip/shift to stay in view.
   */
  import { SvHoverCard, SvPopconfirm, SvMenubar, SvButton, SvAvatar, toast, type MenuItem, type MenubarMenu } from '@svgrid/grid'

  let rows = $state(['Invoice #1043', 'Invoice #1044', 'Invoice #1045'])
  function remove(r: string) { rows = rows.filter((x) => x !== r); toast.success(`Deleted ${r}`) }

  const menus: MenubarMenu[] = [
    {
      label: 'File',
      items: [
        { label: 'New', shortcut: 'Ctrl+N', onSelect: () => toast('New') },
        { label: 'Open...', shortcut: 'Ctrl+O', onSelect: () => toast('Open') },
        { separator: true },
        { label: 'Export', children: [
          { label: 'CSV', onSelect: () => toast('Export CSV') },
          { label: 'PDF', onSelect: () => toast('Export PDF') },
        ] },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', onSelect: () => toast('Undo') },
        { label: 'Redo', shortcut: 'Ctrl+Y', onSelect: () => toast('Redo') },
        { separator: true },
        { label: 'Find...', shortcut: 'Ctrl+F', onSelect: () => toast('Find') },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Zoom in', onSelect: () => toast('Zoom in') },
        { label: 'Zoom out', onSelect: () => toast('Zoom out') },
        { label: 'Reset', onSelect: () => toast('Reset zoom') },
      ],
    },
    { label: 'Help', items: [{ label: 'Docs', onSelect: () => toast('Docs') }, { label: 'About', onSelect: () => toast('About') }] },
  ]

  const onMenu = (i: MenuItem) => {}
</script>

<div class="wrap">
  <section>
    <h3>Menubar</h3>
    <p>An app menu bar. Click or press ArrowDown to open; ArrowLeft/Right switch menus; Escape closes.</p>
    <SvMenubar {menus} onSelect={onMenu} ariaLabel="Demo menu bar" />
  </section>

  <section>
    <h3>Hover card</h3>
    <p>Rest the pointer on the chip to preview - the card is hoverable too.</p>
    <div class="line">
      Assigned to
      <SvHoverCard>
        {#snippet anchor()}<button class="chip">@ada</button>{/snippet}
        <div class="card">
          <SvAvatar name="Ada Lovelace" />
          <div>
            <strong>Ada Lovelace</strong>
            <div class="muted">Analyst - first programmer</div>
            <div class="muted">12 open tasks - 3 reviews</div>
          </div>
        </div>
      </SvHoverCard>
    </div>
  </section>

  <section>
    <h3>Popconfirm</h3>
    <p>A quick confirm in a popover for low-stakes destructive actions.</p>
    <ul class="rows">
      {#each rows as r (r)}
        <li>
          <span>{r}</span>
          <SvPopconfirm
            title="Delete this invoice?"
            description="This cannot be undone."
            confirmLabel="Delete"
            confirmVariant="danger"
            onConfirm={() => remove(r)}
          >
            {#snippet anchor()}<SvButton size="sm" variant="ghost">Delete</SvButton>{/snippet}
          </SvPopconfirm>
        </li>
      {/each}
      {#if rows.length === 0}<li class="muted">All cleared.</li>{/if}
    </ul>
  </section>
</div>

<style>
  .wrap { padding: 22px; display: flex; flex-direction: column; gap: 26px; max-width: 560px; }
  section h3 { margin: 0 0 3px; font-size: 15px; font-weight: 700; }
  section p { margin: 0 0 12px; color: var(--sg-muted, #64748b); font-size: 13px; line-height: 1.5; }
  .line { display: flex; align-items: center; gap: 8px; font-size: 14px; }
  .chip { font: inherit; font-size: 13px; font-weight: 600; color: var(--sg-accent, #4f46e5); background: color-mix(in srgb, var(--sg-accent, #4f46e5) 12%, transparent); border: 0; border-radius: 999px; padding: 3px 10px; cursor: pointer; }
  .card { display: flex; gap: 12px; align-items: center; }
  .card strong { font-size: 14px; }
  .muted { color: var(--sg-muted, #64748b); font-size: 12.5px; }
  .rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .rows li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; border: 1px solid var(--sg-border, #e5e7eb); border-radius: 8px; font-size: 13.5px; }
</style>
