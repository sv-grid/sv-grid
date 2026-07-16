<script lang="ts">
  import EntityScreen from '$lib/EntityScreen.svelte'
  import { customerSchema } from '$lib/schemas'
  import { customersSource, nextId } from '$lib/data'
</script>

<h1 class="st__title">Customers</h1>
<EntityScreen schema={customerSchema} source={customersSource} newId={() => nextId('c')} />
