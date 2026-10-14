<!-- Stands in for the Enterprise gallery renderer (svgrid.gallery-mode.test.ts). -->
<script lang="ts">
  let { data, gallery }: { data: Array<{ name: string }>; gallery: { titleField?: string } } = $props()
</script>

<ul class="probe-gallery" data-title={gallery.titleField}>
  {#each data as row (row.name)}<li>{row.name}</li>{/each}
</ul>
