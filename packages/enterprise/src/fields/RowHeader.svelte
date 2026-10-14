<script lang="ts">
  /**
   * The row-number cell with `expandRows`: the number, which on hover (or
   * while the row is selected) turns into a checkbox that selects the row,
   * and an expand button that opens the row as a record. A record with
   * comments shows how many; a click opens it at its discussion.
   */
  import { openRecord } from './editor-request.svelte'
  import { commentsOf } from './activity.svelte'

  let { ctrl, row, rowIndex }: { ctrl: any; row: { id: string; original: unknown }; rowIndex: number } = $props()

  const selected = $derived(!!ctrl.isRowSelected?.(row.id, row.original))
  const comments = $derived(commentsOf(ctrl, row.id).length)
</script>

<span class="sv-frh" class:is-selected={selected} class:has-comments={comments > 0}>
  <span class="sv-frh-num" aria-hidden="true">{rowIndex + 1}</span>
  <button
    type="button"
    class="sv-frh-check"
    role="checkbox"
    aria-checked={selected}
    aria-label={`Select row ${rowIndex + 1}`}
    onclick={(e) => {
      e.stopPropagation()
      ctrl.toggleRowSelectionById(row.id, row.original)
    }}
  >
    {#if selected}
      <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></svg>
    {/if}
  </button>
  {#if comments}
    <button
      type="button"
      class="sv-frh-comments"
      aria-label={`${comments} ${comments === 1 ? 'comment' : 'comments'} on row ${rowIndex + 1}`}
      title={`${comments} ${comments === 1 ? 'comment' : 'comments'}`}
      onclick={(e) => {
        e.stopPropagation()
        openRecord({ ctrl, rowId: row.id, focus: 'comment' })
      }}
    >
      <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path d="M2 3h12v8H8l-3 2v-2H2z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" /></svg>
      {comments}
    </button>
  {/if}
  <button
    type="button"
    class="sv-frh-expand"
    aria-label={`Expand row ${rowIndex + 1}`}
    title="Expand row"
    onclick={(e) => {
      e.stopPropagation()
      openRecord({ ctrl, rowId: row.id })
    }}
  >
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
  </button>
</span>

<style>
  .sv-frh { display: flex; align-items: center; gap: 4px; height: 100%; padding: 0 4px 0 8px; box-sizing: border-box; }
  .sv-frh-num { flex: 1; min-width: 0; text-align: center; color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }
  .sv-frh-check {
    display: none; flex: none; align-items: center; justify-content: center; width: 16px; height: 16px; padding: 0;
    border: 1.5px solid var(--sg-border, #cbd5e1); border-radius: 4px; background: var(--sg-bg, #fff); color: var(--sg-bg, #fff); cursor: pointer;
  }
  .sv-frh-check[aria-checked='true'] { border-color: var(--sg-accent, #2563eb); background: var(--sg-accent, #2563eb); }
  .sv-frh-expand {
    display: inline-flex; visibility: hidden; flex: none; align-items: center; justify-content: center; width: 20px; height: 20px; padding: 0;
    margin-inline-start: auto; border: 0; border-radius: 4px; background: none; color: var(--sg-muted, #64748b); cursor: pointer;
  }
  .sv-frh-comments {
    display: inline-flex; flex: none; align-items: center; gap: 2px; height: 18px; padding: 0 4px; border: 0; border-radius: 9px;
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 8%, transparent); color: var(--sg-fg, #0f172a);
    font: inherit; font-size: 11px; font-variant-numeric: tabular-nums; cursor: pointer;
  }
  .sv-frh-comments:hover { background: color-mix(in srgb, var(--sg-fg, #0f172a) 16%, transparent); }
  .sv-frh-expand:hover { background: var(--sg-row-hover-bg, #f1f5f9); color: var(--sg-fg, #0f172a); }
  /* Hover, keyboard focus or a selected row: the checkbox takes the number's place. */
  /* A record with comments keeps its count in the expand button's place: the
     gutter has no room for both, and the count opens the same record, at its
     discussion. */
  .sv-frh.has-comments .sv-frh-expand { display: none; }
  /* The checkbox and the count side by side: into the cell's start padding, gaps tightened. */
  :global(.sv-grid-row:hover) .sv-frh.has-comments,
  .sv-frh.has-comments:focus-within,
  .sv-frh.has-comments.is-selected { margin-inline-start: -10px; padding-inline-start: 4px; gap: 2px; }
  :global(.sv-grid-row:hover) .sv-frh-num,
  .sv-frh:focus-within .sv-frh-num,
  .sv-frh.is-selected .sv-frh-num { display: none; }
  :global(.sv-grid-row:hover) .sv-frh-check,
  .sv-frh:focus-within .sv-frh-check,
  .sv-frh.is-selected .sv-frh-check { display: inline-flex; }
  :global(.sv-grid-row:hover) .sv-frh-expand,
  .sv-frh:focus-within .sv-frh-expand { visibility: visible; }
</style>
