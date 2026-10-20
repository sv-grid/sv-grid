<script lang="ts">
  import { SvBase, baseFromSupabase, enableBase } from '@svgrid/enterprise/base'
  import { supabase, supabaseKey, supabaseUrl } from '$lib/supabase'

  enableBase()
  // Every table the key can read becomes a tab, live: other people's changes
  // arrive through Supabase Realtime.
  const tables = supabase ? baseFromSupabase({ client: supabase as never, url: supabaseUrl, key: supabaseKey }) : null
</script>

{#if !tables}
  <p>Copy <code>.env.example</code> to <code>.env</code> and fill in your project URL and anon key (Project Settings &gt; API in the Supabase dashboard), then restart <code>npm run dev</code>.</p>
{:else}
  {#await tables}
    <p>Reading the project…</p>
  {:then tables}
    {#if !tables.length}
      <p>No tables yet. Create them in the Supabase SQL editor (run <code>db/schema.sql</code>, then <code>db/policies.sql</code>) and reload. Tables made with "Add table" here are not saved.</p>
    {/if}
    <div class="fill">
      <SvBase {tables} editable sortable showRowNumbers expandRows columnAdder fieldMenu containerHeight="100%" />
    </div>
  {:catch error}
    <p>Supabase did not answer: {error.message}. Check PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY in .env.</p>
  {/await}
{/if}

<style>
  .fill { flex: 1; min-height: 0; }
</style>
