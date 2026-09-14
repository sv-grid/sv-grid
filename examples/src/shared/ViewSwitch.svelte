<script lang="ts" generics="T extends string">
  /**
   * A segmented switch between views (Chart | Grid on the chart demos, the
   * way the board demos switch Board | Table). Chrome reads the --sg-* tokens
   * only; the active segment takes the accent.
   */
  let {
    value = $bindable(),
    options,
    label = 'View',
  }: { value: T; options: ReadonlyArray<readonly [T, string]>; label?: string } = $props()
</script>

<div class="switch" role="group" aria-label={label}>
  {#each options as [key, text] (key)}
    <button type="button" class="seg" class:is-on={value === key} aria-pressed={value === key} onclick={() => (value = key)}>{text}</button>
  {/each}
</div>

<style>
  .switch {
    display: inline-flex;
    flex: none;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 6px;
    overflow: hidden;
    background: var(--sg-bg, #fff);
  }
  .seg {
    font: inherit;
    font-size: 12px;
    padding: 3px 10px;
    border: 0;
    background: transparent;
    color: var(--sg-fg, #0f172a);
    cursor: pointer;
  }
  .seg + .seg {
    border-left: 1px solid var(--sg-border, #e2e8f0);
  }
  .seg.is-on {
    background: var(--sg-accent, #2563eb);
    color: var(--sg-on-accent, #fff);
  }
  .seg:focus-visible {
    outline: 2px solid var(--sg-accent, #2563eb);
    outline-offset: -2px;
  }
</style>
