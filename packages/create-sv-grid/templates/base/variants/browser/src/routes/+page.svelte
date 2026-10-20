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
  {#if !tables.length}
    <!-- The schema runs on every load while the database has no tables. -->
    <p>No tables yet. Add a table to <code>db/schema.sql</code> and reload. Tables made with "Add table" here are not saved.</p>
  {/if}
  <div class="fill">
    <SvBase {tables} editable sortable showRowNumbers expandRows columnAdder fieldMenu containerHeight="100%" />
  </div>
{:catch error}
  <p>The database did not open: {error.message}</p>
{/await}

<style>
  .fill { flex: 1; min-height: 0; }
</style>
