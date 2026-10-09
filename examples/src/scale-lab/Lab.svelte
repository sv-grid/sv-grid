<script lang="ts">
  import { onMount } from 'svelte'
  import './lab.css'
  import ServerScroll from './ServerScroll.svelte'
  import SqlLoad from './SqlLoad.svelte'
  import ClientMillion from './ClientMillion.svelte'
  import WideGrid from './WideGrid.svelte'
  import ExportImport from './ExportImport.svelte'

  /**
   * `syncHash` keeps the active tab in the URL hash. Only the standalone
   * /scale-lab.html page turns it on: inside the gallery the hash is the
   * gallery's router, so the tabs stay local state there.
   */
  let { syncHash = false }: { syncHash?: boolean } = $props()

  const TABS = [
    { id: 'scroll', label: 'Server scrolling', component: ServerScroll },
    { id: 'sql', label: 'SQL backend load', component: SqlLoad },
    { id: 'client', label: '1M rows in the browser', component: ClientMillion },
    { id: 'wide', label: 'Wide grids', component: WideGrid },
    { id: 'io', label: 'Export', component: ExportImport },
  ] as const

  type TabId = (typeof TABS)[number]['id']
  const fromHash = (): TabId => {
    const h = location.hash.slice(1)
    return (TABS.find((t) => t.id === h)?.id ?? 'scroll') as TabId
  }
  let active = $state<TabId>(syncHash ? fromHash() : 'scroll')
  const current = $derived(TABS.find((t) => t.id === active)!)

  function pick(id: TabId) {
    active = id
    if (syncHash) history.replaceState(null, '', `#${id}`)
  }

  onMount(() => {
    if (!syncHash) return
    const onHash = () => { active = fromHash() }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  })
</script>

<div class="lab">
  <!-- The gallery prints the demo's own title and blurb; the standalone page needs its own. -->
  {#if syncHash}
    <h1>Scale lab</h1>
    <p class="lede">
      Five places where SvGrid slows down or stops under heavy use, each run live against generated data in
      this browser. Pick a tab, press its button, and read what it measured. Only one tab is mounted at a time.
      The dev server runs slower than a production build, so compare runs on the same build.
    </p>
  {/if}

  <div class="tabs" role="tablist">
    {#each TABS as t (t.id)}
      <button role="tab" aria-selected={active === t.id} onclick={() => pick(t.id)}>{t.label}</button>
    {/each}
  </div>

  {#key active}
    <current.component />
  {/key}
</div>
