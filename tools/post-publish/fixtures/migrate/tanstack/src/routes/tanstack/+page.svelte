<script lang="ts">
  import PaymentsTable from '../../lib/payments/payments-table.svelte'
  import { payments } from '../../lib/payments/payments'
</script>

<h1>Payments</h1>
<div style="height: 360px">
  <PaymentsTable data={payments} />
</div>
