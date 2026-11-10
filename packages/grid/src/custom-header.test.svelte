<!-- A header renderer with plain text, the sort state it was handed, and a button of its own, for the custom-header tests (svgrid.behavior.test.ts). -->
<script lang="ts">
  let { label, sorted = false, onMenu }: { label: string; sorted?: false | 'asc' | 'desc'; onMenu?: () => void } = $props()
</script>

<span class="probe-header-label">{label}</span>
<span class="probe-header-sort">{sorted || ''}</span>
<button type="button" class="probe-header-btn" onclick={onMenu}>...</button>
