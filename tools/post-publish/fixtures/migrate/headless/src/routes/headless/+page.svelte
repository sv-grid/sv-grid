<script lang="ts">
  import OrdersTable from '../../lib/orders/OrdersTable.svelte'
  import { orders } from '../../lib/orders/orders'
</script>

<h1>Orders</h1>
<div style="height: 360px">
  <OrdersTable {orders} />
</div>
