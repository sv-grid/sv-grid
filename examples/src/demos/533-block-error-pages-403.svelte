<script lang="ts" module>
  /**
   * Access denied block - a 403 screen that says which permission is missing,
   * shows the signed-in account (SvAvatar + email) with a "Switch account"
   * SvButton, and lets the user ask the owner for access: "Request access"
   * opens an optional SvTextArea note, sending shows loading, fires a toast
   * and leaves a pending SvBadge. Pure UI-kit, --sg-* themed.
   *
   * Headless: createAccessRequest() below owns the request flow (idle,
   * writing a note, sent), the note and the sending state with no markup. The
   * component under it is one styled render of that core; import
   * createAccessRequest from this file (or `npx @svgrid/ui add
   * error-pages-403 --headless` for the core alone) to draw your own.
   */
  const STAGES = ['idle', 'writing', 'sent'] as const
  export type AccessStage = (typeof STAGES)[number]
  export type AccessRequest = { resource: string; permission: string; owner: string; note: string }
  export type AccessRequestOptions = {
    user?: { name: string; email: string }
    /** Who approves the request. */
    owner?: string
    resource?: string
    permission?: string
    /** POST to your access-request endpoint; throw (or reject) to stay on the note. */
    onRequest?: (req: AccessRequest) => Promise<void> | void
    onSwitchAccount?: () => void
  }

  export function createAccessRequest(opts: AccessRequestOptions = {}) {
    // Sample account and report stand in when the app passes none; the note is optional.
    const user = opts.user ?? { name: 'Ada Lovelace', email: 'ada@northwind.io' }
    const owner = opts.owner ?? 'Grace Hopper'
    const resource = opts.resource ?? 'Q3 revenue forecast'
    const permission = opts.permission ?? 'reports.finance:read'

    let stage = $state<AccessStage>('idle')
    let note = $state('')
    let sending = $state(false)

    async function send(ev?: Event) {
      ev?.preventDefault()
      if (sending) return
      sending = true
      try {
        await opts.onRequest?.({ resource, permission, owner, note })
        stage = 'sent'
      } finally {
        sending = false
      }
    }

    return {
      user,
      owner,
      resource,
      permission,
      get stage() { return stage },
      get note() { return note },
      set note(v: string) { note = v },
      get sending() { return sending },
      /** Open the note form. */
      start: () => { stage = 'writing' },
      cancel: () => { stage = 'idle' },
      send,
      switchAccount: () => opts.onSwitchAccount?.(),
      /** Spread on your request <form>. */
      formProps: () => ({ onsubmit: send }),
    }
  }
</script>

<script lang="ts">
  import { SvAvatar, SvBadge, SvButton, SvTextArea, SvToaster, toast } from '@svgrid/grid'

  const access = createAccessRequest({
    // Replace with a POST to your access-request endpoint (resource, note).
    onRequest: ({ owner, note }) =>
      new Promise<void>((res) => setTimeout(res, 900)).then(() => {
        toast.success(`Request sent to ${owner}`, { title: note.trim() ? 'Note included' : undefined })
      }),
    onSwitchAccount: () => toast('Signing out. Pick another account on the next screen.'),
  })
</script>

<main class="sv-denied">
  <div class="sv-denied-card">
    <span class="sv-denied-lock" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 10.5h12v10H6zM8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3M12 14.5v2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </span>
    <h2>You don't have access to this report</h2>
    <p class="sv-denied-muted">
      <b>{access.resource}</b> is shared with the Finance team. Your account can view the
      workspace, but opening this report needs the <code>{access.permission}</code> permission.
    </p>

    <div class="sv-denied-who">
      <SvAvatar name={access.user.name} size="md" />
      <div class="sv-denied-who-txt">
        <span class="sv-denied-lbl">Signed in as</span>
        <strong>{access.user.email}</strong>
      </div>
      <SvButton variant="ghost" size="sm" onclick={access.switchAccount}>Switch account</SvButton>
    </div>

    {#if access.stage === 'sent'}
      <div class="sv-denied-sent" role="status">
        <SvBadge variant="warning" dot>Pending</SvBadge>
        <span>Waiting on {access.owner}. You'll get an email when the request is approved.</span>
      </div>
    {:else if access.stage === 'writing'}
      <form class="sv-denied-req" {...access.formProps()}>
        <SvTextArea
          label="Note to {access.owner} (optional)"
          placeholder="I'm preparing the board deck and need the Q3 numbers."
          bind:value={access.note}
          rows={3}
          maxlength={280}
          showCount
          block
        />
        <div class="sv-denied-req-actions">
          <SvButton variant="ghost" onclick={access.cancel} disabled={access.sending}>Cancel</SvButton>
          <SvButton type="submit" variant="primary" loading={access.sending}>Send request</SvButton>
        </div>
      </form>
    {:else}
      <SvButton variant="primary" block onclick={access.start}>Request access</SvButton>
    {/if}
  </div>
</main>

<SvToaster position="bottom-right" />

<style>
  .sv-denied { display: grid; place-items: center; min-height: 560px; padding: 40px 24px; box-sizing: border-box; color: var(--sg-fg, #0f172a); }
  .sv-denied-card {
    width: 100%;
    max-width: 460px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 30px;
    box-sizing: border-box;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: var(--sg-radius-lg, 14px);
    box-shadow: 0 12px 32px -18px color-mix(in srgb, var(--sg-fg, #0f172a) 35%, transparent);
  }
  .sv-denied-lock { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; color: var(--sg-fg, #0f172a); background: color-mix(in srgb, var(--sg-fg, #0f172a) 7%, var(--sg-bg, #fff)); border: 1px solid var(--sg-border, #e2e8f0); }
  h2 { margin: 0; font-size: 22px; line-height: 1.25; letter-spacing: -.015em; }
  .sv-denied-muted { margin: 0; color: var(--sg-muted, #64748b); font-size: 14px; line-height: 1.6; }
  .sv-denied-muted b { color: var(--sg-fg, #0f172a); font-weight: 600; }
  code { font-size: 12.5px; padding: 1px 6px; border-radius: 5px; color: var(--sg-fg, #0f172a); background: color-mix(in srgb, var(--sg-fg, #0f172a) 7%, var(--sg-bg, #fff)); overflow-wrap: anywhere; }
  .sv-denied-who { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: var(--sg-radius, 8px); background: var(--sg-bg-subtle, #f8fafc); border: 1px solid var(--sg-border, #e2e8f0); }
  .sv-denied-who-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .sv-denied-who-txt strong { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-denied-lbl { font-size: 12px; color: var(--sg-muted, #64748b); }
  .sv-denied-req { display: flex; flex-direction: column; gap: 12px; }
  .sv-denied-req-actions { display: flex; justify-content: flex-end; gap: 8px; }
  .sv-denied-sent { display: flex; align-items: flex-start; gap: 10px; font-size: 13.5px; line-height: 1.5; color: var(--sg-muted, #64748b); }

  @media (max-width: 480px) {
    .sv-denied { padding: 20px 12px; }
    .sv-denied-card { padding: 22px 18px; }
    h2 { font-size: 20px; }
    .sv-denied-who { flex-wrap: wrap; }
    .sv-denied-who-txt { flex: 1 1 160px; }
    .sv-denied-who :global(.sv-btn) { margin-left: 38px; }
    .sv-denied-req-actions :global(.sv-btn) { flex: 1; }
  }
</style>
