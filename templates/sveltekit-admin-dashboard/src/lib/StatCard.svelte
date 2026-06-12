<script lang="ts">
  let {
    label,
    value,
    hint = '',
  }: { label: string; value: string; hint?: string } = $props()
</script>

<div
  class="rounded-xl border bg-white p-4 shadow-sm"
  style="border-color: var(--app-border);"
>
  <p class="text-xs font-medium uppercase tracking-wide" style="color: var(--app-muted);">
    {label}
  </p>
  <p class="mt-1 text-2xl font-bold" style="color: var(--app-fg);">{value}</p>
  {#if hint}
    <p class="mt-1 text-xs" style="color: var(--app-muted);">{hint}</p>
  {/if}
</div>
