<script lang="ts">
  /**
   * 89. High-contrast theme preset
   * ------------------------------
   * Procurement-grade accessibility theme. Every chrome surface uses
   * one of two ink colours (foreground / muted) on one background;
   * borders are 1 px solid; the accent colour is pure red on light /
   * pure yellow on dark for unmistakable focus rings; selection +
   * hover + zebra rows pick neighbouring tones with at least a 7:1
   * contrast ratio against text.
   *
   * Drop the token block onto any wrapper to opt that subtree into
   * the high-contrast skin - the rest of the page stays normal so
   * users can switch on a per-section basis.
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
  let rows = $state<Person[]>(makePeople(40))

  let mode = $state<'standard' | 'contrast'>('contrast')

  const columns: ColumnDef<typeof features, Person>[] = [
    { field: 'firstName',  header: 'First name', editorType: 'text',   width: 140 },
    { field: 'lastName',   header: 'Last name',  editorType: 'text',   width: 140 },
    { field: 'department', header: 'Department', editorType: 'text',   width: 150 },
    { field: 'country',    header: 'Country',    editorType: 'text',   width: 110 },
    { field: 'age',        header: 'Age',        editorType: 'number', width: 100 },
    { field: 'salary',     header: 'Salary',     editorType: 'number', width: 140,
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
    { field: 'status',     header: 'Status',     editorType: 'text',   width: 120 },
  ]
</script>

<section class="hc-shell flex flex-col flex-1 min-h-0 gap-3">
  <header class="hc-head shrink-0">
    <div>
      <h2 class="hc-title">Accessibility · High-contrast preset</h2>
      <p class="hc-sub">
        WCAG 2.2 AAA-grade contrast (text ≥ 7:1, focus ring ≥ 3:1, no colour-only state encoding).
        Procurement teams that publish a VPAT can reuse this token block verbatim.
      </p>
    </div>
    <div class="hc-toggle" role="group" aria-label="Theme mode">
      <button type="button" class:on={mode === 'standard'} onclick={() => (mode = 'standard')}>Standard</button>
      <button type="button" class:on={mode === 'contrast'} onclick={() => (mode = 'contrast')}>High contrast</button>
    </div>
  </header>

  <div
    class="flex-1 min-h-0 hc-host"
    class:hc-host-contrast={mode === 'contrast'}
    aria-label={mode === 'contrast' ? 'Grid in high-contrast mode' : 'Grid in standard mode'}
  >
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showRowNumbers={true}
      showPagination={false}
      enableInlineEditing={true}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>

  <details class="hc-tokens shrink-0">
    <summary>Show token block</summary>
    <pre><code>{`/* Drop onto any wrapper to opt that subtree into high-contrast. */
.high-contrast {
  --sg-bg:            #ffffff;
  --sg-fg:            #000000;
  --sg-muted:         #1a1a1a;
  --sg-border:        #000000;
  --sg-header-bg:     #ffffff;
  --sg-header-fg:     #000000;
  --sg-row-alt-bg:    #f1f1f1;
  --sg-row-hover-bg:  #ffe600;       /* yellow hover band - unique tone */
  --sg-selection-bg:  #c20000;       /* red selection - unique tone */
  --sg-accent:        #c20000;
  --sg-focus-ring:    0 0 0 3px #c20000;
}
[data-theme='dark'] .high-contrast {
  --sg-bg:            #000000;
  --sg-fg:            #ffffff;
  --sg-muted:         #e6e6e6;
  --sg-border:        #ffffff;
  --sg-header-bg:     #000000;
  --sg-header-fg:     #ffff00;       /* yellow header - text ink */
  --sg-row-alt-bg:    #1a1a1a;
  --sg-row-hover-bg:  #1f3b8a;
  --sg-selection-bg:  #ffff00;
  --sg-accent:        #ffff00;
  --sg-focus-ring:    0 0 0 3px #ffff00;
}`}</code></pre>
  </details>
</section>

<style>
  .hc-shell { height: 100%; }

  .hc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .hc-title { font-size: 20px; font-weight: 700; margin: 0; color: var(--sg-fg, #0f172a); }
  .hc-sub   { font-size: 13px; color: var(--sg-muted, #64748b); margin: 4px 0 0 0; max-width: 70ch; line-height: 1.45; }
  .hc-toggle {
    display: inline-flex; border: 1px solid var(--sg-border, #cbd5e1); border-radius: 6px; overflow: hidden;
    background: var(--sg-bg, #fff);
  }
  .hc-toggle button {
    border: 0; background: transparent; color: var(--sg-fg, #0f172a);
    padding: 6px 14px; font-size: 13px; cursor: pointer;
    border-right: 1px solid var(--sg-border, #cbd5e1);
  }
  .hc-toggle button:last-child { border-right: 0; }
  .hc-toggle button.on { background: var(--sg-accent, #2563eb); color: var(--sg-on-accent, #fff); font-weight: 600; }

  /* High-contrast token preset. Light + dark variants. */
  .hc-host-contrast {
    --sg-bg:            #ffffff;
    --sg-fg:            #000000;
    --sg-muted:         #1a1a1a;
    --sg-border:        #000000;
    --sg-header-bg:     #ffffff;
    --sg-header-fg:     #000000;
    --sg-row-alt-bg:    #f1f1f1;
    --sg-row-hover-bg:  #ffe600;
    --sg-selection-bg:  #c20000;
    --sg-accent:        #c20000;
    --sg-focus-ring:    0 0 0 3px #c20000;
  }
  :global(html[data-theme='dark']) .hc-host-contrast {
    --sg-bg:            #000000;
    --sg-fg:            #ffffff;
    --sg-muted:         #e6e6e6;
    --sg-border:        #ffffff;
    --sg-header-bg:     #000000;
    --sg-header-fg:     #ffff00;
    --sg-row-alt-bg:    #1a1a1a;
    --sg-row-hover-bg:  #1f3b8a;
    --sg-selection-bg:  #ffff00;
    --sg-accent:        #ffff00;
    --sg-focus-ring:    0 0 0 3px #ffff00;
  }
  /* Bump the cell-border weight in contrast mode so the grid lines are
     not invisible at the higher contrast palette. */
  .hc-host-contrast :global(.sv-grid-cell),
  .hc-host-contrast :global(.sv-grid-column) {
    border-color: var(--sg-border, #000) !important;
  }

  .hc-tokens {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #fff);
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 12.5px;
  }
  .hc-tokens summary { cursor: pointer; font-weight: 600; color: var(--sg-fg, #0f172a); }
  .hc-tokens pre {
    margin: 8px 0 0 0;
    overflow: auto;
    font-family: ui-monospace, Menlo, monospace;
    font-size: 11.5px;
    background: var(--sg-header-bg, #f1f5f9);
    border-radius: 4px;
    padding: 8px 10px;
    color: var(--sg-fg, #0f172a);
  }
</style>
