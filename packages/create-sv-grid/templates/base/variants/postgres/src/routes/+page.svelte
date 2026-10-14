<script lang="ts">
  import { SvBase, baseFromEndpoint, enableBase } from '@svgrid/enterprise/base'

  enableBase()
  // Every table of the database becomes a tab: fields from the columns,
  // links from the foreign keys, views that fit. Edits are written back.
  const tables = baseFromEndpoint('/api/base')
</script>

{#await tables}
  <p>Reading the database…</p>
{:then tables}
  <SvBase {tables} editable sortable showRowNumbers expandRows columnAdder fieldMenu containerHeight="100%" />
{:catch error}
  <p>The database did not answer: {error.message}. Is DATABASE_URL set in .env, and did you run <code>npm run db:setup</code>?</p>
{/await}
