<script lang="ts" module>
  /**
   * 404 with helpful links block - a "page not found" screen that helps the
   * visitor recover: a site search SvTextInput with a leading icon (typing
   * filters the list, submitting fires a toast) and a nav list of popular
   * destinations, each with an icon, title, one-line description and chevron.
   * SvButton submits, SvBadge tags the error. Pure UI-kit, --sg-* themed.
   *
   * Headless: createRecoverySearch() below owns the query, its validation and
   * the filtered destination list with no markup. The component under it is
   * one styled render of that core; import createRecoverySearch from this file
   * (or `npx @svgrid/ui add error-pages-404-links --headless` for the core
   * alone) to draw your own.
   */
  /** `icon` is one 16x16 stroke path. */
  export type Destination = { href: string; title: string; text: string; icon: string }
  export type RecoverySearchOptions = {
    /** Popular pages to offer. Defaults to the sections of a field-service app. */
    destinations?: Destination[]
    /** Called with the trimmed query, e.g. goto(`/search?q=...`). */
    onSearch?: (query: string) => void
    /** Called when a destination link is clicked; call ev.preventDefault() to
     *  handle navigation yourself. */
    onOpen?: (dest: Destination, ev: MouseEvent) => void
  }

  const SAMPLE_DESTINATIONS: Destination[] = [
    { href: '/dashboard', title: 'Dashboard', text: 'Open jobs, crew status and today\'s schedule.', icon: 'M2 2h5v6H2zM9 2h5v3H9zM9 7h5v7H9zM2 10h5v4H2z' },
    { href: '/jobs', title: 'Jobs', text: 'Every work order, filtered by site and status.', icon: 'M3 3h10v10H3zM6 6.5h4M6 9.5h4' },
    { href: '/crews', title: 'Crews', text: 'Who is on shift, and where they are headed next.', icon: 'M6 7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.5 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4M11 6.5a2 2 0 1 0 0-4M12 10c1.5.3 2.5 1.7 2.5 4' },
    { href: '/reports', title: 'Reports', text: 'Weekly hours, travel time and SLA breaches.', icon: 'M2 14h12M4 11V7M8 11V3M12 11V8' },
    { href: '/help', title: 'Help center', text: 'Guides for dispatchers and field technicians.', icon: 'M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM6.2 6.2a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.4M8 11.5v.1' },
  ]

  export function createRecoverySearch(opts: RecoverySearchOptions = {}) {
    const destinations = opts.destinations ?? SAMPLE_DESTINATIONS
    let query = $state('')
    let error = $state<string | undefined>(undefined)

    const q = $derived(query.trim().toLowerCase())
    const shown = $derived(
      q ? destinations.filter((d) => (d.title + ' ' + d.text).toLowerCase().includes(q)) : destinations,
    )

    function search(ev?: Event) {
      ev?.preventDefault()
      if (!q) { error = 'Type what you were looking for.'; return }
      error = undefined
      opts.onSearch?.(query.trim())
    }

    const open = (d: Destination, ev: MouseEvent) => opts.onOpen?.(d, ev)

    return {
      get query() { return query },
      set query(v: string) { query = v; error = undefined },
      get error() { return error },
      /** True while the query narrows the list. */
      get filtering() { return q !== '' },
      get shown() { return shown },
      search,
      open,
      /** Spread on your <form>. */
      formProps: () => ({ novalidate: true, onsubmit: search }),
      /** Spread on the <a> of one destination. */
      linkProps: (d: Destination) => ({ href: d.href, onclick: (ev: MouseEvent) => open(d, ev) }),
    }
  }
</script>

<script lang="ts">
  import { SvTextInput, SvButton, SvBadge, SvToaster, toast } from '@svgrid/grid'

  const recover = createRecoverySearch({
    // Swap for goto(`/search?q=${encodeURIComponent(query)}`).
    onSearch: (query) => toast.info(`Searching Fieldline for "${query}"`),
    onOpen: (d, e) => {
      // Demo only: announce instead of leaving the gallery. Delete to follow the href.
      e.preventDefault()
      toast(`Opening ${d.title}`)
    },
  })
</script>

<main class="sv-recover">
  <header>
    <SvBadge variant="danger" pill>404</SvBadge>
    <h2>We can't find that page</h2>
    <p class="sv-recover-muted">The link may be old, or the page moved. Search for it, or pick up from one of these.</p>
  </header>

  <form class="sv-recover-search" {...recover.formProps()}>
    <SvTextInput
      label="Search Fieldline"
      type="search"
      placeholder="Jobs, crews, reports..."
      bind:value={recover.query}
      invalid={!!recover.error}
      error={recover.error}
      block
    >
      {#snippet leading()}
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M7 12.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11ZM11 11l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
      {/snippet}
    </SvTextInput>
    <SvButton type="submit" variant="primary">Search</SvButton>
  </form>

  <nav aria-label="Popular pages">
    <h3>{recover.filtering ? `Pages matching "${recover.query.trim()}"` : 'Popular pages'}</h3>
    {#if recover.shown.length}
      <ul>
        {#each recover.shown as d (d.href)}
          <li>
            <a {...recover.linkProps(d)}>
              <span class="sv-recover-tile"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d={d.icon} fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
              <span class="sv-recover-txt"><strong>{d.title}</strong><span>{d.text}</span></span>
              <svg class="sv-recover-chev" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="m6 3.5 4.5 4.5L6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </a>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="sv-recover-empty">No page titles match. Press Search to look through all of Fieldline.</p>
    {/if}
  </nav>
</main>

<SvToaster position="bottom-right" />

<style>
  .sv-recover {
    display: flex;
    flex-direction: column;
    gap: 24px;
    max-width: 620px;
    margin: 0 auto;
    padding: 48px 24px;
    min-height: 560px;
    box-sizing: border-box;
    color: var(--sg-fg, #0f172a);
  }
  h2 { margin: 12px 0 6px; font-size: 28px; letter-spacing: -.02em; }
  .sv-recover-muted { margin: 0; color: var(--sg-muted, #64748b); font-size: 14.5px; line-height: 1.55; }
  .sv-recover-search { display: flex; align-items: flex-start; gap: 8px; }
  .sv-recover-search > :global(:first-child) { flex: 1; min-width: 0; }
  /* Line the button up with the input box, below the field label. */
  .sv-recover-search > :global(.sv-btn) { margin-top: 21px; height: 34px; }
  h3 { margin: 0 0 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--sg-muted, #64748b); }
  ul { list-style: none; margin: 0; padding: 0; border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px); overflow: hidden; background: var(--sg-bg, #fff); }
  li + li { border-top: 1px solid var(--sg-border, #e2e8f0); }
  a { display: flex; align-items: center; gap: 14px; padding: 12px 14px; color: inherit; text-decoration: none; }
  a:hover { background: var(--sg-row-hover-bg, #f8fafc); }
  a:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #4f46e5)); outline-offset: -2px; }
  .sv-recover-tile { flex: none; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 9px; color: var(--sg-fg, #0f172a); background: color-mix(in srgb, var(--sg-fg, #0f172a) 7%, var(--sg-bg, #fff)); border: 1px solid var(--sg-border, #e2e8f0); }
  .sv-recover-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .sv-recover-txt strong { font-size: 14px; font-weight: 600; }
  .sv-recover-txt span { font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-recover-chev { flex: none; color: var(--sg-muted, #94a3b8); }
  a:hover .sv-recover-chev { color: var(--sg-fg, #0f172a); }
  .sv-recover-empty { margin: 0; padding: 18px; text-align: center; font-size: 13.5px; color: var(--sg-muted, #64748b); border: 1px dashed var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px); }

  @media (max-width: 520px) {
    .sv-recover { padding: 28px 16px; gap: 20px; }
    h2 { font-size: 23px; }
    .sv-recover-search { flex-direction: column; align-items: stretch; }
    .sv-recover-search > :global(.sv-btn) { margin-top: 0; }
  }
</style>
