<!-- A grid with field types and a change review, wired as the Base docs show it, for base.dom.test.ts. -->
<script lang="ts">
  import { SvGrid } from '@svgrid/grid'
  import { baseReviewApplied } from '../../fields/index'
  import { createReview, type Review } from '../model.svelte'

  let { initial, columns, withApplied = true, onReady }: {
    initial: any[]
    columns: any[]
    withApplied?: boolean
    onReady: (h: { review: Review<any>; api: any; rows: () => any[] }) => void
  } = $props()

  // svelte-ignore state_referenced_locally
  let rows = $state(initial)
  let api = $state<any>(null)
  // svelte-ignore state_referenced_locally
  const review = createReview<any>({
    api: () => api,
    setRows: (next) => (rows = next),
    onApply: withApplied ? baseReviewApplied(() => api) : undefined,
  })
</script>

<SvGrid
  data={rows}
  columns={review.columns(columns)}
  getRowId={(r: any) => r.id}
  conditionalFormats={review.formats}
  containerHeight={240}
  virtualization={false}
  onApiReady={(a: any) => {
    api = a
    onReady({ review, api: a, rows: () => rows })
  }}
/>
