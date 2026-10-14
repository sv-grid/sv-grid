<script lang="ts">
  // Stands in for an Enterprise module's field cell (svgrid.grid-extension.test.ts).
  let { value }: { value?: unknown } = $props()
</script>

<span class="probe-cell">[{String(value)}]</span>
