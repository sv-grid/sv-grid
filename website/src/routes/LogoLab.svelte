<script lang="ts">
  // Logo lab: compare the mark variants side by side, on light AND dark panels,
  // at header / favicon sizes, with a hover hint. Visit /sv-grid/logo-lab.
  import Logo from '../components/Logo.svelte'

  type Variant = 'mark' | 'plate' | 'mono'
  const VARIANTS: Array<{ id: Variant; title: string; note: string }> = [
    { id: 'mark', title: 'Containerless (default)', note: 'A flat data-grid glyph: a segmented header over a label + value columns, three rows, and a brand-orange “active / sorted column” with a sort caret in its header. Drawn in the current text ink - no tile, gradients, glow, or motion. This is the in-app default.' },
    { id: 'plate', title: 'Plate', note: 'The same glyph knocked out of a solid tile + hairline border - more substantial for app icons. Matches the favicon 1:1.' },
    { id: 'mono', title: 'One-ink', note: 'Fully monochrome (no orange) - proves the mark holds up in a single colour for print, embossing, or watermarks.' },
  ]
</script>

<section class="mx-auto max-w-5xl px-6 py-14">
  <header class="mb-8">
    <h1 class="text-3xl font-bold tracking-tight" style="color: var(--site-fg);">Logo lab</h1>
    <p class="mt-2 text-[color:var(--site-muted)]">
      Three takes on the SvGrid mark, shown on light and dark panels at real sizes.
      Hover a mark to see its motion. Tell me which direction and I'll refine it.
    </p>
  </header>

  <div class="flex flex-col gap-6">
    {#each VARIANTS as v (v.id)}
      <article class="rounded-2xl border" style="border-color: var(--site-border); background: var(--site-bg-elev);">
        <div class="flex items-center justify-between px-5 py-3 border-b" style="border-color: var(--site-border);">
          <div>
            <h2 class="text-lg font-semibold" style="color: var(--site-fg);">{v.title}</h2>
            <code class="text-xs" style="color: var(--site-muted);">variant="{v.id}"</code>
          </div>
          <p class="hidden md:block max-w-md text-right text-xs leading-relaxed" style="color: var(--site-muted);">{v.note}</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2">
          <!-- Light panel -->
          <div class="lab-panel lab-light">
            <div class="lab-row"><Logo variant={v.id} size={44} /></div>
            <div class="lab-sizes">
              <Logo variant={v.id} size={28} />
              <Logo variant={v.id} size={20} showWordmark={false} />
              <Logo variant={v.id} size={16} showWordmark={false} />
            </div>
            <span class="lab-tag">Light</span>
          </div>
          <!-- Dark panel -->
          <div class="lab-panel lab-dark">
            <div class="lab-row"><Logo variant={v.id} size={44} /></div>
            <div class="lab-sizes">
              <Logo variant={v.id} size={28} />
              <Logo variant={v.id} size={20} showWordmark={false} />
              <Logo variant={v.id} size={16} showWordmark={false} />
            </div>
            <span class="lab-tag">Dark</span>
          </div>
        </div>

        <p class="md:hidden px-5 py-3 text-xs leading-relaxed border-t" style="border-color: var(--site-border); color: var(--site-muted);">{v.note}</p>
      </article>
    {/each}
  </div>

  <p class="mt-8 text-sm" style="color: var(--site-muted);">
    The mark now reads specifically as a <strong style="color: var(--site-fg);">data grid</strong>: a header over a
    label + value columns, three rows, and an orange <strong style="color: var(--site-fg);">sorted column</strong> with
    a sort caret - a cue generic “table” icons don't have. Flat, single-accent, integer-aligned (crisp at 16px),
    and one-ink capable. The wordmark's orange <strong style="color: var(--site-fg);">Sv</strong> flags the Svelte heritage.
  </p>
</section>

<style>
  .lab-panel {
    position: relative;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
    padding: 34px 24px 28px;
  }
  .lab-light { background: #ffffff; }
  .lab-dark { background: #0b1220; }
  /* The logo wordmark reads from --sg-fg / --site-fg; pin them per panel so
     each preview is faithful regardless of the page theme. */
  .lab-light { --sg-fg: #0f172a; --site-fg: #0f172a; }
  .lab-dark { --sg-fg: #e2e8f0; --site-fg: #e2e8f0; }
  .lab-row { display: flex; align-items: center; }
  .lab-sizes { display: flex; align-items: center; gap: 20px; }
  .lab-tag {
    position: absolute; top: 8px; left: 10px;
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
    color: #94a3b8;
  }
  @media (min-width: 640px) {
    .lab-light { border-right: 1px solid var(--site-border); }
  }
</style>
