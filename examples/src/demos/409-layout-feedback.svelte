<script lang="ts">
  /**
   * Layout + feedback primitives - SvStack / SvGroup / SvSimpleGrid for structure,
   * SvCollapsible for show/hide sections, SvSpinner + SvLoadingOverlay for async
   * states, and SvResult for a full outcome page. All themed from the --sg-* tokens.
   */
  import {
    SvStack, SvGroup, SvSimpleGrid, SvCollapsible, SvSpinner, SvLoadingOverlay, SvResult,
    SvCard, SvStat, SvButton, SvBadge,
  } from '@svgrid/grid'

  let loading = $state(false)
  let advanced = $state(false)
  let done = $state(false)
  function run() {
    loading = true
    setTimeout(() => { loading = false; done = true }, 1200)
  }
</script>

<div class="page">
<SvStack gap={22}>
  <section>
    <h3>Layout primitives</h3>
    <SvSimpleGrid minChildWidth={150} gap={12}>
      <SvCard><SvStat label="Revenue" value="$84k" delta="+12%" trend="up" /></SvCard>
      <SvCard><SvStat label="Orders" value="1,204" delta="+3%" trend="up" /></SvCard>
      <SvCard><SvStat label="Refunds" value="18" delta="-2%" trend="down" invert /></SvCard>
    </SvSimpleGrid>
  </section>

  <section>
    <h3>Group (toolbar row)</h3>
    <SvGroup gap={8} justify="between">
      <SvGroup gap={6}><SvBadge variant="accent">Live</SvBadge><span class="muted">3 running</span></SvGroup>
      <SvGroup gap={6}><SvButton size="sm" variant="ghost">Filter</SvButton><SvButton size="sm" variant="outline">Export</SvButton></SvGroup>
    </SvGroup>
  </section>

  <section>
    <h3>Collapsible</h3>
    <SvStack gap={8}>
      <SvCollapsible title="Shipping details" open>
        <p class="muted">Standard delivery, 3-5 business days. Tracking sent on dispatch.</p>
      </SvCollapsible>
      <SvCollapsible title="Advanced options" bind:open={advanced}>
        <SvStack gap={6}>
          <label class="chk"><input type="checkbox" /> Signature on delivery</label>
          <label class="chk"><input type="checkbox" /> Insure the package</label>
        </SvStack>
      </SvCollapsible>
    </SvStack>
  </section>

  <section>
    <h3>Loading states</h3>
    <SvGroup gap={16} align="center">
      <SvGroup gap={8}><SvSpinner size="sm" /><SvSpinner /><SvSpinner size="lg" /></SvGroup>
      <SvButton variant="primary" onclick={run} disabled={loading}>Run task</SvButton>
    </SvGroup>
    <div class="panel">
      <SvLoadingOverlay visible={loading} label="Processing…" />
      <SvStat label="Batch" value={done ? 'Complete' : 'Idle'} hint={done ? 'Finished at 12:04' : 'Press Run task'} />
    </div>
  </section>

  <section>
    <h3>Result page</h3>
    <div class="result-box">
      <SvResult status="success" title="Payment complete" description="Your receipt is on its way to ada@example.com.">
        {#snippet actions()}
          <SvButton variant="primary">Back to dashboard</SvButton>
          <SvButton variant="ghost">View receipt</SvButton>
        {/snippet}
      </SvResult>
    </div>
  </section>
</SvStack>
</div>

<style>
  .page { padding: 22px; max-width: 640px; }
  section h3 { margin: 0 0 10px; font-size: 14px; font-weight: 700; }
  .muted { color: var(--sg-muted, #64748b); font-size: 13px; }
  .chk { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .panel { position: relative; margin-top: 12px; padding: 16px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; overflow: hidden; }
  .result-box { border: 1px solid var(--sg-border, #e2e8f0); border-radius: 12px; }
</style>
