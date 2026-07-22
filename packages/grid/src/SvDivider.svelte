<script lang="ts">
  /**
   * SvDivider - a separator line, horizontal or vertical, optionally with a
   * centered / start / end label. Theme-driven. Parity: Smart divider.
   *
   * ```svelte
   * <SvDivider />
   * <SvDivider label="OR" />
   * <SvDivider orientation="vertical" />
   * ```
   */
  import type { Snippet } from 'svelte'

  type Props = {
    orientation?: 'horizontal' | 'vertical'
    label?: string
    /** Label position along a horizontal divider. */
    align?: 'start' | 'center' | 'end'
    dashed?: boolean
    children?: Snippet
  }

  let { orientation = 'horizontal', label, align = 'center', dashed = false, children }: Props = $props()
  const hasLabel = $derived(!!label || !!children)
</script>

{#if orientation === 'vertical'}
  <span class="sv-divider sv-divider--v" class:is-dashed={dashed} role="separator" aria-orientation="vertical"></span>
{:else}
  <div class="sv-divider sv-divider--h sv-divider--{align}" class:is-dashed={dashed} class:has-label={hasLabel} role="separator">
    {#if hasLabel}<span class="sv-divider__label">{#if children}{@render children()}{:else}{label}{/if}</span>{/if}
  </div>
{/if}

<style>
  .sv-divider--h {
    --_line: var(--sg-border, #e2e8f0);
    height: 1px; background: var(--_line); border: 0; margin: 12px 0;
  }
  .sv-divider--h.is-dashed { height: 0; background: none; border-top: 1px dashed var(--_line); }
  .sv-divider--h.has-label {
    height: auto; background: none; display: flex; align-items: center; gap: 12px;
    color: var(--sg-muted, #64748b); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em;
  }
  .sv-divider--h.has-label::before, .sv-divider--h.has-label::after {
    content: ''; height: 1px; background: var(--_line);
  }
  .sv-divider--h.has-label.is-dashed::before, .sv-divider--h.has-label.is-dashed::after { height: 0; border-top: 1px dashed var(--_line); }
  .sv-divider--center::before, .sv-divider--center::after { flex: 1; }
  .sv-divider--start::before { width: 16px; flex: none; }
  .sv-divider--start::after { flex: 1; }
  .sv-divider--end::before { flex: 1; }
  .sv-divider--end::after { width: 16px; flex: none; }
  .sv-divider__label { flex: none; }

  .sv-divider--v {
    display: inline-block; width: 1px; align-self: stretch; min-height: 1em;
    background: var(--sg-border, #e2e8f0); margin: 0 12px; vertical-align: middle;
  }
  .sv-divider--v.is-dashed { width: 0; background: none; border-inline-start: 1px dashed var(--sg-border, #e2e8f0); }
</style>
