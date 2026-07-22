<script lang="ts" module>
  export type { StepItem } from './ui-app.types'
</script>

<script lang="ts">
  /**
   * SvStepper - a progress stepper for wizards/multi-step forms. Shows completed
   * / active / upcoming steps horizontally or vertically. In `linear` mode only
   * completed steps (and the active one) are clickable; otherwise any step is.
   * Parity: Smart steps / wizard nav.
   *
   * ```svelte
   * <SvStepper steps={steps} current={i} onChange={(n) => (i = n)} />
   * ```
   */
  import type { StepItem } from './ui-app.types'

  type Props = {
    steps: ReadonlyArray<StepItem>
    /** 0-based index of the active step. */
    current: number
    onChange?: (index: number) => void
    /** Only allow navigating to already-reached steps. Default true. */
    linear?: boolean
    orientation?: 'horizontal' | 'vertical'
  }

  let { steps, current, onChange, linear = true, orientation = 'horizontal' }: Props = $props()

  const statusOf = (i: number): 'complete' | 'active' | 'upcoming' =>
    i < current ? 'complete' : i === current ? 'active' : 'upcoming'
  const clickable = (i: number) => (linear ? i <= current : true)
  const go = (i: number) => { if (clickable(i) && i !== current) onChange?.(i) }
</script>

<ol class="sv-step sv-step--{orientation}">
  {#each steps as step, i (i)}
    {@const status = statusOf(i)}
    <li class="sv-step__item is-{status}" class:is-clickable={clickable(i)}>
      <button
        type="button"
        class="sv-step__btn"
        aria-current={status === 'active' ? 'step' : undefined}
        disabled={!clickable(i)}
        onclick={() => go(i)}
      >
        <span class="sv-step__marker" aria-hidden="true">
          {#if status === 'complete'}✓{:else}{i + 1}{/if}
        </span>
        <span class="sv-step__text">
          <span class="sv-step__label">{step.label}{#if step.optional}<span class="sv-step__optional"> (optional)</span>{/if}</span>
          {#if step.description}<span class="sv-step__desc">{step.description}</span>{/if}
        </span>
      </button>
      {#if i < steps.length - 1}<span class="sv-step__line" aria-hidden="true"></span>{/if}
    </li>
  {/each}
</ol>

<style>
  .sv-step { --_accent: var(--sg-accent, #2563eb); list-style: none; margin: 0; padding: 0; display: flex; }
  .sv-step--horizontal { flex-direction: row; align-items: flex-start; }
  .sv-step--vertical { flex-direction: column; }
  .sv-step__item { display: flex; position: relative; flex: 1; }
  .sv-step--vertical .sv-step__item { flex-direction: column; }

  .sv-step__btn {
    display: flex; align-items: center; gap: 10px; background: none; border: 0; padding: 4px; margin: 0;
    font: inherit; text-align: start; cursor: default; color: var(--sg-muted, #64748b);
  }
  .sv-step__item.is-clickable .sv-step__btn { cursor: pointer; }
  .sv-step__marker {
    flex: none; width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%;
    font-size: 13px; font-weight: 650;
    background: var(--sg-row-hover-bg, #eef2f7); color: var(--sg-muted, #64748b);
    border: 2px solid transparent; transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .sv-step__item.is-active .sv-step__marker { background: var(--_accent); color: var(--sg-on-accent, #fff); }
  .sv-step__item.is-complete .sv-step__marker { background: color-mix(in srgb, var(--_accent) 16%, transparent); color: var(--_accent); border-color: color-mix(in srgb, var(--_accent) 45%, transparent); }
  .sv-step__item.is-active .sv-step__label, .sv-step__item.is-complete .sv-step__label { color: var(--sg-fg, #0f172a); }

  .sv-step__text { display: flex; flex-direction: column; }
  .sv-step__label { font-size: 13px; font-weight: 600; }
  .sv-step__optional { font-weight: 400; color: var(--sg-muted, #94a3b8); font-size: 11.5px; }
  .sv-step__desc { font-size: 11.5px; color: var(--sg-muted, #94a3b8); }

  .sv-step__line { flex: 1; height: 2px; align-self: center; margin: 0 8px; background: var(--sg-border, #e2e8f0); }
  .sv-step__item.is-complete .sv-step__line { background: color-mix(in srgb, var(--_accent) 45%, var(--sg-border, #e2e8f0)); }
  .sv-step--vertical .sv-step__line { width: 2px; height: auto; min-height: 16px; margin: 4px 0 4px 17px; align-self: flex-start; }
  .sv-step--vertical .sv-step__item { padding-bottom: 4px; }
</style>
