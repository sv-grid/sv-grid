<!--
  The proposed value after a rich cell (a select, a rating, a person): the
  cell draws as it always does, and "-> Closed" follows it. The text is the
  column's own formatter's (a person's name, not their id), else the plain
  formatted value.
-->
<script lang="ts">
  import { formatValueForExport } from '@svgrid/grid'
  import { cellProposalFor } from './card-marks.svelte'
  import { showValue } from './cluster'
  import { fill } from './messages'

  let { ctrl, row, column }: { ctrl: any; row: any; column: any } = $props()

  const proposal = $derived(cellProposalFor(ctrl?.props?.getRowId, row?.original, String(row?.id), column?.columnDef?.field))
  const text = $derived.by(() => {
    if (!proposal) return ''
    const def = column?.columnDef ?? {}
    const value = proposal.after
    if (value == null || value === '') return proposal.empty
    if (typeof def.formatter === 'function') {
      try {
        return String(def.formatter({ value, row, column, table: ctrl?.grid }) ?? '')
      } catch {
        // A formatter that needs more than a value: fall back to the value.
      }
    }
    return Array.isArray(value) ? value.map((v) => showValue(v).replace(/^"|"$/g, '')).join(', ') : formatValueForExport(value, def.format)
  })
</script>

{#if proposal}
  <span
    class="sv-review-cellmark"
    title="{fill(proposal.proposes, { source: proposal.source, value: text })}{proposal.reason ? ` - ${proposal.reason}` : ''}"
  ><span aria-hidden="true">→</span> {text}</span>
{/if}

<style>
  .sv-review-cellmark {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    margin-left: 6px;
    flex: none;
    max-width: 60%;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 0.92em;
    font-weight: 600;
    color: var(--sg-fg, #111827);
  }
  .sv-review-cellmark > span {
    color: var(--sg-muted, #6b7280);
    font-weight: 400;
  }
</style>
