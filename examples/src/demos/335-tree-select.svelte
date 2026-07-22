<script lang="ts">
  /**
   * SvTreeSelect - a single-select dropdown that shows a collapsible tree in its
   * panel (the "tree select / cascader" pattern). Built on its own portalled
   * panel via the shared primitives, standalone or as a grid cell editor.
   */
  import { SvTreeSelect, SvCheckBox, type TreeSelectNode } from '@svgrid/grid'

  const places: TreeSelectNode[] = [
    { value: 'asia', label: 'Asia', children: [
      { value: 'jp', label: 'Japan', children: [
        { value: 'tokyo', label: 'Tokyo' },
        { value: 'osaka', label: 'Osaka' },
      ] },
      { value: 'cn', label: 'China', children: [
        { value: 'beijing', label: 'Beijing' },
        { value: 'shanghai', label: 'Shanghai' },
      ] },
    ] },
    { value: 'eu', label: 'Europe', children: [
      { value: 'fr', label: 'France', children: [{ value: 'paris', label: 'Paris' }] },
      { value: 'de', label: 'Germany', children: [{ value: 'berlin', label: 'Berlin' }] },
    ] },
    { value: 'na', label: 'North America', children: [
      { value: 'us', label: 'United States', children: [
        { value: 'nyc', label: 'New York' },
        { value: 'sf', label: 'San Francisco' },
      ] },
    ] },
  ]

  let city = $state<string | number | null>('tokyo')
  let showPath = $state(true)
</script>

<div class="wrap">
  <header>
    <h2>Tree select</h2>
    <p>Pick a node from a hierarchy. Arrow keys navigate, Right/Left expand/collapse, Enter selects. The panel portals to <code>&lt;body&gt;</code> so it is never clipped.</p>
  </header>

  <div class="row">
    <SvTreeSelect
      label="City"
      nodes={places}
      value={city}
      onChange={(v) => (city = v)}
      expandedIds={['asia', 'jp']}
      {showPath}
    />
    <SvCheckBox checked={showPath} onChange={(v) => (showPath = v)}>Show full path in trigger</SvCheckBox>
  </div>

  <p class="muted">Selected value: <code>{city ?? '(none)'}</code></p>
</div>

<style>
  .wrap { padding: 20px; max-width: 720px; display: flex; flex-direction: column; gap: 18px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  header code, .muted code { background: var(--sg-row-hover-bg, #f1f5f9); padding: 1px 5px; border-radius: 4px; font-size: 12px; }
  .row { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; }
  .muted { color: var(--sg-muted, #64748b); font-size: 13px; }
</style>
