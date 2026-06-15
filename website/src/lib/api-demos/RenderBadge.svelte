<script lang="ts">
  // A standalone Svelte component used as a cell renderer via renderComponent().
  // renderComponent needs a real component (not a snippet), so this lives in
  // its own file - exactly how you would ship a reusable cell component.
  type Props = { value: string }
  let { value }: Props = $props()

  const tone: Record<string, string> = {
    NA: '#3b82f6',
    EMEA: '#22c55e',
    APAC: '#a855f7',
    LATAM: '#f59e0b',
  }
</script>

<span
  class="inline-block rounded px-2 py-0.5 text-xs font-semibold"
  style:background={`color-mix(in oklab, ${tone[value] ?? '#64748b'} 18%, transparent)`}
  style:color={tone[value] ?? '#64748b'}
>{value}</span>
