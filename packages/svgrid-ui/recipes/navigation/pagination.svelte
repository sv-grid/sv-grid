<script lang="ts">
  // SvPagination - a standalone pager with prev/next and page numbers. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-pagination
  import { SvPagination } from '@svgrid/grid'

  let page = $state(1)
</script>

<SvPagination
  {page}
  pageCount={20}
  showFirstLast
  onChange={(n) => (page = n)}
/>
