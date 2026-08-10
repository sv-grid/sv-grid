<script lang="ts">
  /**
   * SvAnchor - a themed link. Underline on hover by default; `external` adds
   * `target="_blank"` + safe `rel` and an offscreen "opens in new tab" hint.
   *
   * <SvAnchor href="/docs">Read the docs</SvAnchor>
   * <SvAnchor href="https://svelte.dev" external>Svelte</SvAnchor>
   */
  import type { Snippet } from 'svelte'

  type Props = {
    href?: string
    /** Open in a new tab with safe `rel`. */
    external?: boolean
    /** Underline behaviour. */
    underline?: 'hover' | 'always' | 'none'
    /** Semantic colour. */
    tone?: 'accent' | 'default' | 'muted'
    /** Font size step. */
    size?: 'sm' | 'md' | 'lg'
    onclick?: (e: MouseEvent) => void
    children?: Snippet
  }

  let { href, external = false, underline = 'hover', tone = 'accent', size = 'md', onclick, children }: Props = $props()

  const sizeMap = { sm: '13px', md: '14px', lg: '16px' } as const
  const toneMap = {
    accent: 'var(--sg-accent, #2563eb)',
    default: 'var(--sg-fg, #0f172a)',
    muted: 'var(--sg-muted, #64748b)',
  } as const
</script>

<a
  {href}
  {onclick}
  class="sv-anchor sv-anchor--u-{underline}"
  style:font-size={sizeMap[size]}
  style:color={toneMap[tone]}
  target={external ? '_blank' : undefined}
  rel={external ? 'noopener noreferrer' : undefined}
>
  {@render children?.()}{#if external}<span class="sv-anchor__ext" aria-hidden="true">↗</span><span class="sv-anchor__sr">(opens in a new tab)</span>{/if}
</a>

<style>
  .sv-anchor {
    font-family: var(--sg-font, inherit);
    text-decoration: none;
    border-radius: 2px;
    cursor: pointer;
  }
  .sv-anchor--u-always { text-decoration: underline; text-underline-offset: 2px; }
  .sv-anchor--u-hover:hover { text-decoration: underline; text-underline-offset: 2px; }
  .sv-anchor:focus-visible {
    outline: 2px solid var(--sg-focus-ring, #2563eb);
    outline-offset: 2px;
  }
  .sv-anchor__ext { margin-left: 2px; font-size: 0.85em; }
  .sv-anchor__sr {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }
</style>
