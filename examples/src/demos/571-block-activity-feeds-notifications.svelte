<script lang="ts" module>
  /**
   * Notification list block - an app bar bell (SvButton) with an unread count
   * that opens the notification panel in an SvPopover; on phones the same
   * panel renders inline under the bar. The panel has an All / Unread
   * SvSegmented, unread dots, SvAvatar per sender, click-to-read, Mark all as
   * read, a per-item archive with an Undo toast, and an SvEmptyState when
   * nothing is left. Pure UI-kit, --sg-* themed.
   *
   * Headless: createNotifications() below owns the list, the All / Unread view,
   * read state, archive with undo and the panel's open state with no markup.
   * The component under it is one styled render of that core; import
   * createNotifications from this file (or `npx @svgrid/ui add
   * activity-feeds-notifications --headless` for the core alone) to draw your
   * own.
   */
  export type Note = { id: number; from: string; text: string; target: string; at: number; read: boolean }
  export type NotificationsView = 'all' | 'unread'
  export type NotificationsOptions = {
    /** One clock for the whole list: every relative time is measured from here. */
    now?: number
    notes?: Note[]
    /** Start with the panel open. */
    open?: boolean
    /** Called after markAll(). */
    onMarkAll?: () => void
    /** Called after a note is archived; `undo()` puts it back where it was. */
    onArchive?: (note: Note, undo: () => void) => void
  }

  function sampleNotes(now: number): Note[] {
    const ago = (minutes: number) => now - minutes * 60_000
    return [
      { id: 1, from: 'Maya Chen', text: 'assigned you', target: 'Route 14, Oakland depot', at: ago(6), read: false },
      { id: 2, from: 'Dispatch bot', text: 'flagged a late pickup on', target: 'Order FL-20931', at: ago(38), read: false },
      { id: 3, from: 'Jonas Weber', text: 'mentioned you in', target: 'Cold-chain checklist', at: ago(140), read: false },
      { id: 4, from: 'Ruth Adeyemi', text: 'approved your expense for', target: 'Fuel, week 41', at: ago(60 * 20), read: true },
      { id: 5, from: 'Maya Chen', text: 'shared the report', target: 'September on-time rate', at: ago(60 * 50), read: true },
    ]
  }

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' })

  export function createNotifications(opts: NotificationsOptions = {}) {
    const now = opts.now ?? Date.now()
    let notes = $state<Note[]>(opts.notes ?? sampleNotes(now))
    let view = $state<string | number | null>('all')
    let open = $state(opts.open ?? false)

    const unread = $derived(notes.filter((n) => !n.read).length)
    const shown = $derived(view === 'unread' ? notes.filter((n) => !n.read) : notes)

    function relative(at: number) {
      const m = Math.round(Math.min(0, at - now) / 60_000)
      if (m > -60) return rtf.format(m, 'minute')
      if (m > -1440) return rtf.format(Math.round(m / 60), 'hour')
      return rtf.format(Math.round(m / 1440), 'day')
    }

    function markRead(n: Note) { n.read = true }
    function markAll() {
      notes.forEach((n) => (n.read = true))
      opts.onMarkAll?.()
    }
    function archive(n: Note) {
      const index = notes.indexOf(n)
      notes = notes.filter((x) => x !== n)
      opts.onArchive?.(n, () => { if (!notes.includes(n)) notes.splice(Math.min(index, notes.length), 0, n) })
    }

    return {
      get notes() { return notes },
      set notes(v: Note[]) { notes = v },
      /** The notes the current view shows. */
      get shown() { return shown },
      get unread() { return unread },
      get view() { return view },
      set view(v: string | number | null) { view = v },
      get open() { return open },
      set open(v: boolean) { open = v },
      toggle: () => (open = !open),
      relative,
      markRead,
      markAll,
      archive,
      /** Spread on the bell <button>. */
      bellProps: () => ({
        type: 'button' as const,
        'aria-label': unread ? `Notifications, ${unread} unread` : 'Notifications',
        'aria-expanded': open,
        onclick: () => (open = !open),
      }),
      /** Spread on a notification's main <button>; clicking marks it read. */
      itemProps: (n: Note) => ({ type: 'button' as const, onclick: () => markRead(n) }),
      /** Spread on a notification's archive <button>. */
      archiveProps: (n: Note) => ({
        type: 'button' as const,
        'aria-label': `Archive notification from ${n.from}`,
        onclick: () => archive(n),
      }),
    }
  }
</script>

<script lang="ts">
  import { SvPopover, SvSegmented, SvAvatar, SvButton, SvEmptyState, SvToaster, toast } from '@svgrid/grid'

  const inbox = createNotifications({
    onMarkAll: () => toast.success('All notifications marked as read'),
    onArchive: (_n, undo) => toast('Notification archived', { action: { label: 'Undo', onClick: undo } }),
  })
  let compact = $state(false)

  // Phones get the panel inline (a 360 px popover crowds a 375 px screen).
  // The panel starts open so it is visible in the gallery; start it closed in
  // your app.
  $effect(() => {
    const mq = window.matchMedia('(max-width: 560px)')
    const sync = () => (compact = mq.matches)
    sync()
    inbox.open = true
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  })
</script>

<div class="sv-notif">
  <header class="sv-notif-bar">
    <span class="sv-notif-brand"><span class="sv-notif-mark" aria-hidden="true"></span>Fieldline</span>
    <nav aria-label="Main"><a href="#routes">Routes</a><a href="#fleet">Fleet</a><a href="#reports">Reports</a></nav>
    <div class="sv-notif-right">
      {#if compact}
        {@render bell(inbox.toggle)}
      {:else}
        <SvPopover bind:open={inbox.open} placement="bottom-end" minWidth={360} ariaLabel="Notifications">
          {#snippet anchor()}{@render bell()}{/snippet}
          {@render panel()}
        </SvPopover>
      {/if}
      <SvAvatar name="Ada Park" size="sm" />
    </div>
  </header>

  <main class="sv-notif-body">
    <h2>Good morning, Ada</h2>
    <p class="sv-notif-muted">
      {inbox.unread ? `${inbox.unread} unread notification${inbox.unread === 1 ? '' : 's'}. Open the bell to review them.` : 'You are up to date.'}
    </p>
    {#if compact && inbox.open}
      <div class="sv-notif-inline-panel">{@render panel()}</div>
    {/if}
    <div class="sv-notif-skeleton" aria-hidden="true"><span></span><span></span><span></span></div>
  </main>
</div>

{#snippet bell(onclick?: () => void)}
  <span class="sv-notif-bell">
    <SvButton variant="ghost" ariaLabel={inbox.unread ? `Notifications, ${inbox.unread} unread` : 'Notifications'} {onclick}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
    </SvButton>
    {#if inbox.unread}<span class="sv-notif-count" aria-hidden="true">{inbox.unread}</span>{/if}
  </span>
{/snippet}

{#snippet panel()}
  <section class="sv-notif-panel" aria-labelledby="sv-notif-title">
    <div class="sv-notif-panel-head">
      <h3 id="sv-notif-title">Notifications</h3>
      <button type="button" class="sv-notif-link" disabled={!inbox.unread} onclick={inbox.markAll}>Mark all as read</button>
    </div>
    <SvSegmented
      size="sm"
      block
      ariaLabel="Show"
      options={[{ value: 'all', label: 'All' }, { value: 'unread', label: `Unread (${inbox.unread})` }]}
      bind:value={inbox.view}
    />
    {#if inbox.shown.length}
      <ul class="sv-notif-list">
        {#each inbox.shown as n (n.id)}
          <li class:sv-notif-unread={!n.read}>
            <button type="button" class="sv-notif-item" onclick={() => inbox.markRead(n)}>
              <span class="sv-notif-dot" aria-hidden="true"></span>
              <SvAvatar name={n.from} size={30} />
              <span class="sv-notif-text">
                <span><strong>{n.from}</strong> {n.text} <strong>{n.target}</strong></span>
                <time datetime={new Date(n.at).toISOString()}>{inbox.relative(n.at)}{n.read ? '' : ', unread'}</time>
              </span>
            </button>
            <button type="button" class="sv-notif-archive" aria-label="Archive notification from {n.from}" title="Archive" onclick={() => inbox.archive(n)}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4" /></svg>
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <SvEmptyState compact title={inbox.view === 'unread' && inbox.notes.length ? 'No unread notifications' : 'No notifications'}
        description={inbox.view === 'unread' && inbox.notes.length ? 'Switch to All to see the ones you have read.' : 'Assignments, mentions and alerts show up here.'} />
    {/if}
  </section>
{/snippet}

<SvToaster position="bottom-right" />

<style>
  .sv-notif {
    width: 100%; box-sizing: border-box; min-height: 520px; display: flex; flex-direction: column;
    color: var(--sg-fg, #0f172a); background: var(--sg-bg, #fff); font-family: var(--sg-font, inherit);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px); overflow: hidden;
  }
  .sv-notif-bar { display: flex; align-items: center; gap: 24px; padding: 10px 20px; border-bottom: 1px solid var(--sg-border, #e2e8f0); background: var(--sg-header-bg, #f8fafc); }
  .sv-notif-brand { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; }
  .sv-notif-mark { width: 18px; height: 18px; border-radius: 5px; background: linear-gradient(135deg, var(--sg-fg, #0f172a), color-mix(in srgb, var(--sg-fg, #0f172a) 45%, var(--sg-bg, #fff))); }
  nav { display: flex; gap: 18px; font-size: 13.5px; }
  nav a { color: var(--sg-muted, #64748b); text-decoration: none; }
  nav a:hover { color: var(--sg-fg, #0f172a); }
  .sv-notif-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }
  .sv-notif-bell { position: relative; display: inline-flex; }
  .sv-notif-count {
    position: absolute; top: 1px; right: 1px; min-width: 16px; height: 16px; padding: 0 4px; box-sizing: border-box;
    border-radius: 8px; font-size: 10px; font-weight: 700; line-height: 16px; text-align: center; pointer-events: none;
    background: var(--sg-danger, #dc2626); color: var(--sg-bg, #fff);
  }
  .sv-notif-body { padding: 28px 24px; display: flex; flex-direction: column; gap: 8px; }
  .sv-notif-body h2 { margin: 0; font-size: 20px; font-weight: 650; }
  .sv-notif-muted { margin: 0; font-size: 13.5px; color: var(--sg-muted, #64748b); }
  .sv-notif-skeleton { display: grid; gap: 10px; margin-top: 18px; max-width: 520px; }
  .sv-notif-skeleton span { height: 44px; border-radius: var(--sg-radius, 6px); background: color-mix(in srgb, var(--sg-fg, #0f172a) 5%, var(--sg-bg, #fff)); }

  .sv-notif-panel { display: flex; flex-direction: column; gap: 10px; width: 100%; }
  .sv-notif-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .sv-notif-panel-head h3 { margin: 0; font-size: 14.5px; font-weight: 650; }
  .sv-notif-link { background: none; border: 0; padding: 0; font: inherit; font-size: 12.5px; color: var(--sg-accent, #4f46e5); cursor: pointer; }
  .sv-notif-link:hover:not(:disabled) { text-decoration: underline; }
  .sv-notif-link:disabled { color: var(--sg-muted, #94a3b8); cursor: default; }
  .sv-notif-list { list-style: none; margin: 0 -6px; padding: 0; display: flex; flex-direction: column; }
  .sv-notif-list li { position: relative; display: flex; align-items: flex-start; border-radius: var(--sg-radius, 6px); }
  .sv-notif-list li:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-notif-item {
    flex: 1; min-width: 0; display: flex; align-items: flex-start; gap: 10px; padding: 9px 6px; text-align: left;
    background: none; border: 0; font: inherit; color: inherit; cursor: pointer; border-radius: inherit;
  }
  .sv-notif-item:focus-visible, .sv-notif-archive:focus-visible { outline: 2px solid var(--sg-focus-ring, #6366f1); outline-offset: -2px; }
  .sv-notif-dot { flex: none; width: 7px; height: 7px; margin-top: 12px; border-radius: 50%; background: transparent; }
  .sv-notif-unread .sv-notif-dot { background: var(--sg-accent, #4f46e5); }
  .sv-notif-text { display: flex; flex-direction: column; gap: 2px; font-size: 13px; line-height: 1.4; min-width: 0; overflow-wrap: anywhere; color: var(--sg-muted, #64748b); }
  .sv-notif-text strong { font-weight: 600; color: var(--sg-fg, #0f172a); }
  .sv-notif-unread .sv-notif-text { color: var(--sg-fg, #0f172a); }
  time { font-size: 11.5px; color: var(--sg-muted, #64748b); }
  .sv-notif-archive {
    flex: none; display: grid; place-items: center; width: 28px; height: 28px; margin: 8px 4px 0 0; padding: 0;
    border: 0; border-radius: var(--sg-radius, 6px); background: none; color: var(--sg-muted, #64748b); cursor: pointer; opacity: .6;
  }
  .sv-notif-archive svg { display: block; }
  .sv-notif-list li:hover .sv-notif-archive, .sv-notif-archive:focus-visible { opacity: 1; }
  .sv-notif-archive:hover { color: var(--sg-fg, #0f172a); background: color-mix(in srgb, var(--sg-fg, #0f172a) 8%, transparent); }

  @media (max-width: 560px) {
    .sv-notif-bar { padding: 10px 14px; gap: 12px; flex-wrap: wrap; }
    nav { display: none; }
    .sv-notif-body { padding: 16px 14px 24px; }
    .sv-notif-inline-panel { padding: 12px; margin-top: 10px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 10px); }
    .sv-notif-archive { opacity: 1; }
  }
</style>
