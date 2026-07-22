/**
 * Tests for the file-upload core's pure accept matching, plus SvFileUpload
 * rendering: the dropzone carries the editor contract, the selected-files list
 * renders, and remove emits the trimmed list.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvFileUpload from './SvFileUpload.svelte'
import { fileMatchesAccept } from './createFileUpload.svelte'

const mk = (name: string, type = '') => new File(['x'], name, { type })

describe('fileMatchesAccept', () => {
  it('matches extensions, MIME globs and exact MIME (and passes when empty)', () => {
    expect(fileMatchesAccept(mk('a.pdf'), '.pdf')).toBe(true)
    expect(fileMatchesAccept(mk('a.png', 'image/png'), 'image/*')).toBe(true)
    expect(fileMatchesAccept(mk('a.png', 'image/png'), 'image/png')).toBe(true)
    expect(fileMatchesAccept(mk('a.txt', 'text/plain'), 'image/*,.pdf')).toBe(false)
    expect(fileMatchesAccept(mk('anything'), undefined)).toBe(true)
  })
})

function mountFu(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvFileUpload, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

describe('SvFileUpload', () => {
  it('renders a dropzone with the editor contract wired', () => {
    const { target, destroy } = mountFu({ files: [], accept: 'image/*', label: 'Avatar', required: true, invalid: true, error: 'Required' })
    try {
      const zone = target.querySelector<HTMLElement>('.sv-file__zone')!
      expect(zone.getAttribute('role')).toBe('button')
      expect(zone.getAttribute('aria-invalid')).toBe('true')
      expect(zone.getAttribute('aria-required')).toBe('true')
      expect(target.querySelector('.sv-field__label')!.textContent).toContain('Avatar')
      expect(target.querySelector('.sv-field__error')!.textContent).toBe('Required')
      const input = target.querySelector<HTMLInputElement>('.sv-file__input')!
      expect(input.accept).toBe('image/*')
    } finally { destroy() }
  })

  it('lists selected files and removes one on click', () => {
    let got: File[] | undefined
    const files = [mk('a.png', 'image/png'), mk('b.png', 'image/png')]
    const { target, destroy } = mountFu({ files, multiple: true, onChange: (f: File[]) => (got = f) })
    try {
      const items = target.querySelectorAll('.sv-file__item')
      expect(items).toHaveLength(2)
      target.querySelector<HTMLButtonElement>('.sv-file__remove')!.click()
      flushSync()
      expect(got).toHaveLength(1)
      expect(got![0].name).toBe('b.png')
    } finally { destroy() }
  })
})
