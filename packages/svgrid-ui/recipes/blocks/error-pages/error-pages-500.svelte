<script lang="ts" module>
  /**
   * 500 server error block - a "something broke on our side" screen with a
   * Retry SvButton that shows loading and reports the outcome in a toast, a
   * request id the user can copy for support (copy SvButton -> toast), and a
   * link to the status page. SvBadge shows the incident state. Without a
   * `retry` prop the demo alternates fail / succeed so both paths are visible.
   * Pure UI-kit, --sg-* themed.
   *
   * Headless: createServerError() below owns the retry flow, the attempt
   * count, the failure time and copying the request id, with no markup. The
   * component under it is one styled render of that core; import
   * createServerError from this file (or `npx @svgrid/ui add error-pages-500
   * --headless` for the core alone) to draw your own.
   */
  export type ServerErrorOptions = {
    /** Shown for support. Pass '' to hide it. Read lazily (getter-friendly). */
    requestId?: string
    /** Status page link. Read lazily (getter-friendly). */
    statusUrl?: string
    /** Re-run the failed request; reject to stay on the error. */
    retry?: () => Promise<unknown>
    onRecovered?: (attempt: number) => void
    onRetryFailed?: (error: unknown) => void
    /** Clipboard write; defaults to navigator.clipboard.writeText. */
    writeClipboard?: (text: string) => Promise<void>
    onCopy?: (ok: boolean, requestId: string) => void
  }

  export function createServerError(opts: ServerErrorOptions = {}) {
    // requestId and statusUrl are read on every access; getters in opts keep props live.
    const requestId = () => opts.requestId ?? 'req_8f3a21c9e04b'
    const failedAt = new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC'
    let busy = $state(false)
    let recovered = $state(false)
    let attempts = $state(0)

    async function retry() {
      if (busy) return
      busy = true
      try {
        await opts.retry?.()
        recovered = true
        opts.onRecovered?.(attempts + 1)
      } catch (err) {
        opts.onRetryFailed?.(err)
      } finally {
        attempts += 1
        busy = false
      }
    }

    async function copyId() {
      const id = requestId()
      try {
        await (opts.writeClipboard ?? ((t: string) => navigator.clipboard.writeText(t)))(id)
        opts.onCopy?.(true, id)
      } catch {
        opts.onCopy?.(false, id)
      }
    }

    return {
      get requestId() { return requestId() },
      get statusUrl() { return opts.statusUrl ?? 'https://status.example.com' },
      failedAt,
      get busy() { return busy },
      get recovered() { return recovered },
      get attempts() { return attempts },
      retry,
      copyId,
      /** Spread on your Retry <button>. */
      retryProps: () => ({ type: 'button' as const, disabled: busy, 'aria-busy': busy, onclick: retry }),
    }
  }
</script>

<script lang="ts">
  import { SvButton, SvBadge, SvToaster, toast } from '@svgrid/grid'

  let { requestId, retry, statusUrl }: { requestId?: string; retry?: () => Promise<unknown>; statusUrl?: string } = $props()
  // Pass an empty requestId to hide the id row.

  // Demo stand-in for `retry`: the first try fails, the next one succeeds.
  let tries = 0
  const simulate = () =>
    new Promise<void>((res, rej) => setTimeout(() => (tries++ % 2 ? res() : rej(new Error('503'))), 1000))

  const srv = createServerError({
    get requestId() { return requestId },
    get statusUrl() { return statusUrl },
    retry: () => (retry ?? simulate)(),
    onRecovered: () => toast.success('Back online. Your report loaded.'),
    onRetryFailed: () => toast.error('Still failing. Give it a minute, or send us the request id.'),
    onCopy: (ok, id) =>
      ok ? toast.success(`Copied ${id}`) : toast.warning('Copy blocked by the browser. Select the id and copy it by hand.'),
  })
</script>

<main class="sv-srv">
  <div class="sv-srv-card" class:sv-srv-ok={srv.recovered}>
    <span class="sv-srv-icon" aria-hidden="true">
      {#if srv.recovered}
        <svg viewBox="0 0 24 24" width="24" height="24"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
      {:else}
        <svg viewBox="0 0 24 24" width="24" height="24"><path d="M3 6.5h18v11H3zM7 10l2 2-2 2M12 14h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
      {/if}
    </span>

    <div class="sv-srv-main">
      <SvBadge variant={srv.recovered ? 'success' : 'danger'} dot>
        {srv.recovered ? 'Resolved' : '500 - Internal server error'}
      </SvBadge>
      <h2>{srv.recovered ? 'We are back' : 'Something broke on our side'}</h2>
      <p class="sv-srv-muted">
        {#if srv.recovered}
          The reporting service answered on attempt {srv.attempts}. Nothing you entered was lost.
        {:else}
          Acme Analytics could not build this report. Your data is safe; the
          reporting service did not answer in time. Retrying usually works.
        {/if}
      </p>

      <div class="sv-srv-actions">
        {#if srv.recovered}
          <SvButton variant="primary" href="/">Continue to reports</SvButton>
        {:else}
          <SvButton variant="primary" loading={srv.busy} onclick={srv.retry}>{srv.busy ? 'Retrying...' : 'Retry'}</SvButton>
        {/if}
        <a class="sv-srv-status" href={srv.statusUrl} target="_blank" rel="noreferrer">
          View status page
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M6 3h7v7M13 3 4 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
        </a>
      </div>

      <dl class="sv-srv-meta">
        {#if srv.requestId}
          <div>
            <dt>Request id</dt>
            <dd class="sv-srv-rid">
              <code>{srv.requestId}</code>
              <SvButton variant="ghost" size="sm" ariaLabel="Copy request id" onclick={srv.copyId}>
                {#snippet icon()}
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M5.5 5.5h7v8h-7zM3.5 10.5v-8h7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" /></svg>
                {/snippet}
                Copy
              </SvButton>
            </dd>
          </div>
        {/if}
        <div><dt>Time</dt><dd>{srv.failedAt}</dd></div>
      </dl>
    </div>
  </div>
</main>

<SvToaster position="bottom-right" />

<style>
  .sv-srv {
    display: grid;
    place-items: center;
    min-height: 540px;
    padding: 40px 24px;
    box-sizing: border-box;
    color: var(--sg-fg, #0f172a);
  }
  .sv-srv-card {
    --_tone: var(--sg-danger, #dc2626);
    display: flex;
    gap: 20px;
    width: 100%;
    max-width: 600px;
    padding: 28px;
    box-sizing: border-box;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #e2e8f0);
    border-top: 3px solid var(--_tone);
    border-radius: var(--sg-radius-lg, 12px);
  }
  .sv-srv-card.sv-srv-ok { --_tone: var(--sg-success, #16a34a); }
  .sv-srv-icon {
    flex: none;
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    color: var(--_tone);
    background: color-mix(in srgb, var(--_tone) 12%, transparent);
  }
  .sv-srv-main { flex: 1; min-width: 0; }
  h2 { margin: 12px 0 8px; font-size: 24px; letter-spacing: -.015em; }
  .sv-srv-muted { margin: 0; color: var(--sg-muted, #64748b); font-size: 14.5px; line-height: 1.55; }
  .sv-srv-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin-top: 22px; }
  .sv-srv-status { display: inline-flex; align-items: center; gap: 5px; font-size: 13.5px; font-weight: 500; color: var(--sg-fg, #0f172a); text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--sg-border, #cbd5e1); }
  .sv-srv-status:hover { text-decoration-color: currentColor; }
  .sv-srv-meta { display: grid; grid-template-columns: 1fr auto; gap: 16px; margin: 24px 0 0; padding-top: 16px; border-top: 1px solid var(--sg-border, #e2e8f0); }
  dt { font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--sg-muted, #64748b); }
  dd { margin: 6px 0 0; font-size: 13px; font-variant-numeric: tabular-nums; }
  .sv-srv-rid { display: flex; align-items: center; gap: 6px; min-width: 0; }
  code { font-size: 13px; padding: 3px 7px; border-radius: 6px; background: color-mix(in srgb, var(--sg-fg, #0f172a) 7%, var(--sg-bg, #fff)); overflow-wrap: anywhere; }

  @media (max-width: 560px) {
    .sv-srv { padding: 24px 12px; }
    .sv-srv-card { flex-direction: column; gap: 14px; padding: 22px 18px; }
    h2 { font-size: 21px; }
    .sv-srv-meta { grid-template-columns: 1fr; }
  }
</style>
