// TEMP verification file - mirrors the demo core usage to confirm inference.
import { createCombobox } from './createCombobox.svelte'
import { createDropdownList } from './createDropdownList.svelte'
import { createAutocomplete } from './createAutocomplete.svelte'
import { createTagsInput } from './createTagsInput.svelte'
import { createCountryInput } from './createCountryInput.svelte'
import type { ListOption } from './list-option'

const options: ListOption[] = [{ value: 'a', label: 'A' }]

let comboV: string | number | null = 'a'
const cb = createCombobox({ options: () => options, value: () => comboV, onChange: (v) => (comboV = v) })
cb.inputProps(); cb.listboxProps(); cb.triggerProps(); cb.optionProps(0)
const _cb: boolean = cb.open && cb.isActive(0) && cb.isSelected(options[0]!)
void cb.filtered.length; void cb.shownText

let ddV: string | number | null = 'a'
const dd = createDropdownList({ options: () => options, value: () => ddV, onChange: (v) => (ddV = v) })
dd.triggerProps(); dd.listboxProps(); dd.optionProps(0)
const _dd = dd.selected?.label ?? ''; void dd.open; void dd.isActive(0); void dd.isSelected(options[0]!)

let acV = ''
const ac = createAutocomplete({ value: () => acV, suggestions: () => ['x'], onChange: (v) => (acV = v) })
ac.inputProps(); ac.listboxProps(); ac.optionProps(0); void ac.open; void ac.filtered.length; void ac.isActive(0)

let tags: string[] = []
const ti = createTagsInput({ value: () => tags, onChange: (t) => (tags = t) })
ti.rootProps(); ti.inputProps(); ti.tagProps(0); ti.removeProps(0); void ti.tags.length; void ti.draft

let ciV: string | null = 'DE'
const ci = createCountryInput({ value: () => ciV, onChange: (c) => (ciV = c) })
ci.triggerProps(); ci.searchProps(); ci.listboxProps(); ci.optionProps(0)
const _ci = ci.selected?.name ?? ''; void ci.open; void ci.isActive(0); void ci.isSelected('DE'); void ci.filtered.length

void _cb; void _dd; void _ci
