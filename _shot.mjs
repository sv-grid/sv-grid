import { chromium } from 'playwright'
const OUT='C:/Users/boiko/AppData/Local/Temp/claude/c--xampp-htdocs-sv-grid/db2ff9e2-5f80-4e5c-96b3-a1ee3b6aa5ef/scratchpad/'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1360, height: 900 } })
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())})
// direct to the calendar editor demo
await p.goto('http://localhost:5180/demos/250-calendar', { waitUntil: 'networkidle' })
await p.waitForTimeout(1600)
const state = await p.evaluate(() => ({
  product: document.querySelector('.product-switch h1')?.textContent ?? null,
  hasCal: !!document.querySelector('.sv-cal'),
  lanes: Array.from(document.querySelectorAll('.product-menu, aside')).length,
}))
console.log('state:', JSON.stringify(state), '| errors:', errs.slice(0,5))
await p.screenshot({ path: OUT+'website-editors.png' })
await b.close()
