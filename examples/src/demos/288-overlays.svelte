<script lang="ts">
  /**
   * SvPopover, SvTooltip and SvModal - the overlay trio. All portal to <body>
   * (never clipped), animate in, and share the popover positioning engine. The
   * modal is optionally draggable (by its header) and resizable (bottom-right).
   */
  import { SvPopover, SvTooltip, SvModal, SvButton } from '@svgrid/grid'

  let modalOpen = $state(false)
  let draggable = $state(true)
  let resizable = $state(true)
</script>

<div class="wrap">
  <header>
    <h2>Overlays</h2>
    <p>Popover, tooltip and modal - portalled, animated, keyboard-accessible (Escape to close, focus-trapped modal).</p>
  </header>

  <section>
    <h3>Tooltip</h3>
    <p class="row">
      Hover or focus these:
      <SvTooltip text="Save the current record (Ctrl+S)"><SvButton size="sm">Save</SvButton></SvTooltip>
      <SvTooltip text="This permanently deletes the row" placement="bottom"><SvButton size="sm" variant="danger">Delete</SvButton></SvTooltip>
    </p>
  </section>

  <section>
    <h3>Popover</h3>
    <SvPopover minWidth={240}>
      {#snippet anchor()}<SvButton>Filter options</SvButton>{/snippet}
      <div class="pop">
        <strong>Quick filter</strong>
        <label><input type="checkbox" checked /> Active only</label>
        <label><input type="checkbox" /> Include archived</label>
        <p class="muted">Click outside or press Escape to dismiss.</p>
      </div>
    </SvPopover>
  </section>

  <section>
    <h3>Modal</h3>
    <div class="row">
      <SvButton onclick={() => (modalOpen = true)}>Open modal</SvButton>
      <label class="chk"><input type="checkbox" bind:checked={draggable} /> Draggable</label>
      <label class="chk"><input type="checkbox" bind:checked={resizable} /> Resizable</label>
    </div>

    <SvModal bind:open={modalOpen} title="Edit item" {draggable} {resizable}>
      <p>Drag me by the header{resizable ? ', or resize from the bottom-right corner' : ''}. Focus is trapped inside, and Escape or the backdrop closes me.</p>
      <label class="field">Name<input type="text" value="Acme Corp" /></label>
      <label class="field">Notes<textarea rows="3">A preferred vendor.</textarea></label>
      {#snippet footer()}
        <SvButton variant="ghost" onclick={() => (modalOpen = false)}>Cancel</SvButton>
        <SvButton onclick={() => (modalOpen = false)}>Save</SvButton>
      {/snippet}
    </SvModal>
  </section>
</div>

<style>
  .wrap { padding: 20px; max-width: 820px; display: flex; flex-direction: column; gap: 20px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  section h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 13.5px; }
  .chk { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--sg-muted, #64748b); }
  .pop { display: flex; flex-direction: column; gap: 8px; }
  .pop label { display: flex; align-items: center; gap: 7px; font-size: 13px; }
  .muted { color: var(--sg-muted, #94a3b8); font-size: 12px; margin: 4px 0 0; }
  .field { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; font-weight: 600; color: var(--sg-muted, #64748b); margin-top: 12px; }
  .field input, .field textarea { font: inherit; font-size: 13px; padding: 7px 10px; border: 1px solid var(--sg-input-border, #cbd5e1); border-radius: 7px; background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a); font-weight: 400; }
</style>
