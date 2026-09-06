import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1400, height: 1400 } })
await p.goto('http://localhost:5180/sv-grid/demos/', { waitUntil: 'load' })
await p.waitForTimeout(2500)
for (const cat of ['EDITING', 'SELECTION & CLIPBOARD']) {
  const btn = p.locator('button', { hasText: cat }).first()
  await btn.click().catch(() => {})
  await p.waitForTimeout(600)
}
const out = await p.evaluate(() => {
  const t = document.body.innerText
  return {
    move429: t.includes('Drag a range'),
    bar430: t.includes('Bulk-action bar'),
    // Counts shown next to each category header.
    editingCount: (t.match(/EDITING\n(\d+)/) || [])[1],
    selectionCount: (t.match(/SELECTION & CLIPBOARD\n(\d+)/) || [])[1],
  }
})
console.log(JSON.stringify(out, null, 1))
await b.close()
