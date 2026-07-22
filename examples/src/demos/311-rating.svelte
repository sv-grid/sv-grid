<script lang="ts">
  /**
   * SvRating - a production review widget: an interactive star input with a live
   * summary, a read-only aggregate display, and half-star precision. Copy-paste
   * ready.
   */
  import { SvRating } from '@svgrid/grid'

  let myRating = $state(0)
  const labels = ['', 'Terrible', 'Poor', 'Average', 'Good', 'Excellent']
  const breakdown = [
    { stars: 5, pct: 68 },
    { stars: 4, pct: 20 },
    { stars: 3, pct: 7 },
    { stars: 2, pct: 3 },
    { stars: 1, pct: 2 },
  ]
</script>

<div class="wrap">
  <header>
    <h2>Rating</h2>
    <p>A star input (WAI-ARIA slider) with hover preview, keyboard and half-star precision - reviews, feedback, quality scores.</p>
  </header>

  <section class="block">
    <h3>Leave a review</h3>
    <div class="rate">
      <SvRating value={myRating} onChange={(v) => (myRating = v)} size="lg" />
      <span class="lbl">{myRating ? labels[Math.ceil(myRating)] : 'Tap a star'}</span>
    </div>
  </section>

  <section class="block">
    <h3>Aggregate (4.5 average, read-only)</h3>
    <div class="agg">
      <div class="score"><span class="big">4.5</span><SvRating value={4.5} allowHalf readonly /></div>
      <div class="bars">
        {#each breakdown as b (b.stars)}
          <div class="bar"><span class="s">{b.stars}★</span><div class="track"><span style:width={`${b.pct}%`}></span></div><span class="p">{b.pct}%</span></div>
        {/each}
      </div>
    </div>
  </section>
</div>

<style>
  .wrap { padding: 20px; max-width: 560px; display: flex; flex-direction: column; gap: 22px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  .block h3 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .rate { display: flex; align-items: center; gap: 12px; }
  .lbl { font-size: 14px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .agg { display: flex; gap: 24px; align-items: center; flex-wrap: wrap; }
  .score { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .score .big { font-size: 34px; font-weight: 800; line-height: 1; }
  .bars { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 4px; }
  .bar { display: flex; align-items: center; gap: 8px; font-size: 12px; }
  .bar .s { width: 26px; color: var(--sg-muted, #64748b); }
  .bar .p { width: 34px; text-align: right; color: var(--sg-muted, #94a3b8); }
  .track { flex: 1; height: 7px; border-radius: 999px; background: var(--sg-border, #e2e8f0); overflow: hidden; }
  .track span { display: block; height: 100%; background: var(--sg-rating-on, #f59e0b); }
</style>
