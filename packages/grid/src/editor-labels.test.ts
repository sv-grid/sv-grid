/**
 * Every editor that renders a `label` must point it at its own control:
 * SvField draws `<label for={id}>`, so the focusable element has to carry
 * that id. Without it the label is not clickable and the control has no
 * accessible name (getByLabelText finds nothing, screen readers read
 * "edit text"). SvTextInput, SvTextArea, SvDurationInput, SvTagsInput and the
 * SvMultiSelect / SvTreeSelect / SvGridSelect triggers shipped without it.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync, type Component } from 'svelte'
import SvTextInput from './SvTextInput.svelte'
import SvTextArea from './SvTextArea.svelte'
import SvDurationInput from './SvDurationInput.svelte'
import SvPasswordInput from './SvPasswordInput.svelte'
import SvNumberInput from './SvNumberInput.svelte'
import SvMultiSelect from './SvMultiSelect.svelte'
import SvTreeSelect from './SvTreeSelect.svelte'
import SvGridSelect from './SvGridSelect.svelte'
import SvComboBox from './SvComboBox.svelte'
import SvDropDownList from './SvDropDownList.svelte'
import SvTagsInput from './SvTagsInput.svelte'
import SvSegmented from './SvSegmented.svelte'
import SvFileUpload from './SvFileUpload.svelte'
import SvAutoComplete from './SvAutoComplete.svelte'
import SvCountryInput from './SvCountryInput.svelte'
import SvDateRangeInput from './SvDateRangeInput.svelte'
import SvSlider from './SvSlider.svelte'
import SvPhoneInput from './SvPhoneInput.svelte'

const CASES: [string, Component<any>, Record<string, unknown>][] = [
  ['SvTextInput', SvTextInput, {}],
  ['SvTextArea', SvTextArea, {}],
  ['SvDurationInput', SvDurationInput, {}],
  ['SvPasswordInput', SvPasswordInput, {}],
  ['SvNumberInput', SvNumberInput, {}],
  ['SvMultiSelect', SvMultiSelect, { options: [{ value: 'a', label: 'A' }] }],
  ['SvTreeSelect', SvTreeSelect, { nodes: [{ id: 'a', label: 'A' }] }],
  ['SvGridSelect', SvGridSelect, { options: [{ id: 1, name: 'A' }], columns: [{ field: 'name', header: 'Name' }], labelField: 'name' }],
  ['SvComboBox', SvComboBox, { options: [{ value: 'a', label: 'A' }] }],
  ['SvDropDownList', SvDropDownList, { options: [{ value: 'a', label: 'A' }] }],
  ['SvTagsInput', SvTagsInput, {}],
  ['SvPhoneInput', SvPhoneInput, {}],
]

describe('editor labels name their control', () => {
  for (const [name, C, props] of CASES) {
    it(name, () => {
      const target = document.createElement('div')
      document.body.appendChild(target)
      const app = mount(C, { target, props: { label: 'Field name', ...props } })
      flushSync()
      try {
        const label = target.querySelector('label[for]')
        expect(label, 'renders a <label for>').not.toBeNull()
        const control = document.getElementById(label!.getAttribute('for')!)
        expect(control, `nothing has id="${label!.getAttribute('for')}"`).not.toBeNull()
        expect(target.contains(control)).toBe(true)
        expect(['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT']).toContain(control!.tagName)
        // aria-label beats <label for>: a built-in default would hide the visible label.
        expect(control!.getAttribute('aria-label'), 'aria-label overrides the visible label').toBeNull()
      } finally {
        unmount(app)
        target.remove()
      }
    })
  }
})

/**
 * `block` must stretch the SvField wrapper too, not only the control inside
 * it: the wrapper is inline-flex, so a block control in a normal-flow parent
 * otherwise stays as narrow as its content.
 */
const BLOCK_CASES: [string, Component<any>, Record<string, unknown>][] = [
  ['SvTextInput', SvTextInput, {}],
  ['SvTextArea', SvTextArea, {}],
  ['SvDropDownList', SvDropDownList, { options: [{ value: 'a', label: 'A' }] }],
  ['SvSegmented', SvSegmented, { options: [{ value: 'a', label: 'A' }] }],
  ['SvFileUpload', SvFileUpload, {}],
  ['SvAutoComplete', SvAutoComplete, { options: ['a'] }],
  ['SvComboBox', SvComboBox, { options: [{ value: 'a', label: 'A' }] }],
  ['SvCountryInput', SvCountryInput, {}],
  ['SvDateRangeInput', SvDateRangeInput, {}],
  ['SvGridSelect', SvGridSelect, { options: [{ id: 1, name: 'A' }], columns: [{ field: 'name', header: 'Name' }], labelField: 'name' }],
  ['SvMultiSelect', SvMultiSelect, { options: [{ value: 'a', label: 'A' }] }],
  ['SvSlider', SvSlider, {}],
  ['SvTagsInput', SvTagsInput, {}],
  ['SvTreeSelect', SvTreeSelect, { nodes: [{ id: 'a', label: 'A' }] }],
]

describe('block reaches the field wrapper', () => {
  for (const [name, C, props] of BLOCK_CASES) {
    it(name, () => {
      const target = document.createElement('div')
      document.body.appendChild(target)
      const app = mount(C, { target, props: { label: 'Field', block: true, ...props } })
      flushSync()
      try {
        expect(target.querySelector('.sv-field')?.classList.contains('sv-field--block')).toBe(true)
      } finally {
        unmount(app)
        target.remove()
      }
    })
  }
})
