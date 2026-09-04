<script lang="ts">
  /**
   * 79. Loading from REST
   * ---------------------
   * The everyday "fetch JSON, render rows" pattern, with the four states
   * every real LOB app needs:
   *
   *   1. Loading - a skeleton grid so the layout doesn't jump
   *   2. Error   - typed error surface with a retry button
   *   3. Empty   - the API succeeded but returned nothing
   *   4. Ready   - rows mounted, sort / filter / scroll wired
   *
   * The endpoint is public (jsonplaceholder.typicode.com), so this works
   * offline-of-your-backend during a demo and can be swapped for your own
   * fetch + auth headers in one place. Aborts in flight on unmount so a
   * fast reload doesn't leak a stale fetch.
   */
  import { onDestroy } from 'svelte'
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  // The shape returned by https://jsonplaceholder.typicode.com/users
  type Geo = { lat: string; lng: string }
  type Address = { street: string; suite: string; city: string; zipcode: string; geo: Geo }
  type Company = { name: string; catchPhrase: string; bs: string }
  type ApiUser = {
    id: number
    name: string
    username: string
    email: string
    phone: string
    website: string
    address: Address
    company: Company
  }

  // The flattened shape we render. Keeps the grid columns 1-to-1 with
  // fields and lets sort/filter work directly on the values.
  type Row = {
    id: number
    name: string
    username: string
    email: string
    phone: string
    website: string
    city: string
    zip: string
    company: string
  }

  const ENDPOINT = 'https://jsonplaceholder.typicode.com/users'

  type LoadState =
    | { phase: 'loading' }
    | { phase: 'error'; message: string; status?: number }
    | { phase: 'ready'; rows: Row[]; loadedAt: number; durationMs: number }

  let state = $state<LoadState>({ phase: 'loading' })
  let inflight: AbortController | null = null

  async function load() {
    inflight?.abort()
    inflight = new AbortController()
    state = { phase: 'loading' }
    const t0 = performance.now()
    try {
      const res = await fetch(ENDPOINT, { signal: inflight.signal })
      if (!res.ok) {
        state = { phase: 'error', message: res.statusText || 'Request failed', status: res.status }
        return
      }
      const payload = (await res.json()) as ApiUser[]
      const rows: Row[] = payload.map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        email: u.email,
        phone: u.phone,
        website: u.website,
        city: u.address.city,
        zip: u.address.zipcode,
        company: u.company.name,
      }))
      state = {
        phase: 'ready',
        rows,
        loadedAt: Date.now(),
        durationMs: Math.round(performance.now() - t0),
      }
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return
      state = {
        phase: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      }
    }
  }

  void load()

  onDestroy(() => inflight?.abort())

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'id',       header: '#',        editorType: 'number', width: 60,  editable: false },
    { field: 'name',     header: 'Name',     editorType: 'text',   width: 180 },
    { field: 'username', header: 'Username', editorType: 'text',   width: 140 },
    { field: 'email',    header: 'Email',    editorType: 'text',   width: 220 },
    { field: 'phone',    header: 'Phone',    editorType: 'text',   width: 170 },
    { field: 'website',  header: 'Website',  editorType: 'text',   width: 160 },
    { field: 'city',     header: 'City',     editorType: 'text',   width: 140 },
    { field: 'zip',      header: 'ZIP',      editorType: 'text',   width: 100 },
    { field: 'company',  header: 'Company',  editorType: 'text',   width: 180 },
  ]

  const fmtTime = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
</script>

<section class="rest-shell flex flex-col flex-1 min-h-0 gap-3">
  <!-- Status / control strip -->
  <div class="rest-bar shrink-0">
    <div class="rest-status">
      {#if state.phase === 'loading'}
        <span class="rest-dot rest-dot-loading"></span>
        <span><strong>Loading…</strong> GET {ENDPOINT}</span>
      {:else if state.phase === 'error'}
        <span class="rest-dot rest-dot-error"></span>
        <span>
          <strong>Request failed{state.status ? ` (${state.status})` : ''}.</strong>
          {state.message}
        </span>
      {:else}
        <span class="rest-dot rest-dot-ok"></span>
        <span>
          <strong>{state.rows.length}</strong> rows · fetched in <strong>{state.durationMs} ms</strong>
          · {fmtTime.format(state.loadedAt)}
        </span>
      {/if}
    </div>

    <div class="rest-actions">
      <code class="rest-endpoint">{ENDPOINT}</code>
      <button
        type="button"
        class="rest-btn"
        onclick={() => load()}
        disabled={state.phase === 'loading'}
      >
        {state.phase === 'loading' ? 'Loading…' : '↻ Reload'}
      </button>
    </div>
  </div>

  <!-- Body switches on phase, but always keeps a min-height so the
       loading / error / ready chrome doesn't make the page jump. -->
  <div class="flex-1 min-h-0">
    {#if state.phase === 'loading'}
      <div class="rest-skeleton" aria-hidden="true">
        <div class="rest-skel-head"></div>
        {#each Array(10) as _, i}
          <div class="rest-skel-row" style={`animation-delay: ${i * 60}ms`}></div>
        {/each}
      </div>
    {:else if state.phase === 'error'}
      <div class="rest-error">
        <div class="rest-error-title">Could not load data</div>
        <p class="rest-error-msg">
          {state.message}{state.status ? ` (HTTP ${state.status})` : ''}.
          Check your network connection or your CORS / auth setup.
        </p>
        <button type="button" class="rest-btn rest-btn-primary" onclick={() => load()}>
          Try again
        </button>
      </div>
    {:else if state.rows.length === 0}
      <div class="rest-empty">
        <div class="rest-empty-title">No records</div>
        <p>The endpoint succeeded but returned an empty list.</p>
      </div>
    {:else}
      <SvGrid responsive={true}
      columnResize
        data={state.rows}
        columns={columns}
        features={features}
        filterMode="menu"
        selectionMode="cell"
        enableInlineEditing={true}
        enableCellSelection={true}
        showRowNumbers={false}
        rowHeight={36}
        containerHeight="100%"
        fitColumns={true}
      />
    {/if}
  </div>
</section>

<style>
  .rest-shell { height: 100%; }

  .rest-bar {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 10px;
    padding: 10px 14px;
    flex-wrap: wrap;
  }
  .rest-status { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--sg-fg, #0f172a); }
  .rest-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .rest-dot-loading { background: #3b82f6; animation: rest-pulse 1.4s ease-in-out infinite; }
  .rest-dot-error   { background: #ef4444; }
  .rest-dot-ok      { background: #10b981; }
  @keyframes rest-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.4; transform: scale(1.4); }
  }
  .rest-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .rest-endpoint {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    background: var(--sg-header-bg, #f1f5f9);
    border-radius: 4px;
    padding: 2px 6px;
  }
  .rest-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border-radius: 6px;
    padding: 5px 14px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
  }
  .rest-btn:hover:not(:disabled) { background: var(--sg-row-hover-bg, rgba(148,163,184,0.10)); }
  .rest-btn:disabled { opacity: 0.55; cursor: default; }
  .rest-btn-primary {
    border-color: transparent;
    background: var(--sg-accent, #2563eb);
    color: var(--sg-on-accent, #fff);
  }
  .rest-btn-primary:hover { filter: brightness(1.06); }

  /* Skeleton grid for the loading state */
  .rest-skeleton {
    height: 100%;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    background: var(--sg-bg, #fff);
    padding: 12px;
    display: flex; flex-direction: column; gap: 8px;
    overflow: hidden;
  }
  .rest-skel-head, .rest-skel-row {
    height: 22px;
    border-radius: 6px;
    background: linear-gradient(90deg,
      var(--sg-header-bg, #f1f5f9) 0%,
      var(--sg-row-hover-bg, rgba(148,163,184,0.18)) 50%,
      var(--sg-header-bg, #f1f5f9) 100%);
    background-size: 200% 100%;
    animation: rest-shimmer 1.3s linear infinite;
  }
  .rest-skel-head { height: 28px; }
  @keyframes rest-shimmer {
    from { background-position: 200% 0; }
    to   { background-position: -200% 0; }
  }

  /* Error and empty surfaces */
  .rest-error, .rest-empty {
    height: 100%;
    border: 1px dashed var(--sg-border, #cbd5e1);
    border-radius: 10px;
    background: var(--sg-bg, #fff);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; gap: 8px; padding: 32px;
  }
  .rest-error-title, .rest-empty-title {
    font-size: 16px; font-weight: 600;
    color: var(--sg-fg, #0f172a);
  }
  .rest-error-msg {
    font-size: 13px;
    color: var(--sg-muted, #64748b);
    max-width: 420px;
    margin: 0;
  }
</style>
