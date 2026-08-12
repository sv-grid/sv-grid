<script lang="ts">
  /**
   * SvLoadingOverlay - covers its container with a translucent scrim + spinner
   * while `visible`, blocking interaction underneath. Wrap any positioned region
   * (a card, a panel, a form) and toggle it during an async load.
   *
   * ```svelte
   * <div style="position:relative">
   *   <SvLoadingOverlay visible={loading} label="Saving" />
   *   ...content...
   * </div>
   * ```
   */
  import type { Snippet } from 'svelte'
  import SvSpinner from './SvSpinner.svelte'

  type Props = {
    /** Show the overlay. */
    visible?: boolean
    /** Text shown under the spinner (also the a11y label). */
    label?: string
    /** Spinner size. Default `lg`. */
    spinnerSize?: 'sm' | 'md' | 'lg' | number
    /** Blur the content behind the scrim. */
    blur?: boolean
    /** Custom overlay content instead of the default spinner + label. */
    children?: Snippet
  }

  let { visible = false, label, spinnerSize = 'lg', blur = false, children }: Props = $props()
</script>

{#if visible}
  <div class="sv-loading" class:is-blur={blur} role="status" aria-label={label ?? 'Loading'} aria-live="polite">
    {#if children}
      {@render children()}
    {:else}
      <SvSpinner size={spinnerSize} />
      {#if label}<span class="sv-loading__label">{label}</span>{/if}
    {/if}
  </div>
{/if}

<style>
  .sv-loading {
    position: absolute; inset: 0; z-index: 20;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
    background: color-mix(in srgb, var(--sg-bg, #fff) 68%, transparent);
    border-radius: inherit; cursor: progress;
  }
  .sv-loading.is-blur { backdrop-filter: blur(2px); }
  .sv-loading__label { font-size: 13px; font-weight: 550; color: var(--sg-muted, #64748b); }
</style>
