<script lang="ts">
  /**
   * SvCarousel (slideshow with arrows, dots, autoplay + swipe) and SvTour (a
   * guided product tour that spotlights elements and steps through them).
   */
  import { SvCarousel, SvTour, SvButton, type TourStep } from '@svgrid/grid'

  const slides = [
    { title: 'Fast by default', body: 'Virtualized to a million rows.', from: '#2563eb', to: '#7c3aed' },
    { title: 'Themeable', body: '16 presets, light + dark, RTL.', from: '#0891b2', to: '#16a34a' },
    { title: 'Headless-first', body: 'Every editor has a rune-based core.', from: '#d97706', to: '#dc2626' },
    { title: 'AI-native', body: 'MCP server + Studio codegen.', from: '#7c3aed', to: '#2563eb' },
  ]
  let autoplay = $state(true)

  let tourOpen = $state(false)
  const steps: TourStep[] = [
    { target: '#tour-carousel', title: 'A carousel', content: 'Swipe, use the arrows, or let it autoplay. It pauses on hover.' },
    { target: '#tour-autoplay', title: 'Autoplay', content: 'Toggle autoplay on or off here.' },
    { target: '#tour-start', title: 'Start a tour', content: 'This whole walkthrough is a single <SvTour> component.' },
    { title: "That's it", content: 'Tours are great for onboarding new users to a data app.' },
  ]
</script>

<div class="wrap">
  <header>
    <h2>Carousel &amp; tour</h2>
    <p>A slideshow and a guided product tour - both portalled, themeable, keyboard-friendly.</p>
  </header>

  <div id="tour-carousel" class="carousel-box">
    <SvCarousel count={slides.length} autoplay={autoplay ? 3500 : 0}>
      {#snippet slide(i)}
        {@const s = slides[i]}
        <div class="slide" style:background={`linear-gradient(135deg, ${s.from}, ${s.to})`}>
          <div class="slide__title">{s.title}</div>
          <div class="slide__body">{s.body}</div>
        </div>
      {/snippet}
    </SvCarousel>
  </div>

  <div class="bar">
    <label id="tour-autoplay" class="chk"><input type="checkbox" bind:checked={autoplay} /> Autoplay</label>
    <span id="tour-start"><SvButton onclick={() => (tourOpen = true)}>Start tour</SvButton></span>
  </div>
</div>

<SvTour bind:open={tourOpen} {steps} />

<style>
  .wrap { padding: 20px; max-width: 720px; display: flex; flex-direction: column; gap: 16px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; }
  .carousel-box { border: 1px solid var(--sg-border, #e2e8f0); border-radius: 12px; overflow: hidden; }
  .slide { height: 240px; display: flex; flex-direction: column; justify-content: flex-end; gap: 4px; padding: 24px; color: #fff; }
  .slide__title { font-size: 24px; font-weight: 750; }
  .slide__body { font-size: 14px; opacity: 0.92; }
  .bar { display: flex; align-items: center; gap: 16px; }
  .chk { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; color: var(--sg-muted, #64748b); }
</style>
