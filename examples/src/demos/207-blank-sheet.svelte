<script lang="ts">
  /**
   * 207. Blank sheet - just type
   * -----------------------------
   * An empty workbook and nothing else:
   *
   *   <SvSheet />
   *
   * With no `workbook` and no `data` it creates a single empty sheet, which
   * is what "open a spreadsheet" means. Click a cell, type a number, type
   * =SUM(A1:A5) and watch it resolve.
   *
   * Worth trying, because none of it is wired up in this file:
   *
   *   Ctrl+Arrow      run to the edge of a block, hopping gaps
   *   Ctrl+D / Ctrl+R fill down / right, translating references as they go
   *   Ctrl+;          stamp today's date
   *   Alt+=           AutoSum the run above
   *   Ctrl+B          bold, and watch the ribbon button light up
   *   Ctrl+Shift+4    currency
   *   Ctrl+Z          one press per action, not one per cell
   *
   * Drag the fill handle on the active cell's corner to extend a series;
   * drag a column border in the header to resize.
   */
  import { SvSheet } from '@svgrid/enterprise'
</script>

<SvSheet height={470} rows={60} columns={14} />
