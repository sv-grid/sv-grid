<script lang="ts">
  /**
   * SvAutoComplete - a production search field: free text with a live-filtered
   * suggestion list (accepts ANY value; suggestions are shortcuts). Copy-paste
   * ready.
   */
  import { SvAutoComplete } from '@svgrid/grid'

  const cities = [
    'Amsterdam', 'Austin', 'Bangalore', 'Barcelona', 'Berlin', 'Boston', 'Chicago',
    'Copenhagen', 'Dublin', 'Lisbon', 'London', 'Madrid', 'Melbourne', 'Munich',
    'New York', 'Paris', 'San Francisco', 'Seattle', 'Singapore', 'Stockholm', 'Sydney', 'Tokyo', 'Toronto',
  ]
  let city = $state('')
  let query = $state('')
</script>

<div class="wrap">
  <header>
    <h2>Autocomplete</h2>
    <p>A free-text field with suggestion shortcuts (unlike a combo box, any value is accepted). Search, tags, addresses.</p>
  </header>

  <div class="search">
    <SvAutoComplete
      value={city}
      suggestions={cities}
      placeholder="Search a city..."
      label="Office location"
      hint="Start typing - suggestions are just shortcuts"
      onChange={(v) => (city = v)}
    />
    <p class="out">{city ? `Selected: ${city}` : 'Nothing entered yet'}</p>
  </div>

  <div class="search">
    <SvAutoComplete
      value={query}
      suggestions={['status:open', 'assignee:me', 'label:bug', 'priority:high', 'is:archived']}
      minChars={1}
      placeholder="Filter issues..."
      label="Search syntax"
      onChange={(v) => (query = v)}
    />
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 420px; display: flex; flex-direction: column; gap: 22px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  .search { display: flex; flex-direction: column; gap: 8px; }
  .out { margin: 0; font-size: 13px; color: var(--sg-muted, #64748b); }
</style>
