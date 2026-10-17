<script lang="ts" module>
  /**
   * Features with screenshot block - a feature list on one side and a product
   * screenshot on the other that redraws for the selected feature. The list is
   * a WAI-ARIA tablist: click a feature, or use the arrow keys, Home and End.
   * The screenshots are inline SVG painted from tokens (dashboard, SQL editor,
   * alert chart, share dialog). SvBadge, SvButton, SvToaster. Pure UI-kit,
   * --sg-* themed.
   *
   * Headless: createFeatureShowcase() below owns the features, the selection
   * and the roving-focus keyboard model with no markup; it says which tab
   * should take focus through focusIndex/focusTick. The component under it is
   * one styled render of that core; import createFeatureShowcase from this
   * file (or `npx @svgrid/ui add features-screenshot --headless` for the core
   * alone) to draw your own.
   */
  export type ShowcaseFeature = {
    id: string
    title: string
    text: string
    /** Which screenshot to draw; your render maps it to an image. */
    shot: string
  }
  export type FeatureShowcaseOptions = {
    features?: ShowcaseFeature[]
    initial?: string
    onChange?: (feature: ShowcaseFeature) => void
  }

  const FEATURES: ShowcaseFeature[] = [
    { id: 'dashboards', title: 'Dashboards', text: 'Drag charts onto a page. Each tile re-queries after a sync, so the numbers match the warehouse.', shot: 'dashboard' },
    { id: 'sql', title: 'SQL editor', text: 'Autocomplete from your schema, a result grid under the query and a version for every save.', shot: 'sql' },
    { id: 'alerts', title: 'Alerts', text: 'Draw a threshold on any chart. Lumen checks it after each sync and emails the owner.', shot: 'alerts' },
    { id: 'sharing', title: 'Sharing', text: 'Invite by email with viewer or editor rights, or send a link that expires after 7 days.', shot: 'share' },
  ]

  let uid = 0

  export function createFeatureShowcase(opts: FeatureShowcaseOptions = {}) {
    const features = opts.features ?? FEATURES
    const base = `sv-fss-${uid++}`
    let index = $state(Math.max(0, features.findIndex((f) => f.id === opts.initial)))
    let focusIndex = $state(0)
    let focusTick = $state(0)

    function select(i: number) {
      if (i < 0 || i >= features.length || i === index) return
      index = i
      opts.onChange?.(features[i]!)
    }

    function onKeydown(e: KeyboardEvent) {
      const n = features.length
      let next = -1
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (index + 1) % n
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (index - 1 + n) % n
      else if (e.key === 'Home') next = 0
      else if (e.key === 'End') next = n - 1
      if (next < 0) return
      e.preventDefault()
      select(next)
      focusIndex = next
      focusTick++
    }

    return {
      features,
      get index() { return index },
      get selected() { return features[index]! },
      /** Tab that should hold DOM focus after the latest arrow key. */
      get focusIndex() { return focusIndex },
      /** Bumps on every keyboard move; focus the tab when it changes. */
      get focusTick() { return focusTick },
      select,
      /** Spread on the list container. */
      tablistProps: () => ({ role: 'tablist' as const, 'aria-orientation': 'vertical' as const }),
      /** Spread on the button of feature `i`. */
      tabProps: (i: number) => ({
        type: 'button' as const,
        role: 'tab' as const,
        id: `${base}-tab-${i}`,
        'aria-selected': i === index,
        'aria-controls': `${base}-panel`,
        tabindex: i === index ? 0 : -1,
        onclick: () => select(i),
        onkeydown: onKeydown,
      }),
      /** Spread on the screenshot panel. */
      panelProps: () => ({ role: 'tabpanel' as const, id: `${base}-panel`, 'aria-labelledby': `${base}-tab-${index}` }),
    }
  }
</script>

<script lang="ts">
  import { SvBadge, SvButton, SvToaster, toast } from '@svgrid/grid'

  const show = createFeatureShowcase()
  const tabEls: HTMLButtonElement[] = []
  // Move real focus only after a keyboard move, never on mount.
  $effect(() => { if (show.focusTick) tabEls[show.focusIndex]?.focus() })
</script>

<section class="sv-fss" aria-labelledby="sv-fss-title">
  <div class="sv-fss-copy">
    <div class="sv-fss-intro">
      <SvBadge variant="neutral">Product tour</SvBadge>
      <h2 id="sv-fss-title">One workspace from query to inbox</h2>
    </div>
    <div class="sv-fss-tabs" aria-label="Lumen features" {...show.tablistProps()}>
      {#each show.features as f, i (f.id)}
        <button class="sv-fss-tab" bind:this={tabEls[i]} {...show.tabProps(i)}>
          <strong>{f.title}</strong>
          <span>{f.text}</span>
        </button>
      {/each}
    </div>
    <div class="sv-fss-cta">
      <SvButton variant="primary" onclick={() => toast(`Loading sample data into ${show.selected.title}`)}>
        Try {show.selected.title} with sample data
      </SvButton>
    </div>
  </div>

  <div class="sv-fss-shot" {...show.panelProps()}>
    <svg viewBox="0 0 560 380" role="img" aria-label="{show.selected.title} screen in Lumen">
      <rect class="sv-fss-s0" x="1" y="1" width="558" height="378" rx="12" />
      <rect class="sv-fss-s1" x="1" y="1" width="558" height="34" rx="12" />
      <circle class="sv-fss-s2" cx="22" cy="18" r="5" /><circle class="sv-fss-s2" cx="38" cy="18" r="5" /><circle class="sv-fss-s2" cx="54" cy="18" r="5" />
      <rect class="sv-fss-s2" x="190" y="11" width="180" height="14" rx="7" />
      <rect class="sv-fss-s1" x="16" y="50" width="96" height="314" rx="8" />
      {#each [0, 1, 2, 3, 4] as r (r)}<rect class={r === show.index ? 'sv-fss-ac2' : 'sv-fss-ln'} x="28" y={66 + r * 26} width="70" height="10" rx="5" />{/each}

      {#if show.selected.shot === 'dashboard'}
        {#each [0, 1, 2] as k (k)}
          <rect class="sv-fss-s1" x={128 + k * 140} y="50" width="128" height="70" rx="8" />
          <rect class="sv-fss-ln" x={142 + k * 140} y="66" width="54" height="8" rx="4" />
          <rect class={k === 0 ? 'sv-fss-ac' : 'sv-fss-s2'} x={142 + k * 140} y="86" width={70 - k * 12} height="16" rx="4" />
        {/each}
        <rect class="sv-fss-s1" x="128" y="136" width="408" height="228" rx="8" />
        {#each [92, 130, 110, 160, 148, 182, 170, 196] as h, k (k)}
          <rect class={k === 7 ? 'sv-fss-ac' : 'sv-fss-ac2'} x={150 + k * 46} y={348 - h} width="28" height={h} rx="4" />
        {/each}
      {:else if show.selected.shot === 'sql'}
        <rect class="sv-fss-s1" x="128" y="50" width="408" height="142" rx="8" />
        {#each [{ kw: 60, rest: 150 }, { kw: 40, rest: 210 }, { kw: 90, rest: 120 }, { kw: 40, rest: 170 }, { kw: 70, rest: 90 }] as w, k (k)}
          <rect class="sv-fss-ac2" x={144 + k * 8} y={68 + k * 24} width={w.kw} height="10" rx="5" />
          <rect class="sv-fss-ln" x={152 + k * 8 + w.kw} y={68 + k * 24} width={w.rest} height="10" rx="5" />
        {/each}
        <rect class="sv-fss-s1" x="128" y="206" width="408" height="158" rx="8" />
        {#each [0, 1, 2, 3, 4] as r (r)}
          <rect class={r === 0 ? 'sv-fss-s2' : 'sv-fss-s0'} x="140" y={218 + r * 28} width="384" height="22" rx="4" />
          {#each [0, 1, 2, 3] as c (c)}<rect class="sv-fss-ln" x={152 + c * 96} y={225 + r * 28} width={r === 0 ? 50 : 66 - c * 6} height="8" rx="4" />{/each}
        {/each}
      {:else if show.selected.shot === 'alerts'}
        <rect class="sv-fss-s1" x="128" y="50" width="408" height="230" rx="8" />
        <line class="sv-fss-dash" x1="146" y1="110" x2="520" y2="110" />
        <polyline class="sv-fss-line" points="146,230 190,214 234,222 278,196 322,204 366,170 410,178 454,124 498,96" />
        <circle class="sv-fss-dg" cx="498" cy="96" r="6" />
        <rect class="sv-fss-s1" x="128" y="294" width="408" height="70" rx="8" />
        <rect class="sv-fss-dg" x="144" y="314" width="8" height="30" rx="4" />
        <rect class="sv-fss-ln" x="166" y="314" width="190" height="10" rx="5" />
        <rect class="sv-fss-s2" x="166" y="334" width="250" height="10" rx="5" />
      {:else}
        <rect class="sv-fss-s1" x="128" y="50" width="408" height="314" rx="8" />
        <rect class="sv-fss-s0 sv-fss-edge" x="190" y="96" width="284" height="220" rx="10" />
        <rect class="sv-fss-ln" x="210" y="116" width="120" height="12" rx="6" />
        <rect class="sv-fss-s1 sv-fss-edge" x="210" y="144" width="244" height="30" rx="6" />
        {#each [0, 1, 2] as k (k)}
          <circle class={k === 0 ? 'sv-fss-ac2' : 'sv-fss-s2'} cx="226" cy={202 + k * 30} r="10" />
          <rect class="sv-fss-ln" x="246" y={197 + k * 30} width={120 - k * 18} height="10" rx="5" />
          <rect class="sv-fss-s2" x="404" y={196 + k * 30} width="50" height="12" rx="6" />
        {/each}
        <rect class="sv-fss-ac" x="374" y="282" width="80" height="22" rx="6" />
      {/if}
    </svg>
  </div>
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-fss {
    display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 48px; align-items: center;
    width: 100%; box-sizing: border-box; padding: 52px 40px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-fss-copy { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; min-width: 0; }
  .sv-fss-intro { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; }
  .sv-fss-copy h2 { margin: 0; font-size: 28px; font-weight: 700; line-height: 1.2; letter-spacing: -.02em; }
  .sv-fss-tabs { display: flex; flex-direction: column; gap: 4px; width: 100%; margin-bottom: 4px; }
  .sv-fss-tab {
    display: flex; flex-direction: column; gap: 4px; width: 100%; box-sizing: border-box; padding: 12px 14px;
    text-align: start; font: inherit; color: inherit; cursor: pointer;
    background: none; border: 0; border-left: 3px solid transparent; border-radius: 0 var(--sg-radius, 8px) var(--sg-radius, 8px) 0;
  }
  .sv-fss-tab strong { font-size: 15px; font-weight: 650; }
  .sv-fss-tab span { font-size: 13.5px; line-height: 1.5; color: var(--sg-muted, #64748b); }
  .sv-fss-tab:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-fss-tab[aria-selected='true'] {
    border-left-color: var(--sg-accent, #4f46e5);
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 5%, var(--sg-bg, #fff));
  }
  .sv-fss-tab:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #4f46e5)); outline-offset: -2px; }
  .sv-fss-shot svg { display: block; width: 100%; height: auto; }
  .sv-fss-s0 { fill: var(--sg-bg, #fff); stroke: var(--sg-border, #e2e8f0); stroke-width: 1; }
  .sv-fss-s1 { fill: color-mix(in srgb, var(--sg-fg, #0f172a) 5%, var(--sg-bg, #fff)); }
  .sv-fss-s2 { fill: color-mix(in srgb, var(--sg-fg, #0f172a) 12%, var(--sg-bg, #fff)); }
  .sv-fss-ln { fill: color-mix(in srgb, var(--sg-fg, #0f172a) 24%, var(--sg-bg, #fff)); }
  .sv-fss-ac { fill: var(--sg-accent, #4f46e5); }
  .sv-fss-ac2 { fill: color-mix(in srgb, var(--sg-accent, #4f46e5) 40%, var(--sg-bg, #fff)); }
  .sv-fss-dg { fill: var(--sg-danger, #dc2626); }
  .sv-fss-edge { stroke: var(--sg-border, #e2e8f0); stroke-width: 1; }
  .sv-fss-line { fill: none; stroke: var(--sg-accent, #4f46e5); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
  .sv-fss-dash { stroke: var(--sg-danger, #dc2626); stroke-width: 1.5; stroke-dasharray: 6 5; }

  @media (max-width: 820px) {
    .sv-fss { grid-template-columns: 1fr; gap: 20px; padding: 36px 16px; }
    /* One column: the screenshot moves up under the heading, so a tap on a feature shows its change on screen. */
    .sv-fss-copy { display: contents; }
    .sv-fss-intro { order: -2; }
    .sv-fss-shot { order: -1; }
    .sv-fss-tabs { margin-bottom: 0; }
    .sv-fss-copy h2 { font-size: 23px; }
  }
</style>
