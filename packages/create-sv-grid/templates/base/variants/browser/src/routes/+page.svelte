<script lang="ts">
  import { SvBase, baseFromDatabase, enableBase } from '@svgrid/enterprise/base'
  import { execute } from '$lib/db'

  enableBase()
  // Every table of the database becomes a tab: fields from the columns,
  // links from the foreign keys, views that fit. Edits are written back.
  const tables = baseFromDatabase({ execute })
</script>

{#await tables}
  <p>Opening the database…</p>
{:then tables}
  <SvBase {tables} editable sortable showRowNumbers expandRows columnAdder fieldMenu containerHeight="100%" />
{:catch error}
  <p>The database did not open: {error.message}</p>
{/await}
