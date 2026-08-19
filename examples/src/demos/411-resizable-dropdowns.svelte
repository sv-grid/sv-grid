<script lang="ts">
  /**
   * Resizable dropdown panels - the drop-down list, combo box and autocomplete
   * input all take a `resizable` prop that adds a bottom drag grip ("····") to
   * their open panel. Drag it to grow or shrink the list; the choice sticks for
   * the session. The grip hides automatically when a panel flips upward (no room
   * to grow below). All themed from the --sg-* tokens.
   */
  import {
    SvDropDownList, SvComboBox, SvAutoComplete,
    SvStack, SvGroup, SvText, SvTitle, SvSwitchButton,
  } from '@svgrid/grid'

  // A long-ish list so there is something to scroll / resize into.
  const timezones = [
    'UTC-12:00 Baker Island', 'UTC-11:00 Niue', 'UTC-10:00 Honolulu', 'UTC-09:00 Anchorage',
    'UTC-08:00 Los Angeles', 'UTC-07:00 Denver', 'UTC-06:00 Chicago', 'UTC-05:00 New York',
    'UTC-04:00 Santiago', 'UTC-03:00 Sao Paulo', 'UTC-02:00 South Georgia', 'UTC-01:00 Azores',
    'UTC+00:00 London', 'UTC+01:00 Berlin', 'UTC+02:00 Cairo', 'UTC+03:00 Moscow',
    'UTC+03:30 Tehran', 'UTC+04:00 Dubai', 'UTC+05:00 Karachi', 'UTC+05:30 Mumbai',
    'UTC+06:00 Dhaka', 'UTC+07:00 Bangkok', 'UTC+08:00 Singapore', 'UTC+09:00 Tokyo',
    'UTC+09:30 Adelaide', 'UTC+10:00 Sydney', 'UTC+11:00 Noumea', 'UTC+12:00 Auckland',
  ].map((label, i) => ({ value: i, label }))

  const fruits = [
    'Apple', 'Apricot', 'Avocado', 'Banana', 'Blackberry', 'Blueberry', 'Cherry', 'Clementine',
    'Coconut', 'Cranberry', 'Date', 'Dragonfruit', 'Elderberry', 'Fig', 'Gooseberry', 'Grape',
    'Grapefruit', 'Guava', 'Kiwi', 'Lemon', 'Lime', 'Lychee', 'Mango', 'Melon', 'Nectarine',
    'Orange', 'Papaya', 'Passionfruit', 'Peach', 'Pear', 'Pineapple', 'Plum', 'Pomegranate',
    'Raspberry', 'Strawberry', 'Tangerine', 'Watermelon',
  ].map((f) => ({ value: f.toLowerCase(), label: f }))

  const cities = [
    'Amsterdam', 'Athens', 'Bangkok', 'Barcelona', 'Berlin', 'Boston', 'Brussels', 'Budapest',
    'Chicago', 'Copenhagen', 'Dubai', 'Dublin', 'Helsinki', 'Istanbul', 'Lisbon', 'London',
    'Madrid', 'Melbourne', 'Miami', 'Milan', 'Montreal', 'Munich', 'New York', 'Oslo', 'Paris',
    'Prague', 'Rome', 'Seattle', 'Singapore', 'Stockholm', 'Sydney', 'Tokyo', 'Toronto', 'Vienna',
    'Warsaw', 'Zurich',
  ]

  let tz = $state<string | number | null>(12)
  let fruit = $state<string | number | null>(null)
  let city = $state('')
  let resizable = $state(true)
</script>

<div class="page">
  <SvStack gap={6}>
    <SvTitle order={2}>Resizable + bounds-aware dropdown panels</SvTitle>
    <SvText tone="muted">
      Every picker panel opens downward when there is room and flips upward
      automatically when there is not (browser bounds detection - try it near the
      bottom of the window below). With <code>resizable</code>, the open panel also
      grows a bottom drag grip; drag it to resize, and the height sticks for the
      session. Toggle the switch to compare with the fixed-height default.
    </SvText>
  </SvStack>

  <SvGroup gap={10} align="center" wrap>
    <SvSwitchButton checked={resizable} onChange={(v) => (resizable = v)} />
    <SvText size="sm">{resizable ? 'Resizable panels (drag the grip)' : 'Fixed-height panels'}</SvText>
  </SvGroup>

  <SvGroup gap={28} align="start" wrap>
    <SvStack gap={6}>
      <SvText size="sm" weight="semibold">Drop-down list</SvText>
      <SvDropDownList
        {resizable}
        value={tz}
        onChange={(v) => (tz = v)}
        options={timezones}
        placeholder="Pick a timezone"
        label="Timezone"
        hint="28 options - grow the panel to see more at once"
      />
    </SvStack>

    <SvStack gap={6}>
      <SvText size="sm" weight="semibold">Combo box</SvText>
      <SvComboBox
        {resizable}
        clearable
        value={fruit}
        onChange={(v) => (fruit = v)}
        options={fruits}
        placeholder="Type to filter…"
        label="Favourite fruit"
        hint="Filter, then resize the results"
      />
    </SvStack>

    <SvStack gap={6}>
      <SvText size="sm" weight="semibold">Autocomplete input</SvText>
      <SvAutoComplete
        {resizable}
        bind:value={city}
        suggestions={cities}
        placeholder="Search a city…"
        label="City"
        hint="Free text + suggestions"
      />
    </SvStack>
  </SvGroup>

  <div class="readout">
    <SvText size="sm" tone="muted">
      Selected - timezone: <b>{timezones.find((t) => t.value === tz)?.label ?? '-'}</b>,
      fruit: <b>{fruit ?? '-'}</b>, city: <b>{city || '-'}</b>
    </SvText>
  </div>

  <!-- Bounds detection: this row sits low in a tall page, so opening it near the
       bottom of the window flips the panel UPWARD automatically. -->
  <div class="bounds">
    <SvText size="sm" weight="semibold">Bounds detection (open near the window's bottom edge)</SvText>
    <SvText size="sm" tone="muted">
      This picker sits low on the page. Open it - with little room below, the panel
      opens <b>upward</b> instead of being clipped. Scroll so it is near the top and
      it opens downward again. No configuration; it is built in.
    </SvText>
    <div class="bounds-field">
      <SvDropDownList
        {resizable}
        value={tz}
        onChange={(v) => (tz = v)}
        options={timezones}
        placeholder="Pick a timezone"
        ariaLabel="Timezone (bounds demo)"
      />
    </div>
  </div>
</div>

<style>
  .page { padding: 24px; max-width: 760px; display: flex; flex-direction: column; gap: 22px; }
  /* --sg-header-bg is theme-defined (light + dark); --sg-muted-bg is not, so it
     would fall back to a fixed light colour and clash in dark mode. */
  .readout { padding: 12px 14px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; background: var(--sg-header-bg, #f8fafc); }
  b { color: var(--sg-fg, #0f172a); font-weight: 600; }
  .bounds {
    display: flex; flex-direction: column; gap: 8px;
    margin-top: 40vh; /* push it low so opening it demonstrates the upward flip */
    padding: 14px; border: 1px dashed var(--sg-border, #e2e8f0); border-radius: 10px;
    background: var(--sg-header-bg, #f8fafc);
  }
  .bounds-field { margin-top: 2px; }
</style>
