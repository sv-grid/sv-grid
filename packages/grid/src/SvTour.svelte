<script lang="ts" module>
  export type { TourStep } from './ui-app.types'
</script>

<script lang="ts">
  /**
   * SvTour - a guided product tour / onboarding: it spotlights each step's target
   * element (a dimmed backdrop with a cut-out), anchors a popover with the step's
   * title/content near it, and steps Back / Next / Done. Arrow keys navigate,
   * Escape skips. Portalled to <body>. Controlled via `open`.
   *
   * ```svelte
   * <SvTour bind:open steps={[
   *   { target: '#new-btn', title: 'Create', content: 'Start here.' },
   *   { target: '.grid', title: 'Your data', content: 'It shows up here.' },
   * ]} />
   * ```
   */
  import type { TourStep } from './ui-app.types'
  import { portalToBody } from './popover'

  type Props = {
    steps: ReadonlyArray<TourStep>
    open?: boolean
    onFinish?: () => void
    onSkip?: () => void
    onStep?: (index: number) => void
  }

  let { steps, open = $bindable(false), onFinish, onSkip, onStep }: Props = $props()

  let index = $state(0)
  let rect = $state<DOMRect | null>(null)
  const step = $derived(steps[index])

  function targetEl(): HTMLElement | null {
    const t = step?.target
    if (!t) return null
    return typeof t === 'string' ? document.querySelector<HTMLElement>(t) : t
  }
  function measure() {
    const el = targetEl()
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    rect = el ? el.getBoundingClientRect() : null
  }
  function goto(i: number) {
    index = Math.max(0, Math.min(i, steps.length - 1))
    onStep?.(index)
    queueMicrotask(measure)
  }
  function next() { if (index >= steps.length - 1) finish(); else goto(index + 1) }
  function back() { goto(index - 1) }
  function finish() { open = false; onFinish?.() }
  function skip() { open = false; onSkip?.() }

  $effect(() => {
    if (!open) return
    index = 0
    queueMicrotask(measure)
    const reflow = () => measure()
    window.addEventListener('resize', reflow)
    window.addEventListener('scroll', reflow, true)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); skip() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back() }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', reflow)
      window.removeEventListener('scroll', reflow, true)
      window.removeEventListener('keydown', onKey)
    }
  })

  const POP_W = 300
  const pop = $derived.by(() => {
    if (typeof window === 'undefined' || !rect) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', place: 'center' as const }
    }
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - POP_W - 12))
    const below = window.innerHeight - rect.bottom
    if (below > 190) return { top: `${rect.bottom + 10}px`, left: `${left}px`, transform: 'none', place: 'bottom' as const }
    return { top: `${rect.top - 10}px`, left: `${left}px`, transform: 'translateY(-100%)', place: 'top' as const }
  })
</script>

{#if open && step}
  <div class="sv-tour" use:portalToBody>
    {#if rect}
      <div
        class="sv-tour__spot"
        style:top={`${rect.top - 6}px`}
        style:left={`${rect.left - 6}px`}
        style:width={`${rect.width + 12}px`}
        style:height={`${rect.height + 12}px`}
      ></div>
    {:else}
      <div class="sv-tour__backdrop"></div>
    {/if}

    <div
      class="sv-tour__pop sv-tour__pop--{pop.place}"
      style:top={pop.top}
      style:left={pop.left}
      style:transform={pop.transform}
      role="dialog"
      aria-modal="true"
      aria-label={step.title ?? 'Tour step'}
    >
      {#if step.title}<div class="sv-tour__title">{step.title}</div>{/if}
      <div class="sv-tour__body">{step.content}</div>
      <div class="sv-tour__foot">
        <span class="sv-tour__count">{index + 1} / {steps.length}</span>
        <div class="sv-tour__btns">
          <button type="button" class="sv-tour__skip" onclick={skip}>Skip</button>
          {#if index > 0}<button type="button" class="sv-tour__back" onclick={back}>Back</button>{/if}
          <button type="button" class="sv-tour__next" onclick={next}>{index === steps.length - 1 ? 'Done' : 'Next'}</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  :global(.sv-tour) { position: fixed; inset: 0; z-index: 2147483000; }
  :global(.sv-tour__backdrop) { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55); }
  :global(.sv-tour__spot) {
    position: fixed; border-radius: 8px; pointer-events: none;
    box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.55); transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }
  :global(.sv-tour__pop) {
    position: fixed; z-index: 1; width: 300px; max-width: calc(100vw - 24px);
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 12px; padding: 14px 16px;
    box-shadow: 0 20px 48px -16px rgba(15, 23, 42, 0.5);
    animation: sv-tour-in 0.16s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes sv-tour-in { from { opacity: 0; transform: translateY(4px) } }
  :global(.sv-tour__pop--top) { animation: none; }
  :global(.sv-tour__title) { font-size: 14.5px; font-weight: 650; margin-bottom: 4px; }
  :global(.sv-tour__body) { font-size: 13px; line-height: 1.55; color: var(--sg-fg, #334155); }
  :global(.sv-tour__foot) { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 14px; }
  :global(.sv-tour__count) { font-size: 12px; color: var(--sg-muted, #94a3b8); font-variant-numeric: tabular-nums; }
  :global(.sv-tour__btns) { display: flex; gap: 6px; }
  :global(.sv-tour__skip), :global(.sv-tour__back), :global(.sv-tour__next) {
    font: inherit; font-size: 12.5px; padding: 5px 12px; border-radius: 7px; cursor: pointer; border: 1px solid var(--sg-border, #cbd5e1); background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
  }
  :global(.sv-tour__skip) { border-color: transparent; background: none; color: var(--sg-muted, #64748b); }
  :global(.sv-tour__next) { background: var(--sg-accent, #2563eb); border-color: var(--sg-accent, #2563eb); color: var(--sg-on-accent, #fff); }
</style>
