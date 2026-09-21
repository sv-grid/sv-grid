<script lang="ts">
  import PeopleTable from './PeopleTable.svelte'
  import { people, type Person } from './people'

  let selected = $state<Person | null>(null)
</script>

<h1>People</h1>
<PeopleTable {people} pageSize={5} onselect={(p) => (selected = p)} />
{#if selected}
  <p>Selected: {selected.name}</p>
{/if}
