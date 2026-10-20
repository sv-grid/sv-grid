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
  {#if !tables.length}
    <p>No tables yet. Add a table to <code>db/schema.sql</code>, run <code>npm run db:setup</code> and reload. Tables made with "Add table" here are not saved.</p>
  {/if}
  <div class="fill">
    <SvBase {tables} editable sortable showRowNumbers expandRows columnAdder fieldMenu containerHeight="100%" />
  </div>
{:catch error}
  <p>The database did not answer: {error.message}. Is DATABASE_URL set in .env, and did you run <code>npm run db:setup</code>?</p>
{/await}

<style>
  .fill { flex: 1; min-height: 0; }
</style>
