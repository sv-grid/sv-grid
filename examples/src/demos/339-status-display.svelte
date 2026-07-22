<script lang="ts">
  /**
   * Status & display kit: SvAlert (inline messages), SvStat (KPI cards),
   * SvTimeline (activity feed), SvChip (removable/clickable pills), SvDivider
   * (labeled separators) and SvEmptyState. All theme-driven.
   */
  import { SvAlert, SvEmptyState, SvDivider, SvChip, SvStat, SvTimeline, SvButton, SvAvatar, type TimelineItem } from '@svgrid/grid'

  let tags = $state(['Design', 'Frontend', 'Urgent'])
  const removeTag = (t: string) => (tags = tags.filter((x) => x !== t))

  const activity: TimelineItem[] = [
    { title: 'Order #1042 placed', time: '09:12', color: '#16a34a', icon: '✓' },
    { title: 'Payment captured', time: '09:13', description: '$248.00 via card ending 4242', color: '#2563eb' },
    { title: 'Picked & packed', time: '11:40', color: '#7c3aed' },
    { title: 'Shipped', time: '14:05', description: 'Tracking 1Z…88, DHL Express', color: '#0891b2' },
    { title: 'Out for delivery', time: 'Tomorrow', color: '#d97706' },
  ]
</script>

<div class="wrap">
  <header><h2>Status &amp; display</h2><p>Inline alerts, KPI stats, activity timelines, chips, dividers and empty states.</p></header>

  <section>
    <h3>Alerts</h3>
    <div class="stack">
      <SvAlert variant="info" title="Heads up">A new version is available. <a href="#">Refresh</a> to update.</SvAlert>
      <SvAlert variant="success" soft>Your changes were saved.</SvAlert>
      <SvAlert variant="warning" title="Storage almost full" dismissible>You've used 92% of your quota.</SvAlert>
      <SvAlert variant="danger" title="Payment failed" dismissible>
        We couldn't charge your card.
        {#snippet actions()}<SvButton size="sm" variant="danger">Update card</SvButton><SvButton size="sm" variant="ghost">Dismiss</SvButton>{/snippet}
      </SvAlert>
    </div>
  </section>

  <section>
    <h3>Stats</h3>
    <div class="stats">
      <SvStat label="Revenue" value="$48.2k" delta={12.4} hint="vs last month" />
      <SvStat label="Active users" value="3,914" delta={4.1} hint="vs last week" />
      <SvStat label="Churn" value="1.8%" delta={-0.6} invert hint="lower is better" />
      <SvStat label="Avg. latency" value="182ms" delta={-14} invert hint="p95" />
    </div>
  </section>

  <div class="cols">
    <section>
      <h3>Activity timeline</h3>
      <SvTimeline items={activity} />
    </section>

    <section>
      <h3>Chips &amp; dividers</h3>
      <div class="chips">
        {#each tags as t (t)}<SvChip variant="accent" removable onRemove={() => removeTag(t)}>{t}</SvChip>{/each}
        {#if tags.length === 0}<span class="muted">All cleared.</span>{/if}
      </div>
      <SvDivider label="Assignee" align="start" />
      <div class="chips">
        <SvChip>{#snippet leading()}<SvAvatar size="sm" name="Ada Lovelace" />{/snippet}Ada Lovelace</SvChip>
        <SvChip variant="success" solid>Approved</SvChip>
        <SvChip variant="warning">Pending</SvChip>
      </div>
      <SvDivider />
      <div class="row">
        Filters <SvDivider orientation="vertical" /> 3 active <SvDivider orientation="vertical" /> <a href="#">Clear</a>
      </div>
    </section>
  </div>

  <section>
    <h3>Empty state</h3>
    <div class="panel">
      <SvEmptyState title="No invoices yet" description="Invoices you create will show up here. Start by adding your first one.">
        <SvButton>New invoice</SvButton>
        <SvButton variant="ghost">Import</SvButton>
      </SvEmptyState>
    </div>
  </section>
</div>

<style>
  .wrap { padding: 20px; max-width: 940px; display: flex; flex-direction: column; gap: 22px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; }
  section h3 { margin: 0 0 12px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .stack { display: flex; flex-direction: column; gap: 10px; max-width: 620px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
  .cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 28px; }
  @media (max-width: 760px) { .cols { grid-template-columns: 1fr; } }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 6px; }
  .row { display: flex; align-items: center; font-size: 13px; color: var(--sg-muted, #64748b); }
  .muted { color: var(--sg-muted, #94a3b8); font-size: 13px; }
  .panel { border: 1px solid var(--sg-border, #e2e8f0); border-radius: 12px; }
  a { color: var(--sg-accent, #2563eb); }
</style>
