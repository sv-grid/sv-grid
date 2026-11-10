/**
 * E2E: a calendar on a day the clocks change (23 or 25 hours long). The day
 * view labels its rows by the clock, so an event is drawn on its own row, a
 * drop writes the time of the row it lands on, and a keyboard carry stays in
 * sight, as on any other day. Each used to be an hour off: the layout counted
 * real minutes since midnight.
 */
import { expect, test, type Page } from '@playwright/test'

const SCHEDULER = '/sv-grid/#/demos/46-scheduler'

test.describe.configure({ timeout: 150_000 })

const event = (page: Page) => page.locator('.sv-sched-event[aria-label^="Annual check"]').first()
const rowTop = (page: Page, label: string) =>
  page.evaluate((l) => {
    const el = [...document.querySelectorAll('.sv-sched *')].find((e) => e.children.length === 0 && e.textContent?.trim() === l)
    return el ? el.getBoundingClientRect().top : null
  }, label)

async function open(page: Page, at: string) {
  await page.clock.install({ time: new Date(at) })
  await page.setViewportSize({ width: 1400, height: 1000 })
  await page.goto(SCHEDULER)
  await event(page).waitFor({ timeout: 120_000 })
}

/** How far the event's top sits below the 8 am label: the same on every day. */
async function offset(page: Page) {
  const box = (await event(page).boundingBox())!
  return box.y - (await rowTop(page, '8 am'))!
}

for (const [tz, normal, changed] of [
  ['America/New_York', '2026-10-31T12:00:00-04:00', '2026-11-01T12:00:00-05:00'],
  ['America/New_York', '2026-03-07T12:00:00-05:00', '2026-03-08T12:00:00-04:00'],
  ['Europe/Helsinki', '2026-10-24T12:00:00+03:00', '2026-10-25T12:00:00+02:00'],
  ['Europe/Helsinki', '2026-03-28T12:00:00+02:00', '2026-03-29T12:00:00+03:00'],
] as const) {
  test.describe(`${tz}, ${changed.slice(0, 10)}`, () => {
    test.use({ timezoneId: tz })

    test('an event is drawn on its own row, as the day before', async ({ page }) => {
      await open(page, normal)
      const before = await offset(page)
      await open(page, changed)
      expect(Math.abs((await offset(page)) - before)).toBeLessThan(2)
    })
  })
}

test.describe('the day the clocks go back', () => {
  test.use({ timezoneId: 'America/New_York' })

  test('a drop on the 2 pm row writes 2 pm', async ({ page }) => {
    await open(page, '2026-11-01T12:00:00-05:00')
    const box = (await event(page).boundingBox())!
    // The middle of the event: its top and bottom edges resize it.
    const grab = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    const to = (await rowTop(page, '2 pm'))! - (await rowTop(page, '8 am'))!
    await page.mouse.move(grab.x, grab.y)
    await page.mouse.down()
    for (let i = 1; i <= 10; i += 1) await page.mouse.move(grab.x, grab.y + (to * i) / 10)
    await page.mouse.up()
    await expect(event(page)).toHaveAttribute('aria-label', /, 2\s?pm - 2:45\s?pm$/i)
  })
})

/**
 * A move keeps the event's length by the clock. Real minutes made a one-hour
 * event dropped on the repeated 1 am read and write 1am - 1am, a meeting of no
 * length once stored as wall time. Demo 363: a week from 12 am to 12 am,
 * Monday first, so Sunday Nov 1 is its last day.
 */
const INTRO = '/sv-grid/#/demos/363-scheduler-intro'
const named = (page: Page, title: string) => page.locator(`.sv-sched-event[aria-label^="${title},"]`).first()

async function openWeek(page: Page, at: string) {
  await page.clock.install({ time: new Date(at) })
  await page.setViewportSize({ width: 1400, height: 1100 })
  await page.goto(INTRO)
  await named(page, 'Release cut').waitFor({ timeout: 120_000 })
}

const showRow = (page: Page, label: string) =>
  page.evaluate((l) => [...document.querySelectorAll('.sv-sched *')].find((e) => e.children.length === 0 && e.textContent?.trim() === l)?.scrollIntoView({ block: 'start' }), label)

/**
 * Pick the event up by its middle (half an hour into a one-hour event), carry it
 * to the last day, bring the night into view with the button still held, and let
 * go so it starts `min` minutes after the `label` row. A label sits 7 px above
 * its line; five minutes more so the snap floors onto the slot.
 */
async function dropOnSunday(page: Page, title: string, label: string, min: number) {
  const ev = named(page, title)
  await ev.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  const box = (await ev.boundingBox())!
  const sunday = (await page.locator('.sv-sched-col[data-col-key]').last().boundingBox())!
  const grab = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const x = sunday.x + sunday.width / 2
  await page.mouse.move(grab.x, grab.y)
  await page.mouse.down()
  for (let i = 1; i <= 6; i += 1) await page.mouse.move(grab.x + ((x - grab.x) * i) / 6, grab.y)
  await showRow(page, '12 am')
  const hour = (await rowTop(page, '2 am'))! - (await rowTop(page, '1 am'))!
  const y = (await rowTop(page, label))! + 7 + (hour * (min + 30 + 5)) / 60
  for (let i = 1; i <= 6; i += 1) await page.mouse.move(x, grab.y + ((y - grab.y) * i) / 6)
  await page.mouse.up()
}

test.describe('a move onto the repeated hour keeps its length', () => {
  test.use({ timezoneId: 'America/New_York' })

  test('a drop at 1 am on Nov 1 reads 1am - 2am', async ({ page }) => {
    await openWeek(page, '2026-10-28T12:00:00-04:00')
    await dropOnSunday(page, 'Release cut', '1 am', 0)
    await expect(named(page, 'Release cut')).toHaveAttribute('aria-label', /Sunday, November 1, 1\s?am - 2\s?am$/i)
  })

  test('a keyboard carry onto 1 am on Nov 1 reads 1am - 2am, in hand and put down', async ({ page }) => {
    await openWeek(page, '2026-10-28T12:00:00-04:00')
    await named(page, 'Retro').focus()
    await page.keyboard.press('Space')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    // Friday 3:30 pm up to Sunday 1 am: 29 half-hour steps.
    for (let i = 0; i < 29; i += 1) await page.keyboard.press('ArrowUp')
    await expect(page.locator('[data-carried]')).toHaveAttribute('aria-label', /Sunday, November 1, 1\s?am - 2\s?am$/i)
    await page.keyboard.press('Space')
    await expect(named(page, 'Retro')).toHaveAttribute('aria-label', /Sunday, November 1, 1\s?am - 2\s?am$/i)
  })
})

test.describe('a move onto the skipped hour', () => {
  test.use({ timezoneId: 'America/New_York' })

  test('a drop at 1:30 am on Mar 14 2027 ends after the skip, an hour later in real time', async ({ page }) => {
    await openWeek(page, '2027-03-10T12:00:00-05:00')
    await dropOnSunday(page, 'Release cut', '1 am', 30)
    await expect(named(page, 'Release cut')).toHaveAttribute('aria-label', /Sunday, March 14, 1:30\s?am - 3:30\s?am$/i)
  })
})

test.describe('the day the clocks go back, a carry', () => {
  test.use({ timezoneId: 'America/New_York' })

  test('a keyboard carry to 7 pm stays drawn and in hand inside a 7 am to 8 pm day', async ({ page }) => {
    await open(page, '2026-11-01T12:00:00-05:00')
    await event(page).focus()
    await page.keyboard.press('Space')
    for (let i = 0; i < 22; i += 1) await page.keyboard.press('ArrowDown')
    const carried = page.locator('[data-carried]')
    await expect(carried).toBeFocused()
    await expect(carried).toHaveAttribute('aria-label', /, 7\s?pm - 7:45\s?pm$/i)
    // Drawn on the 7 pm row, not an hour below it out of the band.
    const top = (await carried.boundingBox())!.y
    const seven = (await rowTop(page, '7 pm'))!
    expect(Math.abs(top - seven - 7)).toBeLessThan(4)
    await page.keyboard.press('Space')
    await expect(event(page)).toBeFocused()
    await expect(event(page)).toHaveAttribute('aria-label', /, 7\s?pm - 7:45\s?pm$/i)
  })
})

/**
 * A carry by the keys keeps the event in sight. focus() on a button that has
 * focus does not scroll, so the event walked under the sticky header and out
 * of the view while the scroller stood still.
 */
test.describe('a keyboard carry stays in view', () => {
  test.use({ timezoneId: 'America/New_York' })

  /** How much of the carried event the scroller shows, below its sticky header (1 = all of it). */
  const inSight = (page: Page) =>
    page.locator('[data-carried]').evaluate((el) => {
      const sc = el.closest('.sv-sched-xscroll, .sv-sched-tl') as HTMLElement
      const head = sc.querySelector('.sv-sched-headwrap, .sv-sched-tl-head') as HTMLElement
      const side = sc.classList.contains('sv-sched-tl') ? (sc.querySelector('.sv-sched-tl-corner') as HTMLElement).offsetWidth : 56
      const box = sc.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      const top = Math.max(r.top, box.top + head.offsetHeight)
      const bottom = Math.min(r.bottom, box.top + sc.clientHeight)
      const left = Math.max(r.left, box.left + side)
      const right = Math.min(r.right, box.left + sc.clientWidth)
      return (Math.max(0, bottom - top) * Math.max(0, right - left)) / (r.height * r.width)
    })

  for (const [key, steps] of [['ArrowUp', 16], ['ArrowDown', 14]] as const) {
    test(`${key} x${steps} in a week: the event in hand is drawn in full at every step`, async ({ page }) => {
      await openWeek(page, '2026-10-28T12:00:00-04:00')
      await page.setViewportSize({ width: 1400, height: 700 })
      await named(page, 'Retro').focus()
      await page.keyboard.press('Space')
      for (let i = 0; i < steps; i += 1) {
        await page.keyboard.press(key)
        expect(await inSight(page)).toBeGreaterThan(0.99)
      }
      await expect(page.locator('[data-carried]')).toBeFocused()
      await page.keyboard.press('Escape')
    })
  }

  test('a timeline carry keeps the bar in view along the axis', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-28T12:00:00-04:00') })
    await page.setViewportSize({ width: 900, height: 800 })
    await page.goto('/sv-grid/#/demos/371-scheduler-timeline')
    const bar = page.locator('.sv-sched-tl-bar[data-ev-key]').first()
    await bar.waitFor({ timeout: 120_000 })
    await bar.focus()
    await page.keyboard.press('Space')
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('ArrowRight')
      expect(await inSight(page)).toBeGreaterThan(0.99)
    }
    await page.keyboard.press('Escape')
  })
})
