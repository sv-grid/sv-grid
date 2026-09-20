<script lang="ts">
  /**
   * The block cache, drawn: one bar per cached level, the level's row range
   * end to end, with a segment for every block the cache holds - loaded,
   * loading or failed - so a scroll through a million rows shows exactly
   * which hundred-row blocks came down and which were evicted behind you.
   * Reads what `levelStates()` (row model) or `getCacheState()` (flat
   * controller) report; nothing here talks to the server.
   */
  type Block = { blockIndex: number; startRow: number; endRow: number; status: 'loading' | 'loaded' | 'failed' }
  type Level = { label: string; rowCount: number | null; blocks: ReadonlyArray<Block> }
  let { levels, max = 4, title = 'Block cache' }: { levels: ReadonlyArray<Level>; max?: number; title?: string } = $props()

  // The levels that hold something, most blocks first, so the bars that
  // matter are the ones on screen when a tree has many small levels open.
  const shown = $derived(
    [...levels]
      .filter((l) => l.blocks.length > 0)
      .sort((a, b) => (b.rowCount ?? 0) - (a.rowCount ?? 0))
      .slice(0, max),
  )
  const hidden = $derived(Math.max(0, levels.filter((l) => l.blocks.length > 0).length - shown.length))
  const fmt = (n: number) => n.toLocaleString()
  function span(block: Block, rowCount: number | null): { left: string; width: string } {
    const total = Math.max(rowCount ?? block.endRow, block.endRow, 1)
    const left = (block.startRow / total) * 100
    const width = Math.max(((block.endRow - block.startRow) / total) * 100, 0.4)
    return { left: `${Math.min(left, 100 - width)}%`, width: `${width}%` }
  }
</script>

<div class="blockmap" role="group" aria-label={title}>
  <div class="blockmap-head">
    <span class="blockmap-title">{title}</span>
    <span class="blockmap-key"><i class="is-loaded"></i> loaded <i class="is-loading"></i> loading <i class="is-failed"></i> failed</span>
  </div>
  {#each shown as level (level.label)}
    {@const loaded = level.blocks.filter((b) => b.status === 'loaded').length}
    <div class="blockmap-row">
      <span class="blockmap-label" title={level.label}>{level.label}</span>
      <div class="blockmap-bar" aria-hidden="true">
        {#each level.blocks as b (b.blockIndex)}
          {@const at = span(b, level.rowCount)}
          <span class="blockmap-seg is-{b.status}" style:left={at.left} style:width={at.width} title={`rows ${fmt(b.startRow + 1)} - ${fmt(b.endRow)}: ${b.status}`}></span>
        {/each}
      </div>
      <span class="blockmap-count">{loaded} block{loaded === 1 ? '' : 's'}{level.rowCount != null ? ` of ${fmt(level.rowCount)} rows` : ''}</span>
    </div>
  {/each}
  {#if !shown.length}<div class="blockmap-empty">Nothing cached yet.</div>{/if}
  {#if hidden}<div class="blockmap-empty">and {hidden} more level{hidden === 1 ? '' : 's'}</div>{/if}
</div>

<style>
  .blockmap {
    padding: 6px 10px 8px;
    border-top: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    font-size: 11.5px;
    color: var(--sg-fg, #0f172a);
    font-variant-numeric: tabular-nums;
  }
  .blockmap-head { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
  .blockmap-title { font-weight: 600; }
  .blockmap-key { display: inline-flex; gap: 6px; align-items: center; color: var(--sg-muted, #64748b); }
  .blockmap-key i { display: inline-block; width: 10px; height: 8px; border-radius: 2px; }
  .blockmap-row { display: grid; grid-template-columns: 120px 1fr auto; gap: 8px; align-items: center; padding: 2px 0; }
  .blockmap-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--sg-muted, #64748b); }
  .blockmap-bar {
    position: relative;
    height: 10px;
    border-radius: 3px;
    background: var(--sg-header-bg, #f1f5f9);
    overflow: hidden;
  }
  .blockmap-seg { position: absolute; top: 0; bottom: 0; }
  .is-loaded { background: var(--sg-muted, #64748b); }
  .is-loading {
    background: repeating-linear-gradient(45deg, var(--sg-muted, #64748b) 0 3px, transparent 3px 6px);
    opacity: 0.7;
  }
  .is-failed { background: var(--sg-danger, #b91c1c); }
  .blockmap-count { color: var(--sg-muted, #64748b); white-space: nowrap; }
  .blockmap-empty { color: var(--sg-muted, #64748b); padding: 2px 0; }
  @media (max-width: 767px) {
    .blockmap-row { grid-template-columns: 80px 1fr; }
    .blockmap-count, .blockmap-key { display: none; }
  }
</style>
