<script lang="ts">
  /**
   * A browser window around the real component. The preset names what the
   * editor scene "wrote", so the frame shows what that code renders.
   */
  import { SvGrid } from '@svgrid/grid'
  import { SvSheet, createWorkbook } from '@svgrid/enterprise'
  import { stage } from '../state.svelte'
  import { firstGrid, minimalTemplate, sheetBudget } from '../presets'
  import Window from './Window.svelte'

  const wb = $derived(stage.browser.preset === 'sheet-budget' ? createWorkbook(sheetBudget) : null)
</script>

<Window>
  {#snippet bar()}
    <span class="br-nav" aria-hidden="true"><i></i><i></i></span>
    <span class="br-url">{stage.browser.url}</span>
  {/snippet}
  <div class="br" class:is-loading={stage.browser.loading}>
    {#key stage.browser.key}
      {#if stage.browser.loading}
        <div class="br-blank"></div>
      {:else if stage.browser.preset === 'first-grid'}
        <div class="br-page br-page-plain">
          <SvGrid data={firstGrid.rows} columns={firstGrid.columns} />
        </div>
      {:else if stage.browser.preset === 'minimal-template'}
        <div class="br-page">
          <header class="br-page-head">
            <div>
              <h1>SvGrid</h1>
              <p>Sort, filter, select, and double-click a cell to edit. Edit <code>src/App.svelte</code> to make it yours.</p>
            </div>
            <button type="button">Light</button>
          </header>
          <div class="br-grid">
            <SvGrid
              data={minimalTemplate.rows}
              columns={minimalTemplate.columns}
              sortable
              filterable
              editable
              selectionMode="row"
              showRowSelection={true}
              showRowNumbers={true}
              rowHeight={38}
              containerHeight="100%"
              fitColumns={true}
            />
          </div>
        </div>
      {:else if stage.browser.preset === 'sheet-budget' && wb}
        <div class="br-sheet">
          <SvSheet workbook={wb} height="100%" />
        </div>
      {:else}
        <div class="br-blank"></div>
      {/if}
    {/key}
  </div>
</Window>

<style>
  .br-nav { display: inline-flex; gap: 8px; }
  .br-nav i { width: 8px; height: 8px; border: 2px solid #57534e; border-width: 2px 0 0 2px; transform: rotate(-45deg); display: block; margin-top: 2px; }
  .br-nav i + i { transform: rotate(135deg); }
  .br-url {
    flex: 1;
    max-width: 520px;
    margin: 0 auto;
    padding: 5px 14px;
    border-radius: 999px;
    background: var(--sg-bg, #0c0a09);
    color: #d6d3d1;
    font-size: 13px;
    text-align: center;
  }
  .br {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--sg-bg, #0c0a09);
  }
  .br-blank { flex: 1; }
  .br-page {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 22px 26px;
    gap: 16px;
  }
  .br-page-plain { padding: 28px 30px; }
  .br-page-plain :global(.sv-grid-root) { max-width: 560px; }
  .br-page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .br-page-head h1 { margin: 0 0 4px; font-size: 22px; font-weight: 700; }
  .br-page-head p { margin: 0; font-size: 13px; color: var(--sg-muted, #a8a29e); max-width: 520px; }
  .br-page-head code { font-size: 12px; }
  .br-page-head button {
    padding: 6px 12px;
    border: 1px solid var(--sg-border, #292524);
    border-radius: 8px;
    background: transparent;
    color: var(--sg-fg, #fafaf9);
    font-size: 13px;
  }
  .br-grid { flex: 1; min-height: 0; }
  .br-sheet { flex: 1; min-height: 0; display: flex; }
  .br-sheet > :global(*) { flex: 1; min-height: 0; }
</style>
