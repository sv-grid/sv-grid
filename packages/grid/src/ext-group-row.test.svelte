<!-- Stands in for an Enterprise module's group header (svgrid.grid-extension.test.ts). -->
<script lang="ts">
  let { value, count }: { value: unknown; count: number } = $props()
</script>

<span class="probe-group">{String(value)} / {count}</span>
