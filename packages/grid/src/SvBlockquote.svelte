<script lang="ts">
  /**
   * SvBlockquote - a quotation block with an accent rule and an optional citation.
   *
   * <SvBlockquote cite="Ada Lovelace">The Analytical Engine weaves algebraic patterns.</SvBlockquote>
   */
  import type { Snippet } from 'svelte'

  type Props = {
    /** Attribution shown under the quote. */
    cite?: string
    /** Accent colour of the rule. */
    tone?: 'accent' | 'muted' | 'success' | 'warning' | 'error'
    children?: Snippet
  }

  let { cite, tone = 'accent', children }: Props = $props()

  const toneMap = {
    accent: 'var(--sg-accent, #2563eb)',
    muted: 'var(--sg-muted, #64748b)',
    success: 'var(--sg-success, #16a34a)',
    warning: 'var(--sg-warning, #d97706)',
    error: 'var(--sg-danger, #dc2626)',
  } as const
</script>

<blockquote class="sv-blockquote" style:--sv-bq-rule={toneMap[tone]}>
  <div class="sv-blockquote__body">{@render children?.()}</div>
  {#if cite}<footer class="sv-blockquote__cite">- {cite}</footer>{/if}
</blockquote>

<style>
  .sv-blockquote {
    margin: 0;
    padding: 4px 0 4px 16px;
    border-left: 3px solid var(--sv-bq-rule, #2563eb);
    font-family: var(--sg-font, inherit);
    color: var(--sg-fg, #0f172a);
  }
  .sv-blockquote__body { font-size: 15px; line-height: 1.55; }
  .sv-blockquote__cite { margin-top: 8px; font-size: 13px; color: var(--sg-muted, #64748b); }
</style>
