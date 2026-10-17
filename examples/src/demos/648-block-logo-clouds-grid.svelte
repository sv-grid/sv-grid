<script lang="ts" module>
  /**
   * Logo cloud block - a heading and one line of social proof over a grid of
   * twelve made-up customer wordmarks, each an inline SVG glyph with set type.
   * Wordmarks with a case study are links: muted at rest, full contrast on
   * hover or keyboard focus. Four columns on desktop, three on tablets, two on
   * phones. An SvButton under the grid opens all customer stories; uses
   * SvToaster and toast. Pure UI-kit, --sg-* themed.
   *
   * Headless: createLogoCloud() below owns the customer list, the proof line
   * and the link wiring with no markup. The component under it is one styled
   * render of that core; import createLogoCloud from this file (or `npx
   * @svgrid/ui add logo-clouds-grid --headless` for the core alone) to draw
   * your own.
   */
  export type LogoGlyph = 'peak' | 'leaf' | 'hex' | 'ring' | 'wave' | 'bars' | 'diamond' | 'spark' | 'arc' | 'grid' | 'tri' | 'dots'
  export type CustomerLogo = {
    id: string; name: string
    /** Which made-up glyph sits before the name. */
    glyph: LogoGlyph
    /** Type style of the wordmark. */
    face?: 'sans' | 'serif' | 'caps' | 'mono'
    /** Case study URL; logos without one are not links. */
    href?: string
  }
  export type LogoCloudOptions = {
    logos?: CustomerLogo[]
    /** Number of teams in the proof line. */
    teams?: number
    /** Called instead of following the link (client routing, analytics). */
    onOpen?: (logo: CustomerLogo) => void
    onViewAll?: () => void
  }

  const SAMPLE: CustomerLogo[] = [
    { id: 'northwind', name: 'Northwind', glyph: 'peak', href: '/customers/northwind' },
    { id: 'copperleaf', name: 'Copperleaf', glyph: 'leaf', face: 'serif', href: '/customers/copperleaf' },
    { id: 'kestrel', name: 'Kestrel Labs', glyph: 'hex', face: 'mono' },
    { id: 'lumen', name: 'Lumen Health', glyph: 'ring', href: '/customers/lumen-health' },
    { id: 'tidewater', name: 'Tidewater', glyph: 'wave', face: 'caps', href: '/customers/tidewater' },
    { id: 'harbor', name: 'Harbor & Vale', glyph: 'bars', face: 'serif' },
    { id: 'quarry', name: 'Quarry & Co', glyph: 'diamond', face: 'caps' },
    { id: 'brightline', name: 'Brightline', glyph: 'spark', href: '/customers/brightline' },
    { id: 'atlas', name: 'Atlas Fleet', glyph: 'arc', face: 'caps' },
    { id: 'ostrava', name: 'Ostrava Mills', glyph: 'grid', face: 'serif' },
    { id: 'pinecrest', name: 'Pinecrest', glyph: 'tri', href: '/customers/pinecrest' },
    { id: 'meridian', name: 'Meridian', glyph: 'dots', face: 'mono' },
  ]

  export function createLogoCloud(opts: LogoCloudOptions = {}) {
    const logos = opts.logos ?? SAMPLE
    const teams = new Intl.NumberFormat('en-US').format(opts.teams ?? 1200)

    return {
      logos,
      /** The social proof line under the heading. */
      proof: `Used by ${teams} ops teams, from five-person dispatch desks to 40-clinic networks.`,
      linkedCount: logos.filter((l) => l.href).length,
      viewAll: () => opts.onViewAll?.(),
      /** Spread on the logo's <a>; only call it for logos with an href. */
      linkProps: (logo: CustomerLogo) => ({
        href: logo.href,
        'aria-label': `${logo.name} customer story`,
        onclick: (e: MouseEvent) => {
          if (!opts.onOpen) return
          e.preventDefault()
          opts.onOpen(logo)
        },
      }),
    }
  }
</script>

<script lang="ts">
  import { SvButton, SvToaster, toast } from '@svgrid/grid'

  const cloud = createLogoCloud({
    onOpen: (l) => toast(`Opening the ${l.name} story`),
    onViewAll: () => toast('Opening all customer stories'),
  })
</script>

{#snippet mark(l: CustomerLogo)}
  <svg viewBox="0 0 20 20" aria-hidden="true">
    {#if l.glyph === 'peak'}<path d="M2 16l6-10 3.5 5.5L14 8l4 8z" />
    {:else if l.glyph === 'leaf'}<path d="M4 16C4 8 9 4 17 3c-1 8-5 13-13 13zm0 0l7-7" />
    {:else if l.glyph === 'hex'}<path d="M10 2l7 4v8l-7 4-7-4V6z" />
    {:else if l.glyph === 'ring'}<circle cx="10" cy="10" r="7" /><circle cx="10" cy="10" r="3" />
    {:else if l.glyph === 'wave'}<path d="M2 8c3-3 5 3 8 0s5 3 8 0M2 13c3-3 5 3 8 0s5 3 8 0" />
    {:else if l.glyph === 'bars'}<path d="M3 17V9M8 17V5M13 17v-6M18 17V3" />
    {:else if l.glyph === 'diamond'}<path d="M10 2l8 8-8 8-8-8zM10 7l3 3-3 3-3-3z" />
    {:else if l.glyph === 'spark'}<path d="M10 2v5M10 13v5M2 10h5M13 10h5M4.5 4.5l3 3M12.5 12.5l3 3M15.5 4.5l-3 3M7.5 12.5l-3 3" />
    {:else if l.glyph === 'arc'}<path d="M2 16a8 8 0 0 1 16 0M6 16a4 4 0 0 1 8 0" />
    {:else if l.glyph === 'grid'}<path d="M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z" />
    {:else if l.glyph === 'tri'}<path d="M10 3l8 14H2zM10 9l3 5H7z" />
    {:else}<circle cx="5" cy="10" r="2" /><circle cx="10" cy="10" r="2" /><circle cx="15" cy="10" r="2" />{/if}
  </svg>
  <span class="sv-logos-name sv-logos-face-{l.face ?? 'sans'}">{l.name}</span>
{/snippet}

<section class="sv-logos" aria-labelledby="sv-logos-title">
  <h2 id="sv-logos-title">Ops teams run their day on Fieldline</h2>
  <p class="sv-logos-proof">{cloud.proof}</p>

  <ul class="sv-logos-grid">
    {#each cloud.logos as l (l.id)}
      <li>
        {#if l.href}
          <a class="sv-logos-cell sv-logos-is-link" {...cloud.linkProps(l)}>{@render mark(l)}</a>
        {:else}
          <div class="sv-logos-cell" role="img" aria-label={l.name}>{@render mark(l)}</div>
        {/if}
      </li>
    {/each}
  </ul>

  <div class="sv-logos-foot">
    <span>{cloud.linkedCount} of these teams wrote up how they use it.</span>
    <SvButton variant="outline" size="sm" onclick={cloud.viewAll}>All customer stories</SvButton>
  </div>
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-logos {
    display: flex; flex-direction: column; align-items: center;
    width: 100%; box-sizing: border-box; padding: 56px 40px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
    text-align: center;
  }
  .sv-logos h2 { margin: 0 0 8px; font-size: 26px; font-weight: 700; letter-spacing: -.02em; line-height: 1.25; }
  .sv-logos-proof { margin: 0 0 32px; max-width: 600px; color: var(--sg-muted, #64748b); font-size: 15px; line-height: 1.55; }
  .sv-logos-grid {
    list-style: none; margin: 0; padding: 0; width: 100%; max-width: 920px;
    display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: var(--sg-radius-lg, 12px); overflow: hidden;
  }
  /* Each cell draws its right and bottom rule; the frame clips the outer ones, so a short last row stays clean. */
  .sv-logos-grid li { display: flex; box-shadow: 1px 0 0 var(--sg-border, #e2e8f0), 0 1px 0 var(--sg-border, #e2e8f0); }
  .sv-logos-cell {
    display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%; min-height: 92px; padding: 0 10px;
    box-sizing: border-box; text-decoration: none; white-space: nowrap;
    color: color-mix(in srgb, var(--sg-fg, #0f172a) 50%, var(--sg-bg, #fff));
    transition: color .15s, background .15s;
  }
  .sv-logos-cell svg { display: block; flex: none; width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .sv-logos-is-link:hover, .sv-logos-is-link:focus-visible {
    color: var(--sg-fg, #0f172a); background: color-mix(in srgb, var(--sg-fg, #0f172a) 4%, var(--sg-bg, #fff));
  }
  .sv-logos-is-link:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: -3px; }
  .sv-logos-name { font-size: 16px; font-weight: 700; letter-spacing: -.02em; }
  .sv-logos-face-serif { font-family: Georgia, 'Times New Roman', serif; font-weight: 600; letter-spacing: 0; }
  .sv-logos-face-caps { font-size: 13px; text-transform: uppercase; letter-spacing: .12em; }
  .sv-logos-face-mono { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 14.5px; font-weight: 600; letter-spacing: -.03em; }
  .sv-logos-foot { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 10px 14px; margin-top: 24px; font-size: 13.5px; color: var(--sg-muted, #64748b); }
  @media (prefers-reduced-motion: reduce) { .sv-logos-cell { transition: none; } }

  @media (max-width: 860px) {
    .sv-logos-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
  @media (max-width: 480px) {
    .sv-logos { padding: 36px 16px; }
    .sv-logos h2 { font-size: 22px; }
    .sv-logos-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .sv-logos-cell { min-height: 72px; gap: 6px; }
    .sv-logos-name { font-size: 14px; }
    .sv-logos-face-caps { font-size: 11.5px; letter-spacing: .08em; }
    .sv-logos-face-mono { font-size: 13px; }
  }
</style>
