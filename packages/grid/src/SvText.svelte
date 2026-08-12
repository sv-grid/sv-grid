<script lang="ts">
  /**
   * SvText - the workhorse text primitive: a paragraph or inline span with
   * consistent size / weight / colour tokens, optional truncation and line
   * clamping. Themes from the shared `--sg-*` tokens.
   *
   * <SvText size="sm" tone="muted">Last synced 2 minutes ago</SvText>
   * <SvText clamp={2}>A long description that wraps then ellipsises...</SvText>
   */
  import type { Snippet } from 'svelte'

  type Props = {
    /** Font size step. */
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    /** Font weight. */
    weight?: 'normal' | 'medium' | 'semibold' | 'bold'
    /** Semantic colour. */
    tone?: 'default' | 'muted' | 'accent' | 'success' | 'warning' | 'error'
    /** Text alignment. */
    align?: 'start' | 'center' | 'end'
    /** Truncate to a single line with an ellipsis. */
    truncate?: boolean
    /** Clamp to N lines with an ellipsis (overrides truncate). */
    clamp?: number
    /** Render inline (`span`) instead of a block (`p`). */
    inline?: boolean
    /** Override the element/tag. */
    as?: string
    children?: Snippet
  }

  let {
    size = 'md', weight = 'normal', tone = 'default', align,
    truncate = false, clamp, inline = false, as, children,
  }: Props = $props()

  const sizeMap = { xs: '11px', sm: '13px', md: '14px', lg: '16px', xl: '20px' } as const
  const weightMap = { normal: 400, medium: 500, semibold: 600, bold: 700 } as const
  const toneMap = {
    default: 'var(--sg-fg, #0f172a)',
    muted: 'var(--sg-muted, #64748b)',
    accent: 'var(--sg-accent, #2563eb)',
    success: 'var(--sg-success, #16a34a)',
    warning: 'var(--sg-warning, #d97706)',
    error: 'var(--sg-danger, #dc2626)',
  } as const
  const alignMap = { start: 'left', center: 'center', end: 'right' } as const

  const tag = $derived(as ?? (inline ? 'span' : 'p'))
</script>

<svelte:element
  this={tag}
  class="sv-text"
  class:is-truncate={truncate && !clamp}
  class:is-clamp={clamp != null}
  style:font-size={sizeMap[size]}
  style:font-weight={weightMap[weight]}
  style:color={toneMap[tone]}
  style:text-align={align ? alignMap[align] : undefined}
  style:--sv-text-clamp={clamp}
>
  {@render children?.()}
</svelte:element>

<style>
  .sv-text { margin: 0; font-family: var(--sg-font, inherit); line-height: 1.5; }
  .sv-text.is-truncate { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .sv-text.is-clamp {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: var(--sv-text-clamp, 2);
    line-clamp: var(--sv-text-clamp, 2);
    overflow: hidden;
  }
</style>
