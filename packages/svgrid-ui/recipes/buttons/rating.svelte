<script lang="ts">
  // SvRating - a star rating control on the ARIA slider pattern. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-rating
  import { SvRating } from '@svgrid/grid'

  let score = $state(4)
</script>

<SvRating label="Your rating" value={score} onChange={(v) => (score = v)} />
