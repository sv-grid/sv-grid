/**
 * E2E: a base with a teammate, on Postgres in the page (PGlite), with a real mouse.
 *  - Delete forever while a teammate presses Restore: the purge holds, the record goes
 *    with its links, and the teammate is told. With no transaction the page runs the
 *    steps; with one, and through `createBaseEndpoint`, the server does.
 *  - Delete forever that fails part way: the record stays in the trash with every
 *    link, and Restore brings it back whole.
 *  - Undo of a hard delete on a Kit route asks no restore of a table that cannot do one.
 *  - A write a row level policy refused (PostgREST's answer, in the page) leaves no
 *    undo step: Ctrl+Z goes to the edit before it.
 * The database and its faults are `window.__team` (fixtures/base-team.ts).
 */
import { fileURLToPath } from 'node:url'
import { expect, test, type Locator, type Page } from '@playwright/test'

const FIXTURE = fileURLToPath(new URL('./fixtures/base-team.ts', import.meta.url)).replace(/\\/g, '/').replace(/^\//, '')

type Row = Record<string, unknown>
type Team = { sql(text: string): Promise<Row[]>; faults: { stallOn: string | null; stalled: boolean; release: (() => void) | null; failOn: string | null }; ops: string[]; requests: string[]; project: { tables: Record<string, Row[]> } }

async function open(page: Page, way: string) {
  await page.setViewportSize({ width: 1600, height: 900 })
  // A file saved on the dev server must not reload the page under the test.
  await page.routeWebSocket(/.*/, () => {})
  await page.goto('/sv-grid/#/demos/01-quick-start', { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.evaluate(async ([path, w]) => {
    const fixture = await import(/* @vite-ignore */ path)
    await fixture.show(w)
  }, [`/sv-grid/@fs/${FIXTURE}`, way] as const)
  await page.locator('.sv-grid-row', { hasText: /Acme|Write the brief|Ana task/ }).first().waitFor({ timeout: 60_000 })
  await page.evaluate(() => document.querySelectorAll('[data-svgrid-enterprise-upgrade]').forEach((n) => n.remove()))
}

const sql = (page: Page, text: string) => page.evaluate((t) => (window as unknown as { __team: Team }).__team.sql(t), text)
/** `read` run in the page on `window.__team`. */
const team = <T>(page: Page, read: (t: Team) => T) => page.evaluate(`(${read.toString()})(window.__team)`) as Promise<T>
const side = (page: Page, who: 'ana' | 'ben') => page.locator(`.team-${who}`)

/** Acme's state, and the keys its orders hold. */
async function acme(page: Page) {
  const [c] = await sql(page, `select deleted_at from p_cust where id = 'c1'`)
  const keys = Object.fromEntries((await sql(page, `select id, cust_id from p_ord where id in ('o1', 'o2') order by id`)).map((r) => [r.id, r.cust_id]))
  const state = !c ? 'gone' : c.deleted_at == null ? 'live' : new Date(String(c.deleted_at)).getFullYear() < 1971 ? 'claimed' : 'marked'
  return { state, keys }
}
const WHOLE = { o1: 'c1', o2: 'c1' }
const CUT = { o1: null, o2: null }

async function deleteAcme(page: Page) {
  await side(page, 'ana').getByText('Acme', { exact: true }).first().click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Delete record' }).click()
  await page.getByRole('dialog', { name: 'Delete record?' }).getByRole('button', { name: 'Delete record' }).click()
  await expect.poll(async () => (await acme(page)).state).toBe('marked')
}
async function openTrash(page: Page, who: 'ana' | 'ben') {
  await side(page, who).locator('.sv-btabs-trash').click()
  const trash = page.getByRole('dialog', { name: 'Trash' })
  await expect(trash.getByText('Acme')).toBeVisible()
  return trash
}
async function closeTrash(page: Page) {
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Trash' })).toHaveCount(0)
}
async function deleteForever(trash: Locator) {
  await trash.locator('.sv-btrash-x').click()
  // The question in its place: "Delete forever" names the record too.
  await trash.getByText('Delete this forever? It cannot be undone.').waitFor()
  await trash.getByRole('button', { name: 'Delete Acme forever' }).click()
}

for (const way of ['steps', 'tx', 'endpoint'] as const) {
  const name = way === 'steps' ? 'the page runs the steps' : way === 'tx' ? 'a transaction' : 'createBaseEndpoint with a transaction'
  test.describe(`Delete forever on Postgres, ${name}`, () => {
    test('a teammate\'s Restore during it: the record goes with its links, and the teammate is told', async ({ page }) => {
      await open(page, way)
      await deleteAcme(page)
      // The real delete waits, after the keys to it are emptied.
      await page.evaluate(() => ((window as unknown as { __team: Team }).__team.faults.stallOn = '^\\s*delete from "?p_cust'))
      const trash = await openTrash(page, 'ana')
      await deleteForever(trash)
      await expect.poll(() => team(page, (t) => t.faults.stalled)).toBe(true)
      await closeTrash(page)
      if (way === 'steps') {
        // The purge has claimed the record: Restore cannot meet it half done.
        expect((await acme(page)).state).toBe('claimed')
        const benTrash = await openTrash(page, 'ben')
        const restore = benTrash.getByRole('button', { name: 'Restore Acme', exact: true })
        await expect(restore).toBeDisabled()
        await expect(benTrash.getByText(/cannot be restored/)).toBeVisible()
        await closeTrash(page)
      } else {
        // The server holds it all in one transaction: Ben's trash waits for it, and Acme is gone when it opens.
        await side(page, 'ben').locator('.sv-btabs-trash').click()
      }
      await page.evaluate(() => (window as unknown as { __team: Team }).__team.faults.release?.())
      await expect.poll(() => acme(page)).toEqual({ state: 'gone', keys: CUT })
      if (way !== 'steps') {
        const benTrash = page.getByRole('dialog', { name: 'Trash' })
        await expect(benTrash).toBeVisible()
        await expect(benTrash.getByText('Acme')).toHaveCount(0)
        await closeTrash(page)
      }
      // Nothing came back: no record with its links cut.
      expect(await sql(page, `select id from p_cust order by id`)).toEqual([{ id: 'c2' }])
    })

    test('a failure part way: the record stays in the trash with every link, and Restore brings it back whole', async ({ page }) => {
      await open(page, way)
      await deleteAcme(page)
      await page.evaluate(() => ((window as unknown as { __team: Team }).__team.faults.failOn = '^\\s*delete from "?p_cust'))
      const trash = await openTrash(page, 'ana')
      await deleteForever(trash)
      await expect(page.getByRole('alert').filter({ hasText: 'Could not delete Acme forever' }).first()).toContainText('It is still in the trash')
      await expect.poll(() => acme(page)).toEqual({ state: 'marked', keys: WHOLE })
      await expect(trash.getByText('Acme')).toBeVisible()
      await trash.getByRole('button', { name: 'Restore Acme', exact: true }).click()
      await expect.poll(() => acme(page)).toEqual({ state: 'live', keys: WHOLE })
      await closeTrash(page)
      await expect(side(page, 'ana').getByText('Acme', { exact: true })).toBeVisible()
    })
  })
}

test('undo of a hard delete on a Kit route sends no restore first', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  await open(page, 'hard')
  const row = side(page, 'ana').locator('.sv-grid-row', { hasText: 'Write the brief' })
  await row.getByText('Write the brief', { exact: true }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Delete record' }).click()
  await page.getByRole('dialog', { name: 'Delete record?' }).getByRole('button', { name: 'Delete record' }).click()
  await expect.poll(async () => (await sql(page, `select id from h_task where id = 't1'`)).length).toBe(0)
  const before = (await team(page, (t) => t.ops.slice())).length
  // A click on a selected cell would open its editor, where Ctrl+Z is the text's.
  await side(page, 'ana').locator('table[role="grid"]').focus()
  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await sql(page, `select name, note from h_task where id = 't1'`))[0]).toEqual({ name: 'Write the brief', note: 'draft' })
  const after = (await team(page, (t) => t.ops.slice())).slice(before)
  expect(after.some((x) => / restore /.test(x)), after.join('; ')).toBe(false)
  expect(after.filter((x) => / 405$/.test(x))).toEqual([])
  expect(errors.filter((e) => /405|restore/i.test(e))).toEqual([])
})

test('a write a row level policy refused leaves no undo step: Ctrl+Z goes to the edit before it', async ({ page }) => {
  await open(page, 'rls')
  const note = (task: string) => side(page, 'ana').locator('.sv-grid-row', { hasText: task }).locator('[data-col-id="note"]')
  const stored = (id: string) => page.evaluate((x) => ((window as unknown as { __team: Team }).__team.project.tables.r_task!.find((r) => r.id === x) as Row).note, id)
  const type = async (task: string, text: string) => {
    await note(task).dblclick()
    await page.keyboard.press('Control+a')
    await page.keyboard.type(text)
    await page.keyboard.press('Enter')
  }
  await type('Ana task', 'mine')
  await expect.poll(() => stored('r1')).toBe('mine')
  await type('Ben task', 'not mine')
  // Refused, said, and the cell shows what is stored.
  await expect(page.getByText(/Not saved|permission|no longer/i).first()).toBeVisible()
  await expect(note('Ben task')).toHaveText('his')
  const sent = (await team(page, (t) => t.requests.slice())).length
  await side(page, 'ana').locator('table[role="grid"]').focus()
  await page.keyboard.press('Control+z')
  await expect.poll(() => stored('r1')).toBe('hers')
  expect(await stored('r2')).toBe('his')
  // One write: the undo of Ana's own edit, none for the refused one.
  expect((await team(page, (t) => t.requests.slice())).slice(sent).filter((x) => x.startsWith('PATCH'))).toHaveLength(1)
})
