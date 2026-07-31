/**
 * createStepper - the HEADLESS core behind <SvStepper>: per-step status
 * (complete / active / upcoming), the linear-vs-free clickability rule, and
 * navigation, as pure getters + prop-getters. No runes, framework-free, directly
 * unit-testable.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createStepper } from '@svgrid/grid'
 *   const st = createStepper({ count: () => steps.length, current: () => i, onChange: (n) => (i = n) })
 * </script>
 * <ol>
 *   {#each steps as step, idx}
 *     <li class="is-{st.statusOf(idx)}">
 *       <button {...st.stepButtonProps(idx)}>{step.label}</button>
 *     </li>
 *   {/each}
 * </ol>
 * ```
 */
export type StepStatus = 'complete' | 'active' | 'upcoming'

export type StepperConfig = {
  count: () => number
  /** 0-based index of the active step. */
  current: () => number
  onChange?: (index: number) => void
  /** Only allow navigating to already-reached steps. Default true. */
  linear?: () => boolean
}

export function createStepper(config: StepperConfig) {
  const current = () => config.current()
  const linear = () => config.linear?.() ?? true

  const statusOf = (i: number): StepStatus =>
    i < current() ? 'complete' : i === current() ? 'active' : 'upcoming'
  const clickable = (i: number) => (linear() ? i <= current() : true)
  const go = (i: number) => {
    if (clickable(i) && i !== current()) config.onChange?.(i)
  }
  const next = () => go(current() + 1)
  const prev = () => go(current() - 1)

  return {
    statusOf,
    clickable,
    go,
    next,
    prev,
    isActive: (i: number) => i === current(),
    /** Spread onto a step's button. */
    stepButtonProps: (i: number) => ({
      'aria-current': (statusOf(i) === 'active' ? 'step' : undefined) as 'step' | undefined,
      disabled: !clickable(i),
      onclick: () => go(i),
    }),
  }
}

export type Stepper = ReturnType<typeof createStepper>
