<script lang="ts">
  /**
   * SvGrid Studio landing (shown when the demos gallery is switched to the
   * "SvGrid Studio" product): a Visual Designer hero + a gallery of ready-made
   * sample apps. Each sample opens the full-screen designer preloaded with it
   * (`/studio/<id>`); the hero's button opens an empty designer (`/studio`).
   */
  import { sampleApps } from '@svgrid/enterprise'
  import { router } from '../lib/router.svelte'

  const open = (id?: string) => router.navigate(id ? `studio/${id}` : 'studio')
</script>

<div class="sl">
  <!-- Hero -->
  <section class="sl-hero">
    <div class="sl-hero-copy">
      <span class="sl-kicker">SvGrid Studio</span>
      <h1 class="sl-title">The visual data-app designer</h1>
      <p class="sl-lead">
        Compose a multi-entity app from data-bound blocks - grids, charts, KPIs,
        dashboards, master/detail - preview it live with real data, then
        <strong>generate a runnable SvelteKit project you own</strong>. Start from a
        blank canvas or one of the sample apps below.
      </p>
      <div class="sl-hero-actions">
        <button type="button" class="sl-btn sl-btn--primary" onclick={() => open()}>Launch the designer &rarr;</button>
        <a class="sl-btn" href="#/docs/enterprise/studio/app-designer">How it works</a>
      </div>
    </div>
    <button type="button" class="sl-hero-shot" onclick={() => open('crm')} title="Open the CRM sample in the designer" aria-label="Open the CRM sample in the designer">
      <img src="/docs-media/studio-hero.png" alt="The SvGrid Studio visual designer editing a CRM dashboard" loading="eager" decoding="async" />
    </button>
  </section>

  <!-- Sample apps -->
  <section class="sl-samples">
    <div class="sl-samples-head">
      <h2 class="sl-samples-title">Sample apps</h2>
      <p class="sl-samples-sub">{sampleApps.length} ready-made apps - open one in the designer, tweak it, or bind it to your own database.</p>
    </div>
    <div class="sl-grid" role="list">
      {#each sampleApps as app (app.id)}
        <button
          type="button"
          role="listitem"
          class="sl-card"
          style="--accent: {app.accent}"
          onclick={() => open(app.id)}
          title="Open {app.name} in the designer"
        >
          <span class="sl-card-emoji">{app.emoji}</span>
          <span class="sl-card-name">{app.name}</span>
          <span class="sl-card-desc">{app.description}</span>
          <span class="sl-card-open">Open in designer &rarr;</span>
        </button>
      {/each}
    </div>
  </section>
</div>

<style>
  .sl { max-width: 1120px; margin: 0 auto; padding: 8px 4px 40px; }

  /* Hero */
  .sl-hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 32px; align-items: center; padding: 8px 0 34px; }
  @media (max-width: 900px) { .sl-hero { grid-template-columns: 1fr; gap: 20px; } }
  .sl-kicker { display: inline-block; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--site-accent, #f97316); }
  .sl-title { margin: 8px 0 0; font-size: 34px; line-height: 1.1; font-weight: 800; letter-spacing: -0.02em; color: var(--sg-fg); }
  .sl-lead { margin: 14px 0 0; font-size: 15px; line-height: 1.6; color: var(--sg-muted); max-width: 46ch; }
  .sl-lead strong { color: var(--sg-fg); font-weight: 650; }
  .sl-hero-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
  .sl-btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; font-size: 14px; font-weight: 650; border-radius: 10px; border: 1px solid var(--sg-border); color: var(--sg-fg); background: var(--sg-bg); cursor: pointer; text-decoration: none; transition: border-color 0.12s, background 0.12s; }
  .sl-btn:hover { border-color: var(--site-accent, #f97316); }
  .sl-btn--primary { border-color: transparent; color: #fff; background: var(--site-accent, #f97316); }
  .sl-btn--primary:hover { filter: brightness(1.06); }
  .sl-hero-shot { display: block; padding: 0; border: 1px solid var(--sg-border); border-radius: 14px; overflow: hidden; background: var(--sg-bg); cursor: pointer; box-shadow: 0 20px 50px -24px rgba(0, 0, 0, 0.5); transition: transform 0.16s, box-shadow 0.16s, border-color 0.16s; }
  .sl-hero-shot:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--site-accent, #f97316) 55%, var(--sg-border)); box-shadow: 0 26px 60px -22px rgba(0, 0, 0, 0.6); }
  .sl-hero-shot img { display: block; width: 100%; height: auto; }

  /* Samples */
  .sl-samples { border-top: 1px solid var(--sg-border); padding-top: 26px; }
  .sl-samples-title { margin: 0; font-size: 18px; font-weight: 750; color: var(--sg-fg); }
  .sl-samples-sub { margin: 4px 0 18px; font-size: 13px; color: var(--sg-muted); }
  .sl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(232px, 1fr)); gap: 14px; }
  .sl-card { position: relative; display: flex; flex-direction: column; gap: 6px; text-align: left; padding: 16px 16px 14px; border: 1px solid var(--sg-border); border-radius: 14px; background: var(--sg-bg); cursor: pointer; transition: border-color 0.14s, box-shadow 0.14s, transform 0.14s; }
  .sl-card::before { content: ''; position: absolute; inset: 0 0 auto 0; height: 3px; border-radius: 14px 14px 0 0; background: var(--accent, #6366f1); }
  .sl-card:hover { border-color: var(--accent, #6366f1); transform: translateY(-2px); box-shadow: 0 14px 30px -16px var(--accent, #6366f1); }
  .sl-card-emoji { font-size: 26px; line-height: 1; }
  .sl-card-name { font-size: 15px; font-weight: 700; color: var(--sg-fg); }
  .sl-card-desc { font-size: 12.5px; line-height: 1.45; color: var(--sg-muted); flex: 1; }
  .sl-card-open { margin-top: 6px; font-size: 12px; font-weight: 650; color: var(--accent, #6366f1); }
</style>
