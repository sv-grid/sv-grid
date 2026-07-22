<script lang="ts">
  /**
   * SvCard - a themed surface container with an optional header (title +
   * subtitle or a custom `header` snippet), body, and footer. The building block
   * for dashboards and Studio-generated app screens. Parity: Smart card.
   *
   * ```svelte
   * <SvCard title="Revenue" subtitle="Last 30 days">
   *   <Chart .../>
   *   {#snippet footer()}<a href="/reports">View report</a>{/snippet}
   * </SvCard>
   * ```
   */
  import type { Snippet } from 'svelte'

  type Props = {
    title?: string
    subtitle?: string
    /** Lift + accent border on hover (for clickable cards). */
    hoverable?: boolean
    /** Remove body padding (e.g. a card wrapping a full-bleed grid/table). */
    flush?: boolean
    /** Custom header content; overrides title/subtitle when provided. */
    header?: Snippet
    children?: Snippet
    footer?: Snippet
  }

  let { title, subtitle, hoverable = false, flush = false, header, children, footer }: Props = $props()
  const hasHeader = $derived(!!header || !!title || !!subtitle)
</script>

<div class="sv-card" class:is-hoverable={hoverable}>
  {#if hasHeader}
    <div class="sv-card__header">
      {#if header}
        {@render header()}
      {:else}
        {#if title}<h3 class="sv-card__title">{title}</h3>{/if}
        {#if subtitle}<p class="sv-card__subtitle">{subtitle}</p>{/if}
      {/if}
    </div>
  {/if}
  <div class="sv-card__body" class:is-flush={flush}>{@render children?.()}</div>
  {#if footer}<div class="sv-card__footer">{@render footer()}</div>{/if}
</div>

<style>
  .sv-card {
    display: flex; flex-direction: column;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
    overflow: hidden;
    transition: box-shadow 0.16s, border-color 0.16s, transform 0.16s;
  }
  .sv-card.is-hoverable:hover {
    border-color: color-mix(in srgb, var(--sg-accent, #2563eb) 45%, var(--sg-border, #e2e8f0));
    box-shadow: 0 10px 30px -12px rgba(15, 23, 42, 0.28);
    transform: translateY(-1px);
  }
  @media (prefers-reduced-motion: reduce) { .sv-card.is-hoverable:hover { transform: none; } }
  .sv-card__header { padding: 14px 16px; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-card__title { margin: 0; font-size: 14.5px; font-weight: 650; }
  .sv-card__subtitle { margin: 2px 0 0; font-size: 12.5px; color: var(--sg-muted, #64748b); }
  .sv-card__body { padding: 16px; flex: 1; font-size: 13.5px; line-height: 1.55; }
  .sv-card__body.is-flush { padding: 0; }
  .sv-card__footer {
    padding: 12px 16px; border-top: 1px solid var(--sg-border, #e2e8f0);
    font-size: 13px; color: var(--sg-muted, #64748b);
  }
</style>
