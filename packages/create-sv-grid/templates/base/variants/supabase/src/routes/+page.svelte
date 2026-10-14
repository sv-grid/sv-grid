<script lang="ts">
  import { SvBase, baseFromSupabase, enableBase } from '@svgrid/enterprise/base'
  import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public'
  import { supabase } from '$lib/supabase'

  enableBase()
  // Every table the key can read becomes a tab, live: other people's changes
  // arrive through Supabase Realtime.
  const tables = baseFromSupabase({ client: supabase as never, url: PUBLIC_SUPABASE_URL, key: PUBLIC_SUPABASE_ANON_KEY })
</script>

{#await tables}
  <p>Reading the project…</p>
{:then tables}
  <SvBase {tables} editable sortable showRowNumbers expandRows columnAdder fieldMenu containerHeight="100%" />
{:catch error}
  <p>Supabase did not answer: {error.message}. Are PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY set in .env?</p>
{/await}
