/**
 * `block` is declared once, in `SvEditorProps`, and its doc comment states the
 * contract: "in a form grid a row of inputs each stopping at a different width
 * reads as broken."
 *
 * Nine editors accepted the prop by type and did nothing with it. `<SvForm>`
 * mounts five of them, so the Edit-fields drawer came out with a full-width
 * text box above a 200px select above a 240px date picker - the exact thing the
 * doc comment warns about, shipped.
 *
 * A type that promises something no code honours is worse than no type: it
 * reads as done. This walks the source instead of trusting the declaration, so
 * the next editor added to the kit either honours `block` or is listed here as
 * a deliberate exemption.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(import.meta.dirname, '.')

/**
 * Controls whose width is their content, where stretching to 100% would be
 * wrong rather than merely unusual: a checkbox is a 16px box with a label
 * beside it, a rating is five stars, a switch is a switch. Widening them puts
 * the control at one end of an empty row.
 */
const INTRINSIC = new Set([
  'SvCheckBox',
  'SvSwitchButton',
  'SvToggleButton',
  'SvButtonGroup',
  'SvRadioGroup',
  'SvRating',
  'SvOtpInput',
  'SvFileUpload',
  'SvSlider',
  'SvColorInput',
])

function editorsDeclaringBlock(): string[] {
  return readdirSync(SRC)
    .filter((f) => f.startsWith('Sv') && f.endsWith('.svelte'))
    .filter((f) => {
      const src = readFileSync(join(SRC, f), 'utf8')
      if (!src.includes('SvEditorProps')) return false
      // A `Pick<SvEditorProps, ...>` that leaves 'block' out has opted out at
      // the type level, which is a legitimate (and checkable) choice.
      const pick = /Pick<\s*SvEditorProps,\s*([^>]+)>/.exec(src)
      if (pick) return (pick[1] ?? '').includes("'block'")
      return true
    })
    .map((f) => f.replace('.svelte', ''))
}

describe('the block prop is honoured wherever it is declared', () => {
  const declaring = editorsDeclaringBlock().filter((n) => !INTRINSIC.has(n))

  it('finds the editor kit (guards against the walker silently matching nothing)', () => {
    expect(declaring.length).toBeGreaterThan(10)
    expect(declaring).toContain('SvDropDownList')
    expect(declaring).toContain('SvDateTimePicker')
  })

  it.each(declaring)('%s reads the prop and applies it to a width', (name) => {
    const src = readFileSync(join(SRC, `${name}.svelte`), 'utf8')

    // Declared but never destructured is the failure mode that shipped: the
    // component compiles, the consumer passes `block`, nothing happens.
    expect(src, `${name} never destructures block`).toMatch(/\bblock = false\b|\bblock,/)

    // And destructured but never used is the same bug one step later.
    const applied =
      /class:is-block=\{block\}/.test(src) ||
      /class:sv-[a-z]+--block=\{block\}/.test(src) ||
      /\{block\}/.test(src)
    expect(applied, `${name} destructures block but never applies it`).toBe(true)
  })
})

/**
 * Every `<SvXxx ... />` in a Svelte source, with its props.
 *
 * Not a regex: props routinely contain `>`, in arrow functions like
 * `onChange={(m) => o.onChange(m)}`. A `[^>]*?` walker stops at the first one
 * and silently skips the tag - which here quietly excused SvComboBox,
 * SvMaskedInput and SvPhoneInput from the check, three of the controls this
 * test exists to cover. So brace depth is tracked instead.
 */
function selfClosingTags(src: string): Array<{ name: string; props: string }> {
  const out: Array<{ name: string; props: string }> = []
  const open = /<(Sv[A-Za-z]+)(?=[\s/>])/g
  let m: RegExpExecArray | null
  while ((m = open.exec(src))) {
    let i = m.index + m[0].length
    let depth = 0
    for (; i < src.length; i++) {
      const c = src[i]
      if (c === '{') depth++
      else if (c === '}') depth--
      else if (depth === 0 && c === '/' && src[i + 1] === '>') {
        out.push({ name: m[1]!, props: src.slice(m.index + m[0].length, i) })
        break
      } else if (depth === 0 && c === '>') break // an open tag, not self-closing
    }
  }
  return out
}

describe('<SvForm> passes block to every control it mounts', () => {
  // The components above can honour block perfectly and the form still look
  // ragged, because the form is what decides to pass it. That is precisely how
  // this bug survived: SvNumberInput, SvPasswordInput, SvMaskedInput and
  // SvPhoneInput were passed `block` and the rest were not.
  const form = readFileSync(join(SRC, 'SvForm.svelte'), 'utf8')
  const honours = new Set(editorsDeclaringBlock())
  const controls = selfClosingTags(form).filter(
    (c) => honours.has(c.name) && !INTRINSIC.has(c.name),
  )

  it('finds the control snippet', () => {
    // Every control that CAN fill its row must be seen by this walker. The
    // three `=>`-carrying tags above are the reason this number is asserted.
    expect(controls.length).toBeGreaterThanOrEqual(11)
    for (const expected of ['SvDropDownList', 'SvComboBox', 'SvMaskedInput', 'SvPhoneInput'])
      expect(controls.map((c) => c.name)).toContain(expected)
  })

  it.each(controls.map((c) => [c.name, c.props]))('%s is mounted block', (name, props) => {
    expect(props, `<${name}> in SvForm is missing block`).toMatch(/(^|\s)block(\s|$|=)/)
  })
})
