# Internationalization & RTL

Every editor in the kit shares one localization + direction contract, so you
wire it the same way everywhere.

## Direction (`dir`)

Pass `dir="rtl"` (or `"ltr"`, or `"auto"` to inherit the document) to any editor.
It mirrors the layout **and the behavior**: the switch thumb slides the other
way, calendar nav arrows flip, tabs/tree/slider/splitter reverse their
Left/Right arrow keys, and dropdown adornments move to the correct edge.

```svelte
<SvNumberInput value={qty} dir="rtl" onChange={(v) => (qty = v)} />
<SvCalendar value={date} dir="rtl" onChange={(d) => (date = d)} />
<SvSlider value={vol} dir="rtl" onChange={(v) => (vol = v)} />
```

A page-level `dir` attribute is respected by `dir="auto"` (the default), so most
apps set `dir` once on `<html>` and never touch it per-component.

## Messages

Every user-facing string (empty-state text, "Now"/"Today", AM/PM, reveal-toggle
labels, "No matches", clear/search labels, etc.) is overridable via a `messages`
prop. Only the keys you set are replaced; the rest keep their English defaults.

```svelte
<SvComboBox options={options} value={value}
  messages={{ noResults: 'Aucun resultat', loading: 'Chargement...' }} />

<SvPasswordInput value={pw}
  messages={{ show: 'Afficher', hide: 'Masquer',
              weak: 'Faible', fair: 'Moyen', good: 'Bon', strong: 'Fort' }} />

<SvCalendar value={date}
  messages={{ today: 'Aujourd\'hui', clear: 'Effacer',
              prev: 'Precedent', next: 'Suivant' }} />
```

### Merging your own defaults

`resolveMessages(defaults, overrides)` is the helper the components use
internally - handy if you build your own control on a headless core:

```ts
import { resolveMessages } from '@svgrid/grid'

const DEFAULTS = { clear: 'Clear', noResults: 'No results' }
const M = resolveMessages(DEFAULTS, props.messages) // partial override, empty/undefined ignored
```

## Locale-aware formatting

Date and number editors format through the platform `Intl` APIs, so month and
weekday names, number grouping and separators follow the `locale` you pass:

```svelte
<SvCalendar locale="fr-FR" value={date} onChange={(d) => (date = d)} />
<SvDateTimePicker locale="de-DE" formatString="dd.MM.yyyy HH:mm" value={when} />
```

## Putting it together

```svelte
<!-- An Arabic-locale, right-to-left field with localized chrome -->
<SvDateRangeInput
  dir="rtl"
  locale="ar"
  label="الفترة"
  messages={{ to: 'إلى', clear: 'مسح', open: 'فتح التقويم' }}
  value={range}
  onChange={(r) => (range = r)}
/>
```

The same three levers - `dir`, `messages`, `locale` - localize the entire kit.

## More examples

### RTL + i18n stress

Six locales (en, de, fr-CA, ja, ar, he). Direction flips, full string translation, Intl-driven currency/date/number, mixed-direction safe via <bdi>.

<div data-docs-demo="38-rtl-i18n" data-height="460"></div>
