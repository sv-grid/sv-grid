<script lang="ts">
  // The SvGrid mark - a precise data-grid glyph. A segmented header row over a
  // body with a WIDER first column (label) + value columns and THREE rows, so
  // it reads as rows of data. The right column is the brand-orange "active /
  // sorted column", with a small sort caret in its header - a signal unique to
  // data grids, not generic table icons. Flat: no gradients, sheen, glow,
  // shadow, or motion. Integer geometry on a 24-unit grid keeps it crisp.
  //
  //   'mark'  (default) - containerless; drawn in the current text ink.
  //   'plate'           - the glyph on a flat tile + hairline border (favicon).
  //   'mono'            - one-ink (no orange) for print / embossing.

  type Variant = 'mark' | 'plate' | 'mono'
  type Props = {
    showWordmark?: boolean
    size?: number
    wordmarkSize?: string
    variant?: Variant
  }
  let { showWordmark = true, size = 32, wordmarkSize, variant = 'mark' }: Props = $props()

  // 24-unit grid. Columns: a wide label column + two value columns.
  const COLS = [
    { x: 4, w: 6 },
    { x: 11, w: 4 },
    { x: 16, w: 4 },
  ]
  const ROWS = [9, 13, 17] // three body rows (height 3)
  const RH = 3
  const HEADER_Y = 4
  const HEADER_H = 4
  const ACTIVE_COL = 2 // rightmost value column is the "sorted" column

  const onPlate = $derived(variant === 'plate')
  const inkCell = $derived(onPlate ? '#e7edf5' : 'currentColor')
  const headerOpacity = $derived(onPlate ? 0.95 : 0.9)
  // The accent colour is driven by CSS (.lg-accent) so it uses the very same
  // --site-accent token as the orange "Sv" in the wordmark - they always match.
</script>

<span class="logo-wrap" style:gap={size >= 28 ? '0.56rem' : '0.42rem'}>
  <svg
    class="logo-mark"
    class:logo-mark-plate={onPlate}
    data-variant={variant}
    viewBox="0 0 24 24"
    width={size}
    height={size}
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    {#if onPlate}
      <rect x="0.5" y="0.5" width="23" height="23" rx="5" fill="#111a2e" />
      <rect x="0.5" y="0.5" width="23" height="23" rx="5" fill="none" stroke="rgba(148,163,184,0.28)" stroke-width="1" />
    {/if}

    <!-- Segmented header row (one cell per column = the frozen header) -->
    {#each COLS as col (col.x)}
      <rect x={col.x} y={HEADER_Y} width={col.w} height={HEADER_H} rx="1.2" fill={inkCell} opacity={headerOpacity} />
    {/each}
    <!-- Sort caret in the active column's header -->
    <path
      class="lg-accent"
      d="M{COLS[ACTIVE_COL].x + COLS[ACTIVE_COL].w / 2 - 1.1} {HEADER_Y + 1.4}
         L{COLS[ACTIVE_COL].x + COLS[ACTIVE_COL].w / 2 + 1.1} {HEADER_Y + 1.4}
         L{COLS[ACTIVE_COL].x + COLS[ACTIVE_COL].w / 2} {HEADER_Y + 2.9} Z"
    />

    <!-- Body cells; the active column is highlighted (sorted) -->
    {#each ROWS as ry (ry)}
      {#each COLS as col, ci (col.x)}
        {@const isActive = ci === ACTIVE_COL}
        <rect
          class:lg-accent={isActive}
          x={col.x}
          y={ry}
          width={col.w}
          height={RH}
          rx="0.9"
          fill={inkCell}
          opacity={isActive ? 1 : 0.32}
        />
      {/each}
    {/each}
  </svg>

  {#if showWordmark}
    <span class="logo-wordmark" style:font-size={wordmarkSize ?? (size >= 28 ? '1.12rem' : '0.95rem')}>
      <span class="wm-sv">Sv</span>Grid
    </span>
  {/if}
</span>

<style>
  .logo-wrap {
    display: inline-flex;
    align-items: center;
    line-height: 1;
  }
  .logo-mark {
    display: block;
    flex-shrink: 0;
    color: var(--sg-fg);
  }
  .logo-mark:not(.logo-mark-plate) {
    transition: opacity 160ms ease;
  }
  .logo-wrap:hover .logo-mark:not(.logo-mark-plate) {
    opacity: 0.82;
  }
  .logo-wordmark {
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--site-fg);
    font-feature-settings: 'ss01' 1;
  }
  /* "Sv" in brand orange flags the Svelte heritage; "Grid" stays neutral. */
  .wm-sv {
    color: var(--site-accent);
  }
  /* The icon accent uses the SAME token as the orange "Sv", so the sorted
     column, the sort caret and the wordmark are always the exact same orange.
     The one-ink variant drops to the current ink instead. */
  .lg-accent {
    fill: var(--site-accent);
  }
  .logo-mark[data-variant='mono'] .lg-accent {
    fill: currentColor;
  }
</style>
