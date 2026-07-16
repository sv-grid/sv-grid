<script lang="ts">
  import EntityScreen from '$lib/EntityScreen.svelte'
  import { orderSchema } from '$lib/schemas'
  import { ordersSource, customerLookup, nextId } from '$lib/data'
</script>

<h1 class="st__title">Orders</h1>
<EntityScreen
  schema={orderSchema}
  source={ordersSource}
  lookups={{ customerId: customerLookup }}
  newId={() => nextId('o')}
/>
