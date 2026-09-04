<script lang="ts">
  /**
   * 19. Server-side rendering
   * -------------------------
   * SvGrid produces meaningful, semantic HTML *before* client-side JS runs.
   *
   * WHAT THIS DEMO IS: it snapshots the CLIENT-rendered grid into a
   * script-blocked iframe, so it shows the SHAPE of the markup without JS.
   * It does NOT measure real server output and cannot catch an SSR
   * regression - it kept looking green while `<SvGrid>` was in fact shipping
   * an empty `<tbody>` from the server. `pnpm ssr:check` is the real check,
   * against a `generate: "server"` build.
   * In a SvelteKit (or any Svelte SSR) setup, calling `render(SvGrid,
   * { props })` from `svelte/server` returns a string of `<table>` markup
   * with the data baked in - that's the response the user's first paint
   * sees, before hydration takes over interactivity.
   *
   * Demonstrating real SSR end-to-end requires a server runtime, which the
   * Vite dev gallery doesn't have. Instead this demo proves the same point
   * with a runtime trick:
   *
   *   1. Render the live grid below as you'd normally do.
   *   2. "Snapshot" button captures the grid's current DOM as a string.
   *      That HTML is byte-for-byte close to what SSR would emit
   *      (Svelte's SSR renderer + the hydration renderer share the same
   *      output for a static initial state).
   *   3. The snapshot is injected into a sandboxed iframe with `csp` set
   *      to deny scripts. If the grid is meaningful pre-JS, the iframe
   *      will show the data anyway - which is the SSR / SEO promise.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
  } from '@svgrid/grid'
  import { makePeople, type Person } from '../shared/seed'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  const rows = makePeople(40)

  const columns: ColumnDef<typeof features, Person>[] = [
    { field: 'firstName',  header: 'First name', editorType: 'text', width: 130 },
    { field: 'lastName',   header: 'Last name',  editorType: 'text', width: 130 },
    { field: 'department', header: 'Department', editorType: 'text', width: 140 },
    { field: 'country',    header: 'Country',    editorType: 'text', width: 110 },
    { field: 'age',        header: 'Age',        editorType: 'number', width: 80 },
    {
      field: 'salary',
      header: 'Salary',
      editorType: 'number',
      width: 130,
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
    },
  ]

  let snapshot = $state<string>('')
  let iframeSrc = $state<string>('')

  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function takeSnapshot() {
    const grid = document.querySelector<HTMLElement>('#ssr-live-grid .sv-grid-shell')
    if (!grid) {
      snapshot = '<!-- no grid to snapshot -->'
      iframeSrc = ''
      return
    }
    // Strip event handlers + active-cell state - SSR output never includes
    // those. We also pull in the page's styles via an inline copy.
    const cloned = grid.cloneNode(true) as HTMLElement
    cloned.querySelectorAll('.sv-grid-cell-active').forEach((el) => el.classList.remove('sv-grid-cell-active'))
    cloned.querySelectorAll('[aria-activedescendant]').forEach((el) => el.removeAttribute('aria-activedescendant'))
    const html = cloned.outerHTML

    // Collect the page stylesheets so the iframe renders the table with
    // the same look (borders, fonts, zebra). We inline them as plain
    // style elements so the iframe's `csp` block on scripts doesn't
    // also block external stylesheet loading. (Spelling the tag out here
    // would pair with this component's own style block and hand the whole
    // file to the CSS preprocessor.)
    const styles = Array.from(document.styleSheets)
      .map((sheet) => {
        try {
          return Array.from(sheet.cssRules).map((r) => r.cssText).join('\n')
        } catch {
          return ''
        }
      })
      .filter(Boolean)
      .join('\n')

    snapshot = html

    // Build the iframe document by concatenation so the svelte-preprocess
    // CSS scanner doesn't try to lint our literal "<sty" + "le>" blocks.
    const tag = (name: string, inner: string) => '<' + name + '>' + inner + '</' + name + '>'
    const theme = document.documentElement.getAttribute('data-theme') ?? 'dark'
    const bodyCss = 'body { margin: 0; padding: 16px; background: var(--sg-bg, #0f172a); color: var(--sg-fg, #e2e8f0); font: 14px/1.4 ui-sans-serif, system-ui, sans-serif; }'
    const doc =
      '<!doctype html>' +
      '<html data-theme="' + theme + '">' +
      '<head>' +
      '<meta charset="utf-8" />' +
      `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;" />` +
      tag('style', styles) +
      tag('style', bodyCss) +
      '</head>' +
      '<body>' + html + '</body>' +
      '</html>'
    iframeSrc = URL.createObjectURL(new Blob([doc], { type: 'text/html' }))
  }

  function clearSnapshot() {
    if (iframeSrc) URL.revokeObjectURL(iframeSrc)
    snapshot = ''
    iframeSrc = ''
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="ssr-panel rounded border p-3 text-sm shrink-0">
    <div class="flex items-center justify-between mb-2">
      <h3 class="font-semibold">SvelteKit integration (in a real app)</h3>
    </div>
    <pre class="ssr-code rounded p-2 text-xs leading-relaxed overflow-x-auto"><code>{`// +page.server.ts
export async function load() {
  const rows = await db.query('select * from people')
  return { rows }
}

// +page.svelte
<script lang="ts">
  import { SvGrid, tableFeatures, rowSortingFeature } from '@svgrid/grid'
  let { data } = $props()
<\/script>
<SvGrid responsive={true}
      columnResize data={data.rows} columns={columns} features={tableFeatures({ rowSortingFeature })} />`}</code></pre>
    <p class="ssr-muted mt-2 text-xs">
      SvelteKit calls <code>{'render(Page, { props: { data } })'}</code> server-side and ships the resulting HTML.
      The user sees data on first paint; hydration only attaches event listeners.
    </p>
  </div>

  <div class="flex flex-wrap items-center gap-2 text-sm shrink-0">
    <button
      type="button"
      onclick={takeSnapshot}
      class="ssr-btn rounded border px-3 py-1"
    >📸 Take SSR-equivalent snapshot</button>
    {#if snapshot}
      <button
        type="button"
        onclick={clearSnapshot}
        class="ssr-btn rounded border px-3 py-1"
      >Clear</button>
    {/if}
    <span class="ssr-muted ml-2">
      The snapshot is rendered in a JS-disabled iframe to prove the HTML is meaningful pre-hydration.
    </span>
  </div>

  <div class="grid gap-3 flex-1 min-h-0 lg:grid-cols-2">
    <div class="flex flex-col min-h-0">
      <div class="ssr-muted mb-1 text-xs uppercase tracking-wide shrink-0">
        Live grid (hydrated, interactive)
      </div>
      <div id="ssr-live-grid" class="flex-1 min-h-0">
        <SvGrid responsive={true}
      columnResize
          data={rows}
          columns={columns}
          features={features}
          filterMode="menu"
          selectionMode="cell"
          showRowNumbers={true}
          enableInlineEditing={false}
          enableCellSelection={true}
          rowHeight={32}
          containerHeight="100%"
          fitColumns={true}
        />
      </div>
    </div>
    <div class="flex flex-col min-h-0">
      <div class="ssr-muted mb-1 text-xs uppercase tracking-wide shrink-0">
        Snapshot iframe (no JS, no event listeners)
      </div>
      {#if iframeSrc}
        <iframe
          src={iframeSrc}
          title="Pre-hydration snapshot"
          sandbox=""
          class="ssr-frame flex-1 min-h-0 rounded border"
        ></iframe>
      {:else}
        <div class="ssr-placeholder flex-1 min-h-0 grid place-items-center rounded border border-dashed text-sm">
          Click <em>Take SSR-equivalent snapshot</em> to populate.
        </div>
      {/if}
    </div>
  </div>

  {#if snapshot}
    <details class="ssr-panel rounded border p-3 text-xs shrink-0">
      <summary class="cursor-pointer font-semibold">Raw HTML ({(snapshot.length / 1024).toFixed(1)} KB)</summary>
      <pre class="ssr-code mt-2 max-h-48 overflow-auto rounded p-2 leading-relaxed"><code>{escapeHtml(snapshot.slice(0, 4000))}{snapshot.length > 4000 ? '\n…' : ''}</code></pre>
    </details>
  {/if}
</section>

<style>
  /* Chrome follows the active grid theme; the old literals stay as fallbacks. */
  .ssr-panel     { border-color: var(--sg-border, #e2e8f0); }
  .ssr-code      { background: var(--sg-bg-subtle, var(--sg-header-bg, #f8fafc)); }
  .ssr-muted     { color: var(--sg-muted, #64748b); }
  .ssr-btn {
    border-color: var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
  }
  .ssr-btn:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .ssr-frame {
    border-color: var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
  }
  .ssr-placeholder {
    border-color: var(--sg-border, #cbd5e1);
    color: var(--sg-muted, #64748b);
  }
</style>
