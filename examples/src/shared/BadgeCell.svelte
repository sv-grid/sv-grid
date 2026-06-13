<script lang="ts">
  let { label, tone }: { label: string; tone: 'good' | 'bad' | 'warn' } = $props()
</script>

<span class="bc" class:good={tone === 'good'} class:bad={tone === 'bad'} class:warn={tone === 'warn'}>
  {label}
</span>

<style>
  .bc {
    display: inline-flex; align-items: center;
    padding: 2px 10px; border-radius: 6px;
    font-size: 11.5px; font-weight: 700;
    font-variant-numeric: tabular-nums;
    border: 1px solid currentColor;
  }
  .good { color: #15803d; background: rgba(34,197,94,0.12); }
  .bad  { color: #b91c1c; background: rgba(239,68,68,0.12); }
  .warn { color: #b45309; background: rgba(245,158,11,0.14); }
  :global([data-theme='dark']) .good { color: #86efac; }
  :global([data-theme='dark']) .bad  { color: #fca5a5; }
  :global([data-theme='dark']) .warn { color: #fcd34d; }
</style>
