<script lang="ts" module>
  /**
   * Notification settings block - a table of event types (rows) by channel
   * (Email, Push, SMS) with one SvSwitchButton per cell, plus an SvSegmented
   * digest frequency. A sticky save bar slides in only when the choices differ from
   * the saved ones: Save (SvButton with loading) stores them, Discard puts the
   * saved state back. SvBadge marks the unsaved count. Pure UI-kit,
   * --sg-* themed.
   *
   * Headless: createNotificationSettings() below owns the saved and edited
   * preferences, the unsaved-change count and the save and discard flow with
   * no markup. The component under it is one styled render of that core;
   * import createNotificationSettings from this file (or `npx @svgrid/ui add
   * form-layouts-settings --headless` for the core alone) to draw your own.
   */
  const CHANNEL_IDS = ['email', 'push', 'sms'] as const
  export type NotifChannel = (typeof CHANNEL_IDS)[number]
  export type NotifEvent = { id: string; label: string; note: string; noSms?: boolean }
  export type NotifPrefs = { events: Record<string, Record<NotifChannel, boolean>>; digest: string | number }
  export type NotificationSettingsOptions = {
    channels?: { id: NotifChannel; label: string }[]
    events?: NotifEvent[]
    digestOptions?: { value: string; label: string }[]
    /** What the server has. Load this from your API. */
    stored?: NotifPrefs
    /** Called with the edited preferences; throw (or reject) to keep them unsaved. */
    onSave?: (prefs: NotifPrefs) => Promise<void> | void
    onDiscard?: () => void
  }

  const SAMPLE_CHANNELS: { id: NotifChannel; label: string }[] = [
    { id: 'email', label: 'Email' }, { id: 'push', label: 'Push' }, { id: 'sms', label: 'SMS' },
  ]
  const SAMPLE_EVENTS: NotifEvent[] = [
    { id: 'assigned', label: 'Task assigned to me', note: 'When someone hands you a task' },
    { id: 'mention', label: 'Mentions', note: '@you in a comment or a doc' },
    { id: 'due', label: 'Due date reminders', note: '24 hours before a task is due' },
    { id: 'deploy', label: 'Failed deploys', note: 'Pipelines you own' },
    { id: 'billing', label: 'Invoices and billing', note: 'Receipts, failed payments', noSms: true },
  ]
  const SAMPLE_DIGEST = [
    { value: 'off', label: 'Off' }, { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' },
  ]
  const SAMPLE_STORED: NotifPrefs = {
    events: {
      assigned: { email: true, push: true, sms: false },
      mention: { email: true, push: true, sms: false },
      due: { email: false, push: true, sms: false },
      deploy: { email: true, push: true, sms: true },
      billing: { email: true, push: false, sms: false },
    },
    digest: 'weekly',
  }

  export function createNotificationSettings(opts: NotificationSettingsOptions = {}) {
    const channels = opts.channels ?? SAMPLE_CHANNELS
    const events = opts.events ?? SAMPLE_EVENTS
    const stored = opts.stored ?? SAMPLE_STORED

    // saved = what the server has; prefs = the editable copy.
    let saved = $state<NotifPrefs>(structuredClone(stored))
    let prefs = $state<NotifPrefs>(structuredClone(stored))
    let busy = $state(false)

    const changes = $derived(
      events.reduce((n, e) => n + channels.filter((c) => prefs.events[e.id]![c.id] !== saved.events[e.id]![c.id]).length, 0)
        + (prefs.digest !== saved.digest ? 1 : 0),
    )

    /** False for a cell the channel cannot deliver (SMS for billing). */
    const available = (eventId: string, channel: NotifChannel) =>
      !(channel === 'sms' && events.find((e) => e.id === eventId)?.noSms)
    const isOn = (eventId: string, channel: NotifChannel) => prefs.events[eventId]![channel]
    function set(eventId: string, channel: NotifChannel, on: boolean) {
      prefs.events[eventId]![channel] = on
    }

    async function save() {
      if (busy) return
      busy = true
      try {
        await opts.onSave?.($state.snapshot(prefs))
        saved = $state.snapshot(prefs)
      } catch {
        // Edits stay; the save bar stays up.
      } finally {
        busy = false
      }
    }

    function discard() {
      prefs = $state.snapshot(saved)
      opts.onDiscard?.()
    }

    return {
      channels, events,
      digestOptions: opts.digestOptions ?? SAMPLE_DIGEST,
      get prefs() { return prefs },
      get saved() { return saved },
      get digest() { return prefs.digest },
      set digest(v: string | number) { prefs.digest = v },
      get changes() { return changes },
      get dirty() { return changes > 0 },
      get busy() { return busy },
      available, isOn, set, save, discard,
      /** Spread on a plain <button> to render one cell as a switch. */
      switchProps: (eventId: string, channel: NotifChannel) => ({
        type: 'button' as const,
        role: 'switch' as const,
        'aria-checked': isOn(eventId, channel),
        'aria-label': `${events.find((e) => e.id === eventId)?.label ?? eventId} by ${channels.find((c) => c.id === channel)?.label ?? channel}`,
        onclick: () => set(eventId, channel, !isOn(eventId, channel)),
      }),
    }
  }
</script>

<script lang="ts">
  import { SvSwitchButton, SvSegmented, SvButton, SvBadge, SvToaster, toast } from '@svgrid/grid'

  const notif = createNotificationSettings({
    // Replace with your request; a thrown error keeps the edits unsaved.
    onSave: () =>
      toast.promise(new Promise<void>((res) => setTimeout(res, 800)), {
        loading: 'Saving notification settings...',
        success: 'Notification settings saved',
        error: 'Could not save settings',
      }),
    onDiscard: () => toast('Changes discarded'),
  })
</script>

<main class="sv-notif">
  <header>
    <h2>Notifications</h2>
    <p class="sv-notif-muted">Choose where Fieldline tells you about each event. SMS goes to +44 7700 900123.</p>
  </header>

  <div class="sv-notif-table-wrap">
    <table>
      <thead>
        <tr>
          <th scope="col" class="sv-notif-ev">Event</th>
          {#each notif.channels as c (c.id)}<th scope="col">{c.label}</th>{/each}
        </tr>
      </thead>
      <tbody>
        {#each notif.events as e (e.id)}
          <tr>
            <th scope="row" class="sv-notif-ev">
              <span class="sv-notif-ev-label">{e.label}</span>
              <span class="sv-notif-ev-note">{e.note}</span>
            </th>
            {#each notif.channels as c (c.id)}
              <td>
                {#if !notif.available(e.id, c.id)}
                  <span class="sv-notif-na" title="Not available by {c.label}">n/a</span>
                {:else}
                  <SvSwitchButton
                    size="sm" ariaLabel="{e.label} by {c.label}" checked={notif.isOn(e.id, c.id)}
                    onChange={(v) => notif.set(e.id, c.id, v)}
                  />
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <section class="sv-notif-digest">
    <div>
      <h3>Email digest</h3>
      <p class="sv-notif-muted">One email with everything you were not notified about directly.</p>
    </div>
    <SvSegmented ariaLabel="Digest frequency" options={notif.digestOptions} bind:value={notif.digest} />
  </section>

  {#if notif.dirty}
    <div class="sv-notif-savebar" role="region" aria-label="Unsaved changes">
      <span><SvBadge variant="warning" size="sm">{notif.changes}</SvBadge> unsaved {notif.changes === 1 ? 'change' : 'changes'}</span>
      <div class="sv-notif-bar-actions">
        <SvButton variant="ghost" onclick={notif.discard} disabled={notif.busy}>Discard</SvButton>
        <SvButton onclick={notif.save} loading={notif.busy}>Save changes</SvButton>
      </div>
    </div>
  {/if}
</main>

<SvToaster position="bottom-right" />

<style>
  .sv-notif {
    flex: none; width: 100%;
    display: flex; flex-direction: column; gap: 20px;
    min-height: 560px; max-width: 760px; margin: 0 auto; padding: 32px 24px 24px; box-sizing: border-box;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
  }
  h2 { font-weight: 700; margin: 0 0 4px; font-size: 22px; letter-spacing: -.01em; }
  h3 { font-weight: 600; margin: 0 0 2px; font-size: 14px; }
  .sv-notif-muted { margin: 0; font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-notif-table-wrap { border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px); overflow: hidden; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  thead th {
    padding: 10px 12px; font-size: 12px; font-weight: 600; color: var(--sg-muted, #64748b);
    background: var(--sg-header-bg, #f8fafc); border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  td, tbody th { padding: 12px; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  tbody tr:last-child > * { border-bottom: 0; }
  tbody tr:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  td { width: 76px; text-align: center; }
  .sv-notif-ev { text-align: left; font-weight: 400; }
  .sv-notif-ev-label { display: block; font-weight: 550; }
  .sv-notif-ev-note { display: block; font-size: 12px; color: var(--sg-muted, #64748b); margin-top: 2px; }
  .sv-notif-na { font-size: 12px; color: var(--sg-muted, #94a3b8); }
  .sv-notif-digest { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .sv-notif-savebar {
    position: sticky; bottom: 16px; margin-top: auto;
    display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
    padding: 10px 12px 10px 16px; font-size: 13.5px;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
    box-shadow: 0 8px 24px color-mix(in srgb, var(--sg-fg, #0f172a) 14%, transparent);
    animation: sv-notif-rise .18s ease-out;
  }
  .sv-notif-savebar span { display: inline-flex; align-items: center; gap: 8px; }
  .sv-notif-bar-actions { display: flex; gap: 8px; }
  @keyframes sv-notif-rise { from { transform: translateY(8px); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .sv-notif-savebar { animation: none; } }

  @media (max-width: 560px) {
    .sv-notif { padding: 20px 12px; }
    td { width: 48px; padding: 10px 4px; }
    thead th { padding: 10px 4px; }
    tbody th, thead th.sv-notif-ev { padding: 10px 8px 10px 12px; }
    .sv-notif-bar-actions { flex: 1; justify-content: flex-end; }
  }
</style>
