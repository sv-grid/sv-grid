<script lang="ts" module>
  /**
   * Maintenance page block - a planned-downtime screen: what is changing, the
   * expected finish time with a live countdown, an SvProgress bar and a step
   * list that both advance with the clock, a "notify me" SvTextInput that
   * validates the email before SvButton submits (toast), and a status link.
   * SvBadge marks the window. Pure UI-kit, --sg-* themed.
   *
   * Headless: createMaintenance() below owns the clock, countdown, progress,
   * current step and the notify-me form with no markup. The component under
   * it is one styled render of that core; import createMaintenance from this
   * file (or `npx @svgrid/ui add error-pages-maintenance --headless` for the
   * core alone) to draw your own.
   */
  const MIN = 60_000
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  /** A step counts as done once the window passes `at` percent. */
  export type MaintenanceStep = { label: string; at: number }
  export type MaintenanceOptions = {
    /** Window start and end, epoch ms. Read lazily (getter-friendly). The
     *  default window started 26 minutes ago and is 45 minutes long. */
    startsAt?: number
    endsAt?: number
    steps?: MaintenanceStep[]
    /** Called with a valid email; throw (or reject) to keep the form open. */
    onNotify?: (email: string) => Promise<void> | void
  }

  const SAMPLE_STEPS: MaintenanceStep[] = [
    { label: 'Snapshot and verify backups', at: 0 },
    { label: 'Copy workspaces to the new cluster', at: 25 },
    { label: 'Rebuild search indexes', at: 75 },
    { label: 'Run checks and reopen sign-in', at: 92 },
  ]
  const pad = (n: number) => String(n).padStart(2, '0')

  /**
   * Call during component init: the one-second clock is an `$effect` that
   * stops when the component unmounts.
   */
  export function createMaintenance(opts: MaintenanceOptions = {}) {
    // startsAt and endsAt are read on every access; getters in opts keep props live.
    const created = Date.now()
    const startsAt = () => opts.startsAt ?? created - 26 * MIN
    const endsAt = () => opts.endsAt ?? created + 19 * MIN
    const steps = opts.steps ?? SAMPLE_STEPS

    let now = $state(Date.now())
    $effect(() => {
      const t = setInterval(() => (now = Date.now()), 1000)
      return () => clearInterval(t)
    })

    const left = $derived(Math.max(0, endsAt() - now))
    const pct = $derived(Math.min(100, ((now - startsAt()) / (endsAt() - startsAt())) * 100))
    const countdown = $derived(`${pad(Math.floor(left / 3_600_000))}:${pad(Math.floor(left / MIN) % 60)}:${pad(Math.floor(left / 1000) % 60)}`)
    const finish = $derived(new Date(endsAt()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    const current = $derived(steps.reduce((acc, s, i) => (pct >= s.at ? i : acc), 0))

    let email = $state('')
    let error = $state<string | undefined>(undefined)
    let sending = $state(false)
    let subscribed = $state('')

    async function notify(ev?: Event) {
      ev?.preventDefault()
      const v = email.trim()
      if (!EMAIL_RE.test(v)) { error = 'Enter an email like you@company.com'; return }
      error = undefined
      sending = true
      try {
        await opts.onNotify?.(v)
        subscribed = v
      } finally {
        sending = false
      }
    }

    return {
      steps,
      /** Milliseconds left in the window, never below 0. */
      get left() { return left },
      /** Share of the window elapsed, 0-100. */
      get pct() { return pct },
      /** hh:mm:ss until the end of the window. */
      get countdown() { return countdown },
      /** Expected finish as a local hh:mm. */
      get finish() { return finish },
      /** Index of the step in progress. */
      get current() { return current },
      get email() { return email },
      set email(v: string) { email = v },
      get error() { return error },
      get sending() { return sending },
      /** The address that subscribed, '' until then. */
      get subscribed() { return subscribed },
      notify,
      /** Spread on your notify-me <form>. */
      formProps: () => ({ novalidate: true, onsubmit: notify }),
      /** Spread on one step's <li>. */
      stepProps: (i: number) => ({ 'aria-current': i === current ? ('step' as const) : undefined }),
    }
  }
</script>

<script lang="ts">
  import { SvBadge, SvProgress, SvTextInput, SvButton, SvToaster, toast } from '@svgrid/grid'

  // The window: started 26 minutes ago, 45 minutes long. Pass real times in.
  let { startsAt, endsAt }: { startsAt?: number; endsAt?: number } = $props()

  const mnt = createMaintenance({
    get startsAt() { return startsAt },
    get endsAt() { return endsAt },
    // Replace with a POST to your mailing endpoint.
    onNotify: (v) =>
      new Promise<void>((res) => setTimeout(res, 900)).then(() => {
        toast.success(`We'll email ${v} when Lumen is back`)
      }),
  })
</script>

<main class="sv-mnt">
  <header>
    <SvBadge variant="warning" dot>Scheduled maintenance</SvBadge>
    <h2>Lumen is moving to a new database cluster</h2>
    <p class="sv-mnt-muted">
      Sign-in and the API are paused while we copy every workspace across. Nothing
      is deleted, and dashboards come back exactly as you left them.
    </p>
  </header>

  <section class="sv-mnt-eta" aria-label="Progress">
    <div class="sv-mnt-eta-top">
      <div>
        <span class="sv-mnt-lbl">Back in</span>
        <strong class="sv-mnt-clock" aria-live="off">{mnt.left > 0 ? mnt.countdown : 'Any minute now'}</strong>
      </div>
      <span class="sv-mnt-lbl sv-mnt-right">Expected by <b>{mnt.finish}</b></span>
    </div>
    <SvProgress value={mnt.pct} color="warning" showLabel ariaLabel="Maintenance progress" formatLabel={(v) => `${Math.floor(v)}%`} />
    <ol>
      {#each mnt.steps as s, i (s.label)}
        <li class:sv-mnt-done={i < mnt.current} class:sv-mnt-now={i === mnt.current}>
          <span class="sv-mnt-dot" aria-hidden="true">{i < mnt.current ? '✓' : ''}</span>
          {s.label}{#if i === mnt.current}<span class="sv-mnt-sr"> (in progress)</span>{/if}
        </li>
      {/each}
    </ol>
  </section>

  {#if mnt.subscribed}
    <p class="sv-mnt-ok">We will email <b>{mnt.subscribed}</b> as soon as sign-in reopens.</p>
  {:else}
    <form class="sv-mnt-notify" {...mnt.formProps()}>
      <SvTextInput label="Email me when it's back" type="email" placeholder="you@company.com" bind:value={mnt.email} invalid={!!mnt.error} error={mnt.error} autocomplete="email" block />
      <SvButton type="submit" variant="primary" loading={mnt.sending}>Notify me</SvButton>
    </form>
  {/if}

  <p class="sv-mnt-foot sv-mnt-muted">Live updates on <a href="https://status.example.com" target="_blank" rel="noreferrer">status.example.com</a></p>
</main>

<SvToaster position="bottom-right" />

<style>
  .sv-mnt { display: flex; flex-direction: column; gap: 22px; max-width: 600px; margin: 0 auto; padding: 44px 24px; min-height: 560px; box-sizing: border-box; color: var(--sg-fg, #0f172a); }
  h2 { margin: 12px 0 8px; font-size: 27px; line-height: 1.2; letter-spacing: -.02em; }
  .sv-mnt-muted { margin: 0; color: var(--sg-muted, #64748b); font-size: 14.5px; line-height: 1.55; }
  .sv-mnt-eta { display: flex; flex-direction: column; gap: 14px; padding: 20px; background: var(--sg-bg-subtle, #f8fafc); border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px); }
  .sv-mnt-eta-top { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
  .sv-mnt-lbl { display: block; font-size: 12px; color: var(--sg-muted, #64748b); }
  .sv-mnt-lbl b { color: var(--sg-fg, #0f172a); font-weight: 600; }
  .sv-mnt-clock { display: block; margin-top: 2px; font-size: 34px; font-weight: 700; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
  ol { list-style: none; margin: 4px 0 0; padding: 0; display: grid; gap: 8px; font-size: 13.5px; color: var(--sg-muted, #64748b); }
  li { display: flex; align-items: center; gap: 10px; }
  .sv-mnt-dot { flex: none; display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; font-size: 11px; font-weight: 700; border: 1.5px solid var(--sg-border, #cbd5e1); }
  li.sv-mnt-done { color: var(--sg-fg, #0f172a); }
  li.sv-mnt-done .sv-mnt-dot { color: var(--sg-success, #16a34a); border-color: currentColor; background: color-mix(in srgb, var(--sg-success, #16a34a) 14%, transparent); }
  li.sv-mnt-now { color: var(--sg-fg, #0f172a); font-weight: 600; }
  li.sv-mnt-now .sv-mnt-dot { border-color: var(--sg-warning, #d97706); border-top-color: transparent; animation: sv-mnt-spin 1s linear infinite; }
  .sv-mnt-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .sv-mnt-notify { display: flex; align-items: flex-start; gap: 8px; }
  .sv-mnt-notify > :global(:first-child) { flex: 1; min-width: 0; }
  .sv-mnt-notify > :global(.sv-btn) { margin-top: 21px; height: 34px; }
  .sv-mnt-ok { margin: 0; padding: 12px 14px; font-size: 14px; border-radius: var(--sg-radius, 8px); background: color-mix(in srgb, var(--sg-success, #16a34a) 12%, transparent); border: 1px solid color-mix(in srgb, var(--sg-success, #16a34a) 30%, transparent); }
  .sv-mnt-foot { font-size: 13px; }
  .sv-mnt-foot a { color: var(--sg-fg, #0f172a); text-underline-offset: 3px; }
  @keyframes sv-mnt-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { li.sv-mnt-now .sv-mnt-dot { animation: none; } }

  @media (max-width: 520px) {
    .sv-mnt { padding: 28px 16px; gap: 18px; }
    h2 { font-size: 22px; }
    .sv-mnt-eta { padding: 16px; }
    .sv-mnt-clock { font-size: 28px; }
    .sv-mnt-notify { flex-direction: column; align-items: stretch; }
    .sv-mnt-notify > :global(.sv-btn) { margin-top: 0; }
  }
</style>
