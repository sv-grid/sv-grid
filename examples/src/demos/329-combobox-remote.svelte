<script lang="ts">
  /**
   * SvComboBox with a remote data source: options are fetched from a server as
   * you type (debounced), with a loading state and a "type to search" hint.
   * Local filtering is off - the server's results are shown as-is.
   */
  import { SvComboBox } from '@svgrid/grid'
  import type { ListOption } from '@svgrid/grid'

  // A stand-in "server": a big dataset queried with a simulated latency.
  const universe: ListOption[] = Array.from({ length: 5000 }, (_, i) => ({
    value: i,
    label: `Repository ${i + 1} - ${['core', 'ui', 'api', 'docs', 'infra'][i % 5]}`,
  }))
  function searchServer(query: string): Promise<ListOption[]> {
    const q = query.toLowerCase()
    return new Promise((resolve) =>
      setTimeout(() => resolve(universe.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 25)), 500),
    )
  }

  let repo = $state<string | number | null>(null)
  let calls = $state(0)
  async function loadOptions(query: string) {
    calls += 1
    return searchServer(query)
  }
</script>

<div class="wrap">
  <header>
    <h2>Remote combo box</h2>
    <p>Type to search a 5,000-item "server". Requests are <strong>debounced</strong> (250ms), show a <strong>loading</strong> state, and only the latest response wins (no race). Local filtering is disabled.</p>
  </header>

  <div class="field">
    <SvComboBox
      value={repo}
      {loadOptions}
      minLength={2}
      label="Repository"
      hint="At least 2 characters"
      placeholder="Search repositories..."
      onChange={(v) => (repo = v)}
    />
    <p class="out">{repo != null ? `Selected: ${universe.find((o) => o.value === repo)?.label}` : 'Nothing selected'} <span class="muted">&middot; {calls} server calls</span></p>
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 460px; display: flex; flex-direction: column; gap: 16px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  .field { display: flex; flex-direction: column; gap: 8px; }
  .out { margin: 0; font-size: 13px; }
  .muted { color: var(--sg-muted, #94a3b8); }
</style>
