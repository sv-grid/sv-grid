<script lang="ts">
  // SvTour - a guided, spotlighted product tour overlay. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-tour
  import { SvTour, SvButton } from '@svgrid/grid'

  let open = $state(false)
  const steps = [
    { target: '#new-btn', title: 'Create', content: 'Start a record here.' },
    { target: '.grid', title: 'Your data', content: 'It shows up in the grid.' },
  ]
</script>

<SvButton onclick={() => (open = true)}>Take the tour</SvButton>

<SvTour bind:open {steps} />
