# SvTour

A guided product tour: it spotlights each target element in turn, anchors a
popover with the step's copy, and walks the user through Back / Next / Done.

`SvTour` is the onboarding overlay. Each step names a target - a CSS selector or
an element - which it dims around with a cut-out spotlight, scrolls into view, and
labels with a popover placed above or below depending on room. It steps forward
and back, tracks progress ("2 / 4"), and can be skipped. Arrow keys navigate,
Escape skips, and everything is portalled to `<body>`. Steps with no target render
centered, handy for an intro or outro.

<div data-docs-demo="342-carousel-tour" data-height="440"></div>

## Basic usage

```svelte
<script lang="ts">
  import { SvTour } from '@svgrid/grid'
  let open = $state(false)
</script>

<SvButton onclick={() => (open = true)}>Take the tour</SvButton>

<SvTour bind:open steps={[
  { target: '#new-btn', title: 'Create', content: 'Start a record here.' },
  { target: '.grid', title: 'Your data', content: 'It shows up in the grid.' },
]} />
```

## Props

| Prop       | Type                        | Default   | Description                                                    |
| ---------- | --------------------------- | --------- | -------------------------------------------------------------- |
| `steps`    | `ReadonlyArray<TourStep>`   | -         | The ordered tour steps.                                        |
| `open`     | `boolean`                   | `false`   | Whether the tour is running (bindable).                        |
| `onFinish` | `() => void`                | -         | Fires when the user reaches Done.                              |
| `onSkip`   | `() => void`                | -         | Fires when the user skips or presses Escape.                   |
| `onStep`   | `(index: number) => void`   | -         | Fires whenever the active step changes.                        |

`TourStep` (exported): `{ target?: string | HTMLElement; title?: string; content: string }`.
`target` is a CSS selector or the element itself; omit it for a centered,
target-less step (an intro or outro). `content` is required.

## Patterns

### Show the tour once

Gate `open` on a stored flag so returning users are not re-onboarded:

```svelte
<script lang="ts">
  let open = $state(!localStorage.getItem('toured'))
</script>

<SvTour bind:open onFinish={() => localStorage.setItem('toured', '1')} {steps} />
```

### An intro step with no target

Leave `target` off the first step for a welcome card centered on screen:

```svelte
<SvTour bind:open steps={[
  { title: 'Welcome', content: 'Let us show you around in 30 seconds.' },
  { target: '#sidebar', title: 'Navigate', content: 'Everything lives here.' },
]} />
```

### React to progress

Use `onStep` to lazy-load or highlight related UI as the tour advances:

```svelte
<SvTour bind:open {steps} onStep={(i) => analytics.track('tour_step', i)} />
```

### First-visit onboarding with replay

A complete onboarding flow: a centered intro, three anchored steps, a centered
outro, auto-start on first visit, and a Help button to replay it later. Start it
from `onMount` so the target elements exist before the first step measures them,
and persist the "seen" flag from both `onFinish` and `onSkip`:

```svelte
<script lang="ts">
  import { SvTour, SvButton, type TourStep } from '@svgrid/grid'
  import { onMount } from 'svelte'

  const steps: TourStep[] = [
    { title: 'Welcome to Orders', content: 'A 20-second look at the essentials.' },
    { target: '#new-btn', title: 'Create', content: 'Start a new order from here.' },
    { target: '.sv-grid', title: 'Your data', content: 'Every order lands in this grid.' },
    { target: '#filter', title: 'Filter', content: 'Narrow the list with quick filters.' },
    { title: 'You are set', content: 'Reopen this any time from Help.' },
  ]

  let open = $state(false)
  onMount(() => { if (!localStorage.getItem('toured')) open = true })
  const done = () => localStorage.setItem('toured', '1')
</script>

<SvButton onclick={() => (open = true)}>Replay tour</SvButton>

<SvTour bind:open {steps} onFinish={done} onSkip={done} />
```

Tip: a step whose `target` selector matches nothing (not mounted yet, or removed)
falls back to a centered, target-less popover rather than erroring - which is also
exactly how the intro and outro steps here render, since they carry no `target`.

## Accessibility

- The step popover is a `role="dialog"` with `aria-modal`, labelled by the step
  title.
- Arrow Right / Left move Next / Back; Escape skips the tour.
- The spotlight tracks the target on scroll and resize so the highlight stays
  aligned.
- The target is scrolled into view (`block: center`) as each step opens.

## See also

- [Navigation overview](navigation.md) - the wayfinding family at a glance.
- [SvCommand](sv-command.md) - the Cmd+K action launcher.
- [SvStepper](sv-stepper.md) - inline progress through an ordered flow.
