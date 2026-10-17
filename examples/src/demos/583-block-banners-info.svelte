<script lang="ts" module>
  /**
   * Inline info banners block - the four SvAlert tones (info, success,
   * warning, danger) placed inside a workspace settings page, each with a
   * dismiss button and most with SvButton actions that do real work: rotate
   * an expiring API key, retry failed webhooks, download an export. Results
   * land in an SvToaster toast, and a "Show hidden banners" SvButton brings
   * dismissed and resolved banners back. Pure UI-kit, --sg-* themed.
   *
   * Headless: createInfoBanners() below owns which banners are shown, the
   * key-rotation and webhook-retry flows with their loading flags, and the
   * restore action with no markup. The component under it is one styled
   * render of that core; import createInfoBanners from this file (or
   * `npx @svgrid/ui add banners-info --headless` for the core alone) to draw
   * your own.
   */
  export type InfoBannerId = 'usage' | 'export' | 'key' | 'hooks'
  export type InfoBannersOptions = {
    /** Last characters of the API key that is about to expire. */
    keySuffix?: string
    /** Rotate the key; resolve the new key's suffix. Throw to keep the banner up. */
    rotateKey?: () => Promise<string>
    onRotated?: (suffix: string) => void
    /** Re-send the failed deliveries. Throw to keep the banner up. */
    retryHooks?: () => Promise<void>
    onRetried?: () => void
  }

  const ALL_SHOWN: Record<InfoBannerId, boolean> = { usage: true, export: true, key: true, hooks: true }

  export function createInfoBanners(opts: InfoBannersOptions = {}) {
    const initialSuffix = opts.keySuffix ?? '9f3c'
    let shown = $state<Record<InfoBannerId, boolean>>({ ...ALL_SHOWN })
    let keySuffix = $state(initialSuffix)
    let rotating = $state(false)
    let retrying = $state(false)

    const hidden = $derived(Object.values(shown).filter((v) => !v).length)

    async function rotateKey() {
      if (rotating || !opts.rotateKey) return
      rotating = true
      try {
        keySuffix = await opts.rotateKey()
        shown.key = false
        opts.onRotated?.(keySuffix)
      } finally {
        rotating = false
      }
    }

    async function retryHooks() {
      if (retrying || !opts.retryHooks) return
      retrying = true
      try {
        await opts.retryHooks()
        shown.hooks = false
        opts.onRetried?.()
      } finally {
        retrying = false
      }
    }

    return {
      get shown() { return shown },
      get keySuffix() { return keySuffix },
      get rotating() { return rotating },
      get retrying() { return retrying },
      /** How many banners are dismissed or resolved. */
      get hidden() { return hidden },
      dismiss: (id: InfoBannerId) => { shown[id] = false },
      restore: () => { shown = { ...ALL_SHOWN }; keySuffix = initialSuffix },
      rotateKey,
      retryHooks,
      /** Spread on a plain dismiss <button> for one banner. */
      dismissProps: (id: InfoBannerId) => ({ type: 'button' as const, 'aria-label': 'Dismiss', onclick: () => { shown[id] = false } }),
    }
  }
</script>

<script lang="ts">
  import { SvAlert, SvButton, SvToaster, toast } from '@svgrid/grid'

  const banners = createInfoBanners({
    // Replace both with your API calls.
    rotateKey: () => new Promise((res) => setTimeout(() => res(Math.random().toString(16).slice(2, 6)), 1000)),
    onRotated: (s) => toast.success(`New key ending ${s} is active. The old key stops working in 24 hours.`),
    retryHooks: () => new Promise((res) => setTimeout(res, 1100)),
    onRetried: () => toast.success('2 deliveries sent to https://hooks.northwind.io/orders'),
  })
</script>

<main class="sv-bn-info">
  <div class="sv-bn-info-head">
    <div>
      <h2>Workspace settings</h2>
      <p class="sv-bn-info-muted">Northwind Ops, 14 members</p>
    </div>
    {#if banners.hidden > 0}
      <SvButton variant="outline" size="sm" onclick={banners.restore}>Show hidden banners ({banners.hidden})</SvButton>
    {/if}
  </div>

  <div class="sv-bn-info-stack">
    {#if banners.shown.hooks}
      <SvAlert variant="danger" title="2 webhook deliveries failed" dismissible onDismiss={() => banners.dismiss('hooks')}>
        The endpoint returned 503 for order.created at 14:02 and 14:09. We stop retrying after 24 hours.
        {#snippet actions()}
          <SvButton size="sm" variant="secondary" loading={banners.retrying} onclick={banners.retryHooks}>Retry now</SvButton>
        {/snippet}
      </SvAlert>
    {/if}

    {#if banners.shown.key}
      <SvAlert variant="warning" title="API key ending {banners.keySuffix} expires in 5 days" dismissible onDismiss={() => banners.dismiss('key')}>
        Integrations using it will start getting 401 errors on Oct 20.
        {#snippet actions()}
          <SvButton size="sm" variant="secondary" loading={banners.rotating} onclick={banners.rotateKey}>Rotate key</SvButton>
          <SvButton size="sm" variant="ghost" onclick={() => toast('Key usage: 3 integrations, last call 2 min ago')}>See usage</SvButton>
        {/snippet}
      </SvAlert>
    {/if}

    {#if banners.shown.export}
      <SvAlert variant="success" title="Export ready" dismissible onDismiss={() => banners.dismiss('export')}>
        orders-2026-q3.csv, 12,480 rows. The link expires in 7 days.
        {#snippet actions()}
          <SvButton size="sm" variant="secondary" onclick={() => toast.success('Downloading orders-2026-q3.csv')}>Download</SvButton>
        {/snippet}
      </SvAlert>
    {/if}

    {#if banners.shown.usage}
      <SvAlert variant="info" dismissible onDismiss={() => banners.dismiss('usage')}>
        Usage figures on this page refresh every 15 minutes.
      </SvAlert>
    {/if}
  </div>

  <section class="sv-bn-info-mock" aria-hidden="true">
    {#each [55, 40, 65] as w (w)}
      <div class="sv-bn-info-field"><i class="sv-bn-info-lbl"></i><i class="sv-bn-info-box" style:--w="{w}%"></i></div>
    {/each}
  </section>
</main>

<SvToaster position="bottom-right" />

<style>
  .sv-bn-info {
    width: 100%; box-sizing: border-box; max-width: 820px; margin: 0 auto; min-height: 560px;
    padding: 32px 24px; display: flex; flex-direction: column; gap: 20px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-bn-info-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  h2 { margin: 0 0 4px; font-size: 22px; font-weight: 700; letter-spacing: -.01em; }
  .sv-bn-info-muted { margin: 0; font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-bn-info-stack { display: flex; flex-direction: column; gap: 12px; }
  .sv-bn-info-stack :global(.sv-alert__actions) { flex-wrap: wrap; }
  .sv-bn-info-mock { display: flex; flex-direction: column; gap: 18px; padding: 20px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px); }
  .sv-bn-info-field { display: flex; flex-direction: column; gap: 8px; }
  .sv-bn-info-field i { display: block; border-radius: 4px; background: color-mix(in srgb, var(--sg-fg, #0f172a) 8%, var(--sg-bg, #fff)); }
  .sv-bn-info-field i.sv-bn-info-lbl { width: 90px; height: 8px; }
  .sv-bn-info-field i.sv-bn-info-box { width: var(--w); height: 32px; border-radius: var(--sg-radius, 8px); }

  @media (max-width: 640px) {
    .sv-bn-info { padding: 20px 12px; }
    .sv-bn-info-field i.sv-bn-info-box { width: 100%; }
  }
</style>
