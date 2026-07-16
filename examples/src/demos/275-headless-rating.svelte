<script lang="ts">
  /**
   * Headless rating - the SvGrid UI kit is headless-first + render-ready, just
   * like the grid. `createRating` is the state machine behind <SvRating>: hover
   * preview, half steps, keyboard (Arrows / Home / End) + ARIA `slider`, exposed
   * as **prop-getters** you spread onto YOUR OWN markup. Below, the same core
   * drives the styled component AND a totally custom render, bound to one value.
   */
  import { SvRating, createRating } from '@svgrid/grid'

  let value = $state(3)

  // The headless core - identical behavior, our own DOM (a segmented meter here,
  // stars there), including half-step preview from a single pointer model.
  const r = createRating({
    value: () => value,
    onChange: (v) => (value = v),
    max: () => 5,
    allowHalf: () => true,
  })
</script>

<div class="wrap">
  <header>
    <h2>Headless rating</h2>
    <p>
      Every editor ships a headless core + a styled component - the same split as the grid
      (<code>createSvGrid</code> / <code>&lt;SvGrid&gt;</code>). Here <code>createRating</code>
      drives both renders below; hover preview, half steps, keyboard and ARIA come from the core, the markup is yours.
    </p>
  </header>

  <div class="cols">
    <section>
      <h3>Styled <code>&lt;SvRating&gt;</code></h3>
      <SvRating {value} allowHalf ariaLabel="Score" onChange={(v) => (value = v)} />
    </section>

    <section>
      <h3>Your markup, same core</h3>
      <div class="meter" {...r.rootProps()}>
        {#each Array(5) as _, i (i)}
          <button class="cell is-{r.fillOf(i)}" {...r.starProps(i)}></button>
        {/each}
      </div>
      <p class="hint">Hover for a live preview, arrow keys step by half - all from <code>createRating</code>.</p>
    </section>
  </div>

  <aside class="readout">
    <h3>Value</h3>
    <div class="tags"><span class="tag">{value}</span></div>
  </aside>
</div>

<style>
  .wrap { padding: 20px; max-width: 900px; display: flex; flex-direction: column; gap: 18px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.55; max-width: 680px; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .cols { display: flex; gap: 32px; flex-wrap: wrap; align-items: flex-start; }
  section h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  /* Fully custom render - nothing shared with SvRating but the core. */
  .meter { display: inline-flex; gap: 6px; padding: 4px; border-radius: 8px; outline: none; }
  .meter:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #4f46e5)); outline-offset: 2px; }
  .cell {
    width: 34px; height: 22px; padding: 0; border-radius: 5px; cursor: pointer;
    border: 1px solid var(--sg-border, #cbd5e1); background: var(--sg-input-bg, #fff); transition: background 0.1s;
  }
  .cell.is-full { background: var(--sg-accent, #4f46e5); border-color: transparent; }
  .cell.is-half { background: linear-gradient(90deg, var(--sg-accent, #4f46e5) 50%, var(--sg-input-bg, #fff) 50%); }
  .hint { margin: 10px 0 0; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
  .readout h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .tag { padding: 3px 10px; border-radius: 6px; font-size: 13px; background: var(--sg-row-hover-bg, #f1f5f9); }
</style>
