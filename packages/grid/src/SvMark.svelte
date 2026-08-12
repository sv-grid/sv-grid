<script lang="ts">
  /**
   * SvMark - highlighted inline text (a themed `<mark>`), for search-hit
   * highlighting and call-outs. Colour by `tone`.
   *
   * <SvMark>matched</SvMark> · <SvMark tone="success">passed</SvMark>
   */
  import type { Snippet } from 'svelte'

  type Props = {
    tone?: 'yellow' | 'accent' | 'success' | 'warning' | 'error'
    children?: Snippet
  }

  let { tone = 'yellow', children }: Props = $props()

  // Each tone is a soft tint + a readable foreground.
  const bg = {
    yellow: '#fef08a',
    accent: 'color-mix(in srgb, var(--sg-accent, #2563eb) 22%, transparent)',
    success: 'color-mix(in srgb, var(--sg-success, #16a34a) 22%, transparent)',
    warning: 'color-mix(in srgb, var(--sg-warning, #d97706) 24%, transparent)',
    error: 'color-mix(in srgb, var(--sg-danger, #dc2626) 20%, transparent)',
  } as const
</script>

<mark class="sv-mark" style:background={bg[tone]}>{@render children?.()}</mark>

<style>
  .sv-mark {
    color: inherit;
    padding: 0 2px;
    border-radius: 3px;
    font-family: inherit;
  }
</style>
