<script lang="ts">
  /**
   * SvBadge, SvAvatar, SvSkeleton and SvCard - status, identity, loading and
   * surface. All theme-token driven (light/dark + presets) and reduced-motion
   * aware. Toggle "Loading" to swap real content for skeletons.
   */
  import { SvBadge, SvAvatar, SvSkeleton, SvCard, SvButton } from '@svgrid/grid'

  let loading = $state(false)

  const people = [
    { name: 'Ada Lovelace', role: 'Engineering', status: 'online' as const },
    { name: 'Alan Turing', role: 'Research', status: 'busy' as const },
    { name: 'Grace Hopper', role: 'Compilers', status: 'away' as const },
  ]
</script>

<div class="wrap">
  <header>
    <h2>Feedback &amp; display</h2>
    <p>Badges, avatars, skeleton loaders and cards - the display layer for dashboards and detail panels.</p>
  </header>

  <section>
    <h3>Badges</h3>
    <div class="row">
      <SvBadge variant="neutral">Draft</SvBadge>
      <SvBadge variant="accent">New</SvBadge>
      <SvBadge variant="success" dot>Active</SvBadge>
      <SvBadge variant="warning">Pending</SvBadge>
      <SvBadge variant="danger" dot>Failed</SvBadge>
      <SvBadge variant="info" pill={false}>v1.2</SvBadge>
    </div>
  </section>

  <section>
    <h3>Avatars</h3>
    <div class="row">
      <SvAvatar name="Ada Lovelace" status="online" />
      <SvAvatar name="Grace Hopper" size="lg" status="away" />
      <SvAvatar name="Alan Turing" shape="square" />
      <SvAvatar size="sm" />
    </div>
  </section>

  <section>
    <div class="head-row">
      <h3>Cards &amp; skeletons</h3>
      <SvButton size="sm" variant="ghost" onclick={() => (loading = !loading)}>{loading ? 'Show content' : 'Show loading'}</SvButton>
    </div>
    <div class="grid">
      {#each people as p (p.name)}
        <SvCard hoverable>
          {#if loading}
            <div class="person"><SvSkeleton variant="circle" width="40px" height="40px" /><SvSkeleton variant="text" lines={2} /></div>
          {:else}
            <div class="person">
              <SvAvatar name={p.name} status={p.status} />
              <div>
                <div class="name">{p.name}</div>
                <div class="role">{p.role}</div>
              </div>
            </div>
          {/if}
          {#snippet footer()}<SvBadge variant="success" dot>{p.status}</SvBadge>{/snippet}
        </SvCard>
      {/each}
    </div>
  </section>
</div>

<style>
  .wrap { padding: 20px; max-width: 860px; display: flex; flex-direction: column; gap: 22px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  section h3 { margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  section > h3 { margin-bottom: 10px; }
  .head-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
  .person { display: flex; align-items: center; gap: 12px; }
  .name { font-size: 13.5px; font-weight: 650; }
  .role { font-size: 12px; color: var(--sg-muted, #64748b); }
</style>
