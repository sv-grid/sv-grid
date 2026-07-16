# Inputs

Typed text controls. Each emits a clean value and themes from `--sg-*`.

## SvNumberInput

Numeric input with min/max/step, spinner buttons, optional thousands grouping,
precision, and prefix/suffix.

```svelte
<SvNumberInput value={qty} onChange={(v) => (qty = v)}
  min={0} max={100000} step={10} precision={2} grouping prefix="$" />
```

Props: `value` (number | null), `onChange(value)`, `min`, `max`, `step`,
`precision`, `grouping`, `prefix`, `suffix`, `spinButtons`, `size`, `disabled`,
`readonly`. Arrow keys step; the field commits (and clamps) on blur/Enter.

## SvPasswordInput

Password field with a reveal toggle and an optional 4-level strength meter.

```svelte
<SvPasswordInput value={pw} onChange={(v) => (pw = v)} showStrength />
```

Props: `value`, `onChange(value)`, `revealable` (default true), `showStrength`,
`size`, `disabled`, `autocomplete`.

## SvMaskedInput

Pattern-masked text input. Mask tokens: `#` digit, `A` letter, `*` alphanumeric;
any other character is an auto-inserted literal.

```svelte
<SvMaskedInput mask="(###) ###-####" onChange={(masked, raw, complete) => …} />
```

Props: `value`, `mask`, `onChange(masked, raw, complete)`, `size`, `disabled`.

## SvPhoneInput

A country dial-code selector plus a national number field; emits an E.164-style
string (`+<dial><digits>`). Country data is bundled (`COUNTRIES`) and extensible.

```svelte
<SvPhoneInput value={phone} country="US"
  onChange={(v, parts) => (phone = v)} />
```

Props: `value`, `country` (ISO code), `onChange(value, { country, dial, national })`,
`size`, `disabled`.

## SvColorInput

A color swatch that opens a portalled popover with a hex field, native picker and
preset palette. Emits a `#rrggbb` string.

```svelte
<SvColorInput value={color} onChange={(hex) => (color = hex)} />
```

Props: `value`, `onChange(hex)`, `palette` (string[]), `size`, `disabled`.
