/**
 * E2E: every field type of a base against the three ways a value moves without
 * being typed: the fill handle, copy and paste, and a file. Real mouse and keys in
 * a real browser, on fixtures/base-every-field.svelte, which holds one field of
 * each type. Each case asserts what the record stores and what the cell shows.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const soft = expect.configure({ soft: true })
const FIXTURE = fileURLToPath(new URL('./fixtures/base-every-field.ts', import.meta.url)).replace(/\\/g, '/').replace(/^\//, '')

test.use({ timezoneId: 'Europe/Athens', locale: 'en-US' })

/** Fields a person can write, in the fixture's order. */
const WRITABLE = [
  'notes', 'rich', 'files', 'done', 'stage', 'tags', 'owner', 'team', 'due', 'at', 'phone', 'email', 'site', 'code', 'todo', 'tint', 'qty', 'ratio', 'price',
  'share', 'oldPrice', 'oldShare', 'points', 'spent', 'starts', 'stars', 'votes', 'trend', 'account', 'ai',
]
/** Fields the base works out or stamps: a fill and a paste leave them alone. */
const COMPUTED = ['act', 'city', 'calc', 'made', 'changed', 'maker', 'changer', 'serial']

/** The first record's fields as the clipboard holds them: what the cell shows, for a sheet to read. */
const CLIPBOARD: Record<string, string> = {
  notes: '"line one\nline two"',
  rich: 'Bold words',
  files: 'https://files.example.com/brief.pdf',
  done: 'true',
  stage: 'P1',
  tags: '"""Red, dark"", Green"',
  owner: 'Ben Okafor',
  team: 'Ben Okafor, "Chen, Maya"',
  due: 'October 9, 2026',
  at: '2026-10-09 15:30',
  phone: '+1 415 555 0123',
  email: 'ann@example.com',
  site: 'https://example.com/a',
  code: 'ABC-123',
  todo: '[x] Draft [ ] Review',
  tint: '#336699',
  qty: '3',
  ratio: '1.3',
  price: '$1,234.57',
  share: '13%',
  oldPrice: '$10.50',
  oldShare: '50%',
  points: '40%',
  spent: '1:30',
  starts: '2:30 PM',
  stars: '4',
  votes: 'Ben Okafor, Cleo Park',
  trend: '3, 7, 4, 9',
  account: 'Contoso',
  ai: 'Written once',
}

/**
 * What each field makes of that text with nothing but the text to go on: a paste
 * from a sheet, or from another browser. A rounded number stays as rounded as the
 * text, and of two people with one name the first is meant.
 */
const FROM_TEXT: Record<string, unknown> = {
  notes: 'line one\nline two',
  rich: '<p>Bold words</p>',
  done: true,
  stage: 'p1',
  tags: ['t1', 't3'],
  owner: 'u2',
  team: ['u2', 'u5'],
  due: '2026-10-09',
  at: '2026-10-09T12:30:00.000Z',
  phone: '+1 415 555 0123',
  email: 'ann@example.com',
  site: 'https://example.com/a',
  code: 'ABC-123',
  tint: '#336699',
  qty: 3,
  ratio: 1.3,
  price: 1234.57,
  share: 0.13,
  oldPrice: 10.5,
  oldShare: 0.5,
  points: 40,
  spent: 5400,
  starts: '14:30',
  stars: 4,
  votes: ['u2', 'u3'],
  trend: [3, 7, 4, 9],
  account: ['a1'],
  ai: 'Written once',
}

async function open(page: Page, props: { toaster?: boolean; grouped?: boolean } = {}) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  // The fixture is mounted by hand: a dev server's reload would take it away mid-test.
  await page.routeWebSocket(/token=/, () => {})
  // Wide enough that every column is drawn: a real pointer can reach each one.
  await page.setViewportSize({ width: 5600, height: 800 })
  await page.goto('/sv-grid/#/demos/01-quick-start', { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.evaluate(async ([path, p]) => {
    const fixture = await import(/* @vite-ignore */ path as string)
    fixture.show(p)
  }, [`/sv-grid/@fs/${FIXTURE}`, props] as const)
  await page.locator('.sv-btabs').waitFor({ timeout: 60_000 })
  await page.locator('.sv-grid-table tbody .sv-grid-row').first().waitFor()
}

type Stored = Record<string, unknown>
const stored = (page: Page, table = 'items') => page.evaluate((t) => (window as unknown as { __base: { rows: (t: string) => Stored[] } }).__base.rows(t), table)
const record = async (page: Page, id: string) => (await stored(page)).find((r) => r.id === id)!

const cell = (page: Page, rowIndex: number, field: string) => page.locator(`.sv-grid-table tbody .sv-grid-row`).nth(rowIndex).locator(`[data-col-id="${field}"]`)
const shown = async (page: Page, rowIndex: number, field: string) => ((await cell(page, rowIndex, field).innerText()) ?? '').replace(/\s+/g, ' ').trim()

/** A plain click selects a cell, off the content and off the fill handle. A checkbox cell ticks on a click, so it is reached by key. */
async function select(page: Page, rowIndex: number, field: string) {
  const near = field === 'done' ? 'stage' : field
  const b = (await cell(page, rowIndex, near).boundingBox())!
  await page.mouse.click(b.x + b.width - 16, b.y + b.height - 5)
  if (field === 'done') await page.keyboard.press('ArrowLeft')
}
async function selectTo(page: Page, rowIndex: number, field: string) {
  await page.keyboard.down('Shift')
  if (field === 'done') {
    await page.keyboard.press('ArrowDown')
  } else {
    const b = (await cell(page, rowIndex, field).boundingBox())!
    await page.mouse.click(b.x + b.width - 16, b.y + b.height - 5)
  }
  await page.keyboard.up('Shift')
}
/** The handle dragged with the pointer to the cell at `rowIndex`. */
async function dragHandleTo(page: Page, rowIndex: number, field: string) {
  const handle = page.locator('.sv-grid-fill-handle')
  // A cell reached by key has no handle until it is a selection.
  if (field === 'done' && !(await handle.count())) {
    await page.keyboard.press('Shift+ArrowDown')
    await page.keyboard.press('Shift+ArrowUp')
  }
  await handle.waitFor()
  const h = (await handle.boundingBox())!
  const to = (await cell(page, rowIndex, field).boundingBox())!
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width - 6, to.y + to.height / 2, { steps: 8 })
  await page.mouse.up()
}
// Windows gives text back with CRLF line ends.
const clipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText()).then((t) => t.replace(/\r\n/g, '\n'))
const setClipboard = (page: Page, text: string) => page.evaluate((t) => navigator.clipboard.writeText(t), text)
async function copyCell(page: Page, rowIndex: number, field: string) {
  await select(page, rowIndex, field)
  await setClipboard(page, '-')
  await page.keyboard.press('Control+c')
  await expect.poll(() => clipboard(page), { message: `a copy of ${field}` }).not.toBe('-')
  return clipboard(page)
}
async function pasteInto(page: Page, rowIndex: number, field: string) {
  await select(page, rowIndex, field)
  await page.keyboard.press('Control+v')
}
const toast = (page: Page, text: string | RegExp) => page.locator('.sv-toast', { hasText: text }).first()

/** A file given to the import dialog of the shown table, every column mapped by its header. */
async function importInto(page: Page, csv: string) {
  await page.locator('.sv-btabs-more').click()
  await page.getByRole('menuitem', { name: 'Import records from a file' }).click()
  await page.locator('input[type=file]').setInputFiles({ name: 'in.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await page.locator('.sv-bimp-map').waitFor()
}
const finishImport = (page: Page) => page.locator('.sv-bimp-btn.is-primary').click()
const csvCell = (text: string) => `"${text.replace(/"/g, '""')}"`

test.describe('fill handle, field by field', () => {
  // One drag per field, about thirty fields: 35 to 40 s on a dev server.
  test.setTimeout(90_000)
  test('one source cell copies, for every field a person can write', async ({ page }) => {
    await open(page)
    const was = await record(page, 'r1')
    for (const field of WRITABLE) {
      await select(page, 0, field)
      await dragHandleTo(page, 2, field)
      await soft.poll(async () => (await record(page, 'r3'))[field], { message: field, timeout: 2000 }).toEqual(was[field])
      soft((await record(page, 'r2'))[field], field).toEqual(was[field])
      soft(await shown(page, 2, field), field).toBe(await shown(page, 0, field))
    }
  })

  test('two sources continue a series for number and date fields and repeat in every other', async ({ page }) => {
    await open(page)
    // Row 2 first holds a second value of each field, written by a paste of text.
    const second: Record<string, string> = {
      notes: 'second', done: 'false', stage: 'P2', tags: 'Blue', owner: 'Cleo Park', team: 'Ana Ruiz', due: 'October 12, 2026', at: '2026-10-11 15:30', phone: '555', email: 'b@example.com',
      site: 'https://example.com/b', code: 'XYZ-9', todo: '[ ] Other', tint: '#112233', qty: '5', ratio: '1.5', price: '$1,334.57', share: '23%', oldPrice: '$20.50', oldShare: '60%', points: '50%',
      spent: '2:00', starts: '3:00 PM', stars: '2', votes: 'Ana Ruiz', trend: '1, 2', account: '"Acme, Inc."', ai: 'Written twice',
    }
    for (const [field, text] of Object.entries(second)) {
      await setClipboard(page, text)
      await pasteInto(page, 1, field)
    }
    await setClipboard(page, '2026-10-09 15:30')
    await pasteInto(page, 0, 'at')
    await expect.poll(async () => (await record(page, 'r2')).ai).toBe('Written twice')
    await expect.poll(async () => (await record(page, 'r1')).at).toBe('2026-10-09T12:30:00.000Z')
    const one = await record(page, 'r1')
    const two = await record(page, 'r2')
    const series: Record<string, unknown[]> = {
      qty: [7, 9],
      ratio: [1.75, 2],
      price: [1434.573, 1534.576],
      share: [0.335, 0.44],
      oldPrice: [30.5, 40.5],
      oldShare: [0.7, 0.8],
      points: [60, 70],
      due: ['2026-10-15', '2026-10-18'],
      at: ['2026-10-13T12:30:00.000Z', '2026-10-15T12:30:00.000Z'],
    }
    for (const field of Object.keys(second)) {
      await select(page, 0, field)
      await selectTo(page, 1, field)
      await dragHandleTo(page, 3, field)
      const want = series[field] ?? [one[field], two[field]]
      await soft.poll(async () => (await record(page, 'r4'))[field], { message: field, timeout: 2000 }).toEqual(want[1])
      soft((await record(page, 'r3'))[field], field).toEqual(want[0])
    }
  })

  test('a run of days at one time goes on at that time across a clock change', async ({ page }) => {
    await open(page)
    await setClipboard(page, '2026-10-24 15:30')
    await pasteInto(page, 0, 'at')
    await setClipboard(page, '2026-10-25 15:30')
    await pasteInto(page, 1, 'at')
    await expect.poll(async () => (await record(page, 'r2')).at).toBe('2026-10-25T13:30:00.000Z')
    await select(page, 0, 'at')
    await selectTo(page, 1, 'at')
    await dragHandleTo(page, 2, 'at')
    // Summer time ends in Athens on the 25th: 15:30 is two hours from UTC after it, not three.
    await expect.poll(async () => (await record(page, 'r3')).at).toBe('2026-10-26T13:30:00.000Z')
    await expect(cell(page, 2, 'at')).toHaveText('2026-10-26 15:30')
  })

  test('a series that leaves what the field can hold stops there, and says so', async ({ page }) => {
    await open(page)
    await setClipboard(page, '2')
    await pasteInto(page, 0, 'qty')
    await setClipboard(page, '1')
    await pasteInto(page, 1, 'qty')
    await expect.poll(async () => (await record(page, 'r2')).qty).toBe(1)
    await select(page, 0, 'qty')
    await selectTo(page, 1, 'qty')
    await dragHandleTo(page, 4, 'qty')
    // Qty refuses a negative: 0 fits, -1 and -2 do not.
    await expect.poll(async () => (await record(page, 'r3')).qty).toBe(0)
    expect((await record(page, 'r4')).qty ?? null).toBeNull()
    expect((await record(page, 'r5')).qty ?? null).toBeNull()
    await expect(toast(page, /do not fit/)).toBeVisible()
  })

  test('filling sideways goes as a paste would: a value a field cannot read stays out', async ({ page }) => {
    await open(page)
    await select(page, 0, 'stage')
    await dragHandleTo(page, 0, 'tags')
    await expect(toast(page, /does not fit Tags/)).toBeVisible()
    expect((await record(page, 'r1')).tags).toEqual(['t1', 't3'])
    await select(page, 0, 'qty')
    await dragHandleTo(page, 0, 'ratio')
    await expect.poll(async () => (await record(page, 'r1')).ratio).toBe(3)
  })

  test('Ctrl+D copies the row above into the cell, and the top of a selection down it', async ({ page }) => {
    await open(page)
    await select(page, 1, 'owner')
    await page.keyboard.press('Control+d')
    await expect.poll(async () => (await record(page, 'r2')).owner).toBe('u4')
    await select(page, 0, 'price')
    await selectTo(page, 3, 'price')
    await page.keyboard.press('Control+d')
    await expect.poll(async () => (await record(page, 'r4')).price).toBe(1234.567)
    expect((await record(page, 'r2')).price).toBe(1234.567)
    // One undo takes the whole of it back, and the button says what it undoes.
    await expect(page.locator('.sv-btabs').getByRole('button', { name: /^Undo/ })).toHaveAccessibleName(/3 cells/)
    await page.keyboard.press('Control+z')
    await expect.poll(async () => (await record(page, 'r4')).price ?? null).toBeNull()
    expect((await record(page, 'r2')).price ?? null).toBeNull()
  })

  test('computed fields take no fill', async ({ page }) => {
    await open(page)
    const was = await stored(page)
    for (const field of COMPUTED) {
      await select(page, 0, field)
      if (await page.locator('.sv-grid-fill-handle').count()) await dragHandleTo(page, 2, field)
    }
    const now = await stored(page)
    for (const field of COMPUTED) expect(now[2]![field], field).toEqual(was[2]![field])
  })
})

test.describe('copy and paste, field by field', () => {
  test('the clipboard holds what the cell shows', async ({ page }) => {
    await open(page)
    for (const field of WRITABLE) soft(await copyCell(page, 0, field), field).toBe(CLIPBOARD[field])
    // A computed field is copied as it shows too.
    soft(await copyCell(page, 0, 'calc'), 'calc').toBe('6')
    soft(await copyCell(page, 0, 'city'), 'city').toBe('Oslo')
  })

  test('a cell pasted elsewhere stores the same value and shows the same text', async ({ page }) => {
    await open(page)
    const was = await record(page, 'r1')
    for (const field of WRITABLE) {
      await copyCell(page, 0, field)
      await pasteInto(page, 3, field)
      await soft.poll(async () => (await record(page, 'r4'))[field], { message: field, timeout: 2000 }).toEqual(was[field])
      soft(await shown(page, 3, field), field).toBe(await shown(page, 0, field))
    }
  })

  test('with only the text to go on, each field reads what it wrote', async ({ page }) => {
    await open(page)
    for (const field of WRITABLE) {
      await setClipboard(page, CLIPBOARD[field]!)
      await pasteInto(page, 4, field)
      if (field === 'files') {
        await soft.poll(async () => ((await record(page, 'r5')).files as Array<{ url: string }> | undefined)?.map((f) => f.url), { message: field, timeout: 2000 }).toEqual(['https://files.example.com/brief.pdf'])
      } else if (field === 'todo') {
        await soft.poll(async () => ((await record(page, 'r5')).todo as Array<{ text: string; done: boolean }> | undefined)?.map((i) => [i.text, i.done]), { message: field, timeout: 2000 }).toEqual([['Draft', true], ['Review', false]])
      } else {
        await soft.poll(async () => (await record(page, 'r5'))[field], { message: field, timeout: 2000 }).toEqual(FROM_TEXT[field])
      }
    }
  })

  test('an empty cell pasted over a value clears it, in every field', async ({ page }) => {
    await open(page)
    for (const field of WRITABLE) {
      await copyCell(page, 7, field)
      await pasteInto(page, 0, field)
    }
    const now = await record(page, 'r1')
    for (const field of WRITABLE) {
      if (field === 'done') continue
      const v = now[field]
      soft(v == null || v === '' || (Array.isArray(v) && !v.length), `${field} is ${JSON.stringify(v)}`).toBe(true)
    }
  })

  test('a block of every field moves as one, each value the same', async ({ page }) => {
    await open(page)
    const was = await record(page, 'r1')
    await select(page, 0, 'notes')
    await selectTo(page, 0, 'ai')
    await page.keyboard.press('Control+c')
    await pasteInto(page, 5, 'notes')
    await expect.poll(async () => (await record(page, 'r6')).ai).toBe(was.ai)
    const now = await record(page, 'r6')
    for (const field of WRITABLE) soft(now[field], field).toEqual(was[field])
    // The record under it has not been touched.
    expect((await record(page, 'r7')).notes ?? null).toBeNull()
  })

  test('a paste past the last row keeps the stored values too', async ({ page }) => {
    await open(page)
    await setClipboard(page, '50%')
    await pasteInto(page, 1, 'share')
    await select(page, 0, 'share')
    await selectTo(page, 1, 'share')
    await page.keyboard.press('Control+c')
    await pasteInto(page, 7, 'share')
    await expect.poll(async () => (await stored(page)).length).toBe(9)
    expect((await record(page, 'r8')).share).toBe(0.125)
    expect((await stored(page))[8]!.share).toBe(0.5)
  })

  test('one multi-line cell in is one cell out, and the record below keeps its value', async ({ page }) => {
    await open(page)
    expect(await copyCell(page, 0, 'notes')).toBe('"line one\nline two"')
    await pasteInto(page, 1, 'keep')
    await expect.poll(async () => (await record(page, 'r2')).keep).toBe('line one\nline two')
    expect((await record(page, 'r3')).keep).toBe('keep 3')
  })

  test("Excel's own quoted text is one cell, its quotes doubled, its tabs and rows kept", async ({ page }) => {
    await open(page)
    await setClipboard(page, '"line ""one""\nline two"\tnext\r\nthird\t"a\tb"\r\n')
    await pasteInto(page, 2, 'keep')
    await expect.poll(async () => (await record(page, 'r3')).keep).toBe('line "one"\nline two')
    expect((await record(page, 'r3')).notes).toBe('next')
    expect((await record(page, 'r4')).keep).toBe('third')
    expect((await record(page, 'r4')).notes).toBe('a\tb')
    expect((await record(page, 'r5')).keep).toBe('keep 5')
  })

  test('a word in quote marks from a sheet stays as it is', async ({ page }) => {
    await open(page)
    await setClipboard(page, '"hello"')
    await pasteInto(page, 2, 'keep')
    await expect.poll(async () => (await record(page, 'r3')).keep).toBe('"hello"')
    await copyCell(page, 2, 'keep')
    await pasteInto(page, 3, 'keep')
    await expect.poll(async () => (await record(page, 'r4')).keep).toBe('"hello"')
  })

  test('text a field cannot read keeps the cell, and the page says so with no host toaster', async ({ page }) => {
    await open(page)
    for (const [field, text] of [['qty', 'abc'], ['stage', 'Nope'], ['owner', 'Nobody Known'], ['account', 'No such'], ['stars', '9'], ['votes', 'Nobody Known'], ['due', 'someday'], ['tint', 'not a color']] as const) {
      const was = (await record(page, 'r1'))[field]
      await setClipboard(page, text)
      await pasteInto(page, 0, field)
      await soft(toast(page, 'does not fit'), field).toBeVisible()
      soft((await record(page, 'r1'))[field], field).toEqual(was)
      await page.evaluate(() => document.querySelectorAll('.sv-toast__x').forEach((b) => (b as HTMLElement).click()))
    }
  })
})

test.describe('keys', () => {
  test('Space on a vote votes, and leaves the record shut', async ({ page }) => {
    await open(page)
    await select(page, 0, 'votes')
    await page.keyboard.press('Space')
    await expect.poll(async () => (await record(page, 'r1')).votes).toEqual(['u2', 'u3', 'u1'])
    await expect(page.locator('.sv-frv-fields')).toHaveCount(0)
    await page.keyboard.press('Space')
    await expect.poll(async () => (await record(page, 'r1')).votes).toEqual(['u2', 'u3'])
  })
  test('Space on any other cell opens the record, as it did', async ({ page }) => {
    await open(page)
    await select(page, 0, 'keep')
    await page.keyboard.press('Space')
    await expect(page.locator('.sv-frv-fields')).toBeVisible()
  })
  test('rich text typed over several lines sits in its row', async ({ page }) => {
    await open(page)
    await select(page, 1, 'rich')
    await page.keyboard.press('Enter')
    await page.locator('[contenteditable="true"]').waitFor()
    await page.keyboard.type('Hello')
    await page.keyboard.press('Enter')
    await page.keyboard.type('there')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Control+Enter')
    await expect.poll(async () => (await record(page, 'r2')).rich).toBeTruthy()
    const rows = await cell(page, 1, 'rich').evaluate((td) => {
      const c = td.getBoundingClientRect()
      const t = td.querySelector('.sv-frh')!.getBoundingClientRect()
      return { top: t.top - c.top, bottom: c.bottom - t.bottom }
    })
    expect(rows.top).toBeGreaterThanOrEqual(0)
    expect(rows.bottom).toBeGreaterThanOrEqual(0)
  })

  test('a redo of pasted records is said as a redo', async ({ page }) => {
    await open(page)
    await setClipboard(page, 'One\nTwo\nThree')
    await pasteInto(page, 7, 'keep')
    await expect.poll(async () => (await stored(page)).length).toBe(10)
    const undo = page.locator('.sv-btabs').getByRole('button', { name: /^Undo/ })
    await expect(undo).toHaveAccessibleName(/paste 2 records/)
    await undo.click()
    await expect.poll(async () => (await stored(page)).length).toBe(8)
    await page.locator('.sv-btabs').getByRole('button', { name: /^Redo/ }).click()
    await expect.poll(async () => (await stored(page)).length).toBe(10)
    await expect(page.locator('[aria-live]').filter({ hasText: /Redone: / }).first()).toBeAttached()
    await expect(page.locator('[aria-live]').filter({ hasText: /Undone: / })).toHaveCount(0)
  })

  test('a picker closed with no change leaves no step to undo', async ({ page }) => {
    await open(page)
    const undo = page.locator('.sv-btabs').getByRole('button', { name: /^Undo/ })
    await expect(undo).toBeDisabled()
    await select(page, 0, 'account')
    await page.keyboard.press('Enter')
    await page.locator('.sv-flp-btn.is-primary').click()
    await expect(undo).toBeDisabled()
    await select(page, 0, 'tags')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Escape')
    await expect(undo).toBeDisabled()
  })
})

test.describe('notices', () => {
  test('a base with no toaster on the page draws its own, once', async ({ page }) => {
    await open(page)
    await setClipboard(page, 'abc')
    await pasteInto(page, 0, 'qty')
    await expect(page.locator('.sv-toast')).toHaveCount(1)
    await expect(page.locator('.sv-toaster')).toHaveCount(1)
  })
  test('with a host toaster there is no second one', async ({ page }) => {
    await open(page, { toaster: true })
    await setClipboard(page, 'abc')
    await pasteInto(page, 0, 'qty')
    await expect(page.locator('.sv-toast')).toHaveCount(1)
    await expect(page.locator('.sv-toaster')).toHaveCount(1)
  })
})

const HEADERS: Record<string, string> = {
  name: 'Name', notes: 'Notes', rich: 'Rich', files: 'Files', done: 'Done', stage: 'Stage', tags: 'Tags', owner: 'Owner', team: 'Team', due: 'Due', at: 'At', phone: 'Phone', email: 'Email',
  site: 'Site', code: 'Code', todo: 'Todo', tint: 'Tint', qty: 'Qty', ratio: 'Ratio', price: 'Price', share: 'Share', oldPrice: 'Old price', oldShare: 'Old share', points: 'Points', spent: 'Spent',
  starts: 'Starts', stars: 'Stars', votes: 'Votes', trend: 'Trend', account: 'Account', ai: 'Ai',
}

test.describe('import, field by field', () => {
  test('a file with each field written as it shows lands as the field reads it', async ({ page }) => {
    await open(page)
    const file: Record<string, string> = {
      name: 'From file', notes: 'line one\nline two', rich: 'Bold words', files: 'https://files.example.com/brief.pdf', done: 'yes', stage: 'P1', tags: 'Blue, Green', owner: 'Cleo Park', team: 'Ana Ruiz, "Chen, Maya"',
      due: 'October 9, 2026', at: '2026-10-09 15:30', phone: '+1 415 555 0123', email: 'ann@example.com', site: 'https://example.com/a', code: 'ABC-123', todo: '[x] Draft\n[ ] Review', tint: '#336699',
      qty: '3', ratio: '1.25', price: '$1,234.57', share: '25%', oldPrice: '$10.50', oldShare: '100%', points: '40%', spent: '1:30', starts: '2:30 PM', stars: '4', votes: 'Ben Okafor, Cleo Park', trend: '3, 7, 4, 9',
      account: '"Acme, Inc.", Contoso', ai: 'Imported',
    }
    const keys = Object.keys(file)
    await importInto(page, `${keys.map((k) => HEADERS[k]!).map(csvCell).join(',')}\n${keys.map((k) => csvCell(file[k]!)).join(',')}\n`)
    await expect(page.locator('.sv-bimp-warn')).toHaveCount(0)
    await finishImport(page)
    await expect.poll(async () => (await stored(page)).length).toBe(9)
    const r = (await stored(page))[8]!
    const want: Record<string, unknown> = {
      name: 'From file', notes: 'line one\nline two', done: true, stage: 'p1', tags: ['t2', 't3'], owner: 'u3', team: ['u1', 'u5'], due: '2026-10-09', at: '2026-10-09T12:30:00.000Z', phone: '+1 415 555 0123',
      email: 'ann@example.com', site: 'https://example.com/a', code: 'ABC-123', tint: '#336699', qty: 3, ratio: 1.25, price: 1234.57, share: 0.25, oldPrice: 10.5, oldShare: 1, points: 40, spent: 5400, starts: '14:30',
      stars: 4, votes: ['u2', 'u3'], trend: [3, 7, 4, 9], account: ['a2', 'a1'], ai: 'Imported',
    }
    for (const [field, value] of Object.entries(want)) soft(r[field], field).toEqual(value)
    soft(r.rich, 'rich').toContain('Bold words')
    soft((r.files as Array<{ url: string }>)?.[0]?.url, 'files').toBe('https://files.example.com/brief.pdf')
    soft((r.todo as Array<{ text: string; done: boolean }>)?.map((i) => [i.text, i.done]), 'todo').toEqual([['Draft', true], ['Review', false]])
    // The other side of the link shows the new record.
    const accounts = await stored(page, 'accounts')
    expect(accounts.find((a) => a.id === 'a2')!.items).toEqual([r.id])
  })

  test('a person matches by name or email; anyone else is no person, and is counted', async ({ page }) => {
    await open(page)
    await importInto(page, 'Name,Owner,Team,Account\nOne,cleo@example.com,"Ana Ruiz, Nobody Known",No such record\nTwo,Nobody Known,,Contoso\n')
    await expect(page.locator('.sv-bimp-warn')).toContainText('3 cells name a person or a record that was not found')
    await finishImport(page)
    await expect.poll(async () => (await stored(page)).length).toBe(10)
    const [one, two] = (await stored(page)).slice(8)
    expect(one!.owner).toBe('u3')
    expect(one!.team).toEqual(['u1'])
    expect(one!.account).toEqual([])
    expect(two!.owner ?? null).toBeNull()
    expect(two!.account).toEqual(['a1'])
    await expect(toast(page, /3 cells name/)).toBeVisible()
  })

  test('link fields are offered for a column to go to', async ({ page }) => {
    await open(page)
    await importInto(page, 'Name,Account\nOne,Contoso\n')
    await expect(page.locator('.sv-bimp-map select').nth(1)).toHaveValue('account')
  })

  test('a column of day-first dates reads day first all the way down', async ({ page }) => {
    await open(page)
    await importInto(page, 'Name,Due\nOne,13/02/2026\nTwo,12/02/2026\n')
    await finishImport(page)
    await expect.poll(async () => (await stored(page)).length).toBe(10)
    const rows = await stored(page)
    expect(rows[8]!.due).toBe('2026-02-13')
    expect(rows[9]!.due).toBe('2026-02-12')
  })

  test("the base's own CSV reads back to the same values", async ({ page }) => {
    await open(page)
    await page.locator('.sv-btabs').getByRole('button', { name: 'All tables' }).click()
    const download = page.waitForEvent('download')
    await page.getByRole('menuitem', { name: 'Download this view as CSV' }).click()
    const text = readFileSync(await (await download).path(), 'utf8')
    await importInto(page, text)
    await finishImport(page)
    await expect.poll(async () => (await stored(page)).length).toBe(16)
    const was = (await stored(page))[0]!
    const back = (await stored(page))[8]!
    // The file holds the whole value, whatever the cell rounds it to.
    for (const field of ['notes', 'done', 'stage', 'tags', 'team', 'due', 'phone', 'email', 'site', 'tint', 'qty', 'ratio', 'price', 'share', 'oldPrice', 'oldShare', 'points', 'spent', 'starts', 'stars', 'votes', 'trend', 'account']) soft(back[field], field).toEqual(was[field])
  })

  for (const timezoneId of ['America/Los_Angeles', 'Pacific/Auckland', 'Asia/Tokyo', 'UTC']) {
    test.describe(`in ${timezoneId}`, () => {
      test.use({ timezoneId })
      test('a date keeps its calendar day however it is written', async ({ page }) => {
        await open(page)
        await importInto(page, 'Name,Due\nA,"October 9, 2026"\nB,12/02/2026\nC,"Dec 3, 2026"\nD,3 December 2026\nE,2026-10-09\n')
        await finishImport(page)
        await expect.poll(async () => (await stored(page)).length).toBe(13)
        expect((await stored(page)).slice(8).map((r) => r.due)).toEqual(['2026-10-09', '2026-12-02', '2026-12-03', '2026-12-03', '2026-10-09'])
        await expect(cell(page, 8, 'due')).toHaveText('October 9, 2026')
      })
      test('a text field changed to a date keeps the day too', async ({ page }) => {
        await open(page)
        await setClipboard(page, 'October 9, 2026\n12/02/2026\nsomeday')
        await pasteInto(page, 0, 'keep')
        await expect.poll(async () => (await record(page, 'r3')).keep).toBe('someday')
        const head = page.locator('[data-svgrid-header-col="keep"]')
        await head.hover()
        await head.locator('.sv-grid-col-menu-btn:not(.sv-grid-col-filter-btn)').click()
        await page.getByText('Edit field', { exact: true }).click()
        const dialog = page.getByRole('dialog')
        await dialog.locator('.sv-fed-current').click()
        await dialog.getByRole('radio', { name: 'Date', exact: true }).click()
        await dialog.getByRole('button', { name: 'Save' }).click()
        await expect.poll(async () => (await record(page, 'r1')).keep).toBe('2026-10-09')
        expect((await record(page, 'r2')).keep).toBe('2026-12-02')
        expect((await record(page, 'r3')).keep ?? null).toBeNull()
      })
    })
  }
})
