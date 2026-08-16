<script lang="ts">
  // SvHoverCard - a rich preview card that opens on hover. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-hover-card
  import { SvHoverCard, SvAvatar } from '@svgrid/grid'
</script>

<SvHoverCard>
  {#snippet anchor()}<a href="/u/ada">@ada</a>{/snippet}
  <div style="display:flex; gap:12px; align-items:center">
    <SvAvatar name="Ada Lovelace" />
    <div>
      <strong>Ada Lovelace</strong>
      <div style="color:var(--sg-muted); font-size:12.5px">Analyst - first programmer</div>
    </div>
  </div>
</SvHoverCard>
