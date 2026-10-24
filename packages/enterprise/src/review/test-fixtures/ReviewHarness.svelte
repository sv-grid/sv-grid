<!-- A grid wired to a change review the way the docs show it, for the DOM tests. -->
<script lang="ts">
  import { SvGrid } from '@svgrid/grid'
  import { createReview, type Review } from '../model.svelte'
  import SvReviewPanel from '../SvReviewPanel.svelte'

  let { initial, columns, onReady, confirmOver = 50, extra = {} }: {
    initial: any[]
    columns: any[]
    onReady: (h: { review: Review<any>; api: any; rows: () => any[] }) => void
    confirmOver?: number
    /** More SvGrid props (a board, a gallery). */
    extra?: Record<string, unknown>
  } = $props()

  // svelte-ignore state_referenced_locally
  let rows = $state(initial)
  let api = $state<any>(null)
  const review = createReview<any>({ api: () => api, setRows: (next) => (rows = next) })
</script>

<SvGrid
  {...extra}
  data={rows}
  columns={review.columns(columns)}
  getRowId={(r: any) => r.id}
  conditionalFormats={review.formats}
  rowHeight={32}
  containerHeight={240}
  virtualization={false}
  onApiReady={(a: any) => {
    api = a
    onReady({ review, api: a, rows: () => rows })
  }}
/>
<SvReviewPanel {review} {confirmOver} />
