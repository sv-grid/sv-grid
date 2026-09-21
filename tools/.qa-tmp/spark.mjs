import { launch } from './lib.mjs'
const { browser, page, logs } = await launch()
await page.goto('http://localhost:5174/#/486-sheet-sparklines')
await page.locator('.sv-sheet td[data-svgrid-row]').first().waitFor({ timeout: 60000 })
await page.waitForTimeout(1000)
const info = await page.evaluate(() => {
  const svgs = document.querySelectorAll('.sv-sheet svg')
  const rects = document.querySelectorAll('.sv-sheet svg rect')
  return { svgs: svgs.length, rects: rects.length }
})
console.log('sparkline svgs:', info.svgs, 'rects(bars):', info.rects)
console.log('console errors:', logs.filter(e=>!/403|favicon|ResizeObserver/.test(e)).slice(0,3).join(' | ')||'none')
await browser.close()
