<script lang="ts">
  // Stands in for an Enterprise module's cell mark (svgrid.cell-decor.test.ts).
  let { value }: { value?: unknown } = $props()
</script>

<span class="probe-decor">+{String(value)}</span>
