/**
 * The attachment field on a mounted <SvGrid>: the cell, then the dialog the
 * 'attachment' editor opens - add through the uploader (with a failure and a
 * retry), remove, Done commits, Cancel leaves the cell alone.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
import { SvGrid, clearToasts, toastStore } from '@svgrid/grid'
import { enableFields, type Attachment } from './index'
import { gridOf } from './grid-access'

enableFields()

if (typeof globalThis.ResizeObserver === 'undefined') {
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

const settle = () => new Promise<void>((r) => setTimeout(r))
async function until(check: () => boolean, label: string) {
  for (let i = 0; i < 100; i++) {
    if (check()) return
    await settle()
  }
  throw new Error(`timed out waiting for ${label}`)
}

const IMG: Attachment = { id: 'a', url: 'https://cdn.example.com/a.png', name: 'a.png', type: 'image/png', size: 2048 }
const PDF: Attachment = { id: 'b', url: 'https://cdn.example.com/b.pdf', name: 'b.pdf', type: 'application/pdf', size: 90000 }

function mountGrid(upload: (f: File, ctx: any) => Promise<Attachment>, extra: Record<string, unknown> = {}) {
  return new Promise<{ api: any; target: HTMLElement; destroy: () => void }>((res, rej) => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(SvGrid as any, {
      target,
      props: {
        data: [{ id: 1, name: 'Spec', files: [IMG, PDF] }],
        columns: [
          { field: 'name', header: 'Name' },
          { field: 'files', header: 'Files', width: 260, fieldType: 'attachment', fieldProps: { upload, maxFiles: 5, ...extra } },
        ],
        getRowId: (r: { id: number }) => String(r.id),
        editable: true,
        rowHeight: 34,
        containerHeight: 240,
        virtualization: false,
        columnVirtualization: false,
        showRowSelection: false,
        onApiReady: (api: any) => res({ api, target, destroy: () => { unmount(app); target.remove() } }),
      },
    })
    setTimeout(() => rej(new Error('grid did not mount')), 5000)
  })
}
const filesCell = (t: HTMLElement) => t.querySelector('tbody tr.sv-grid-row td[data-col-id="files"]') as HTMLElement
const tiles = () => [...document.querySelectorAll<HTMLElement>('.sv-attd-tile')]
const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('.sv-modal button')].find((b) => b.textContent?.trim() === text)!

function dropOn(el: HTMLElement, files: File[]) {
  const dataTransfer = { types: ['Files'], files, dropEffect: 'none' }
  for (const type of ['dragover', 'drop']) {
    const e = new Event(type, { bubbles: true, cancelable: true })
    Object.defineProperty(e, 'dataTransfer', { value: dataTransfer })
    el.dispatchEvent(e)
  }
}

function pick(files: File[]) {
  const input = document.querySelector<HTMLInputElement>('.sv-attd-footer input[type="file"]')!
  Object.defineProperty(input, 'files', { value: files, configurable: true })
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('attachment field', () => {
  it('draws images as thumbnails and other files as chips, with an accessible summary', async () => {
    const g = await mountGrid(async () => IMG)
    try {
      await settle()
      const cell = filesCell(g.target)
      expect(cell.querySelectorAll('img.sv-att-thumb')).toHaveLength(1)
      expect(cell.querySelector('.sv-att-chip')?.textContent).toContain('b.pdf')
      expect(cell.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('2 attachments: a.png, b.pdf')
    } finally {
      g.destroy()
    }
  })

  it('adds through the uploader (a failure keeps the tile with Retry), removes, and Done commits', async () => {
    let calls = 0
    const upload = async (f: File, ctx: { onProgress: (n: number) => void }) => {
      calls += 1
      ctx.onProgress(0.5)
      if (calls === 1) throw new Error('Network down')
      return { id: 'n', url: 'https://cdn.example.com/new.txt', name: f.name, type: 'text/plain', size: f.size }
    }
    const g = await mountGrid(upload)
    try {
      await settle()
      g.api.startEditing(0, 'files')
      await until(() => tiles().length === 2, 'the dialog with two files')

      pick([new File(['hello'], 'new.txt', { type: 'text/plain' })])
      await until(() => !!document.querySelector('.sv-attd-error'), 'the failed upload')
      expect(document.querySelector('.sv-attd-error')?.textContent).toBe('Network down')
      button('Retry').click()
      await until(() => tiles().length === 3 && !document.querySelector('.is-pending'), 'the retried upload')

      document.querySelector<HTMLButtonElement>('.sv-attd-remove[aria-label="Remove a.png"]')!.click()
      await settle()
      button('Done').click()
      await until(() => !document.querySelector('.sv-attd'), 'the dialog to close')

      expect(g.api.getData()[0].files.map((a: Attachment) => a.name)).toEqual(['b.pdf', 'new.txt'])
      await until(() => filesCell(g.target).textContent!.includes('new.txt'), 'the cell to redraw')
    } finally {
      g.destroy()
    }
  })

  it('refuses files over maxFiles, and Cancel leaves the cell as it was', async () => {
    const g = await mountGrid(async (f) => ({ id: f.name, url: `https://cdn.example.com/${f.name}`, name: f.name, type: 'text/plain' }))
    try {
      await settle()
      g.api.startEditing(0, 'files')
      await until(() => tiles().length === 2, 'the dialog')
      pick(['1', '2', '3', '4'].map((n) => new File(['x'], `${n}.txt`)))
      await until(() => tiles().length === 5, 'three uploads (max 5 files)')
      expect(document.querySelector('.sv-attd-rejected')?.textContent).toContain('At most 5 files')
      button('Cancel').click()
      await until(() => !document.querySelector('.sv-attd'), 'the dialog to close')
      expect(g.api.getData()[0].files).toEqual([IMG, PDF])
    } finally {
      g.destroy()
    }
  })

  it('checks a URL added in the dialog against accept, as a picked file is', async () => {
    const g = await mountGrid(async () => IMG, { accept: 'image/*' })
    try {
      await settle()
      g.api.startEditing(0, 'files')
      await until(() => tiles().length === 2, 'the dialog')
      const url = document.querySelector<HTMLInputElement>('.sv-attd-url')!
      url.value = 'https://cdn.example.com/c.png https://cdn.example.com/notes.pdf'
      url.dispatchEvent(new Event('input', { bubbles: true }))
      url.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
      await until(() => tiles().length === 3, 'the image URL added')
      expect(tiles().map((t) => t.querySelector('.sv-attd-name')?.textContent)).toEqual(['a.png', 'b.pdf', 'c.png'])
      expect(document.querySelector('.sv-attd-rejected')?.textContent).toContain('notes.pdf: Not an accepted type')
      button('Cancel').click()
      await until(() => !document.querySelector('.sv-attd'), 'the dialog to close')
    } finally {
      g.destroy()
    }
  })

  it('keeps pasted text to the field\'s accept and maxFiles (the column\'s valueParser)', async () => {
    const g = await mountGrid(async () => IMG, { accept: 'image/*', maxFiles: 2 })
    try {
      await settle()
      const def = gridOf(g.api).internalColumns.find((c: { field?: string }) => c.field === 'files')
      const parsed = def.valueParser({ newValue: 'https://x.io/a.png https://x.io/r.pdf https://x.io/b.png https://x.io/c.png' })
      expect(parsed.map((a: Attachment) => a.name)).toEqual(['a.png', 'b.png'])
    } finally {
      g.destroy()
    }
  })

  it('a drop on the cell writes the uploads that land and reports the failed and refused ones', async () => {
    clearToasts()
    const upload = async (f: File, ctx: { onProgress: (n: number) => void }) => {
      ctx.onProgress(0.5)
      if (f.name === 'bad.txt') throw new Error('Network down')
      return { id: f.name, url: `https://cdn.example.com/${f.name}`, name: f.name, type: 'text/plain', size: f.size }
    }
    const g = await mountGrid(upload, { maxSize: 100_000 })
    try {
      await settle()
      dropOn(filesCell(g.target).querySelector('.sv-att')!, [
        new File(['ok'], 'ok.txt', { type: 'text/plain' }),
        new File(['x'], 'bad.txt', { type: 'text/plain' }),
        new File(['x'.repeat(100_001)], 'big.txt', { type: 'text/plain' }),
      ])
      await until(() => g.api.getData()[0].files.length === 3, 'the good upload to land')
      expect(g.api.getData()[0].files.map((a: Attachment) => a.name)).toEqual(['a.png', 'b.pdf', 'ok.txt'])
      const said = toastStore.toasts.map((t) => `${t.variant} ${t.message}`)
      expect(said.some((m) => m.startsWith('warning') && m.includes('big.txt: Larger than'))).toBe(true)
      expect(said.some((m) => m.startsWith('error') && m.includes('bad.txt: Network down'))).toBe(true)
      expect(filesCell(g.target).querySelector('.sv-att-progress')).toBeNull()
    } finally {
      g.destroy()
      clearToasts()
    }
  })

  it('shows progress while a dropped file uploads and aborts it when the cell goes away', async () => {
    let signal: AbortSignal | null = null
    const upload = (_f: File, ctx: { signal: AbortSignal; onProgress: (n: number) => void }) => {
      signal = ctx.signal
      ctx.onProgress(0.25)
      return new Promise<Attachment>(() => {})
    }
    const g = await mountGrid(upload)
    await settle()
    dropOn(filesCell(g.target).querySelector('.sv-att')!, [new File(['x'], 'slow.txt', { type: 'text/plain' })])
    await until(() => !!filesCell(g.target).querySelector('.sv-att-progress'), 'the progress bar')
    expect(filesCell(g.target).querySelector('.sv-att-progress')?.getAttribute('aria-valuenow')).toBe('25')
    g.destroy()
    expect(signal!.aborted).toBe(true)
  })
})
