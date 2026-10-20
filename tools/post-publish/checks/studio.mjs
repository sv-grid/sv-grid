/**
 * SvGrid Studio from the registry: the create-studio starter, the starter
 * built --from a Prisma schema, `svgrid-studio init` from a sample dataset
 * and from a live SQLite file, and `svgrid-studio add --all` into an app that
 * already has a layout. Each app is installed, type-checked, built, tested
 * where it has tests, and served.
 *
 * SVGRID_PP_STUDIO=starter,sqlite limits the run to those scenarios
 * (starter, from-prisma, dataset, sqlite, add-all).
 */
import { readFileSync as readText } from 'node:fs'
import { join, resolve } from 'node:path'
import { existsSync, freePort, loadPage, readJson, registryDoc, semverFrom, serve, sleep, tail, writeFileSync } from '../lib.mjs'

export const name = 'studio'
export const description = 'create-studio starter, --from prisma, studio init (dataset, sqlite) and add --all, installed and run'

// The one console line @svgrid/enterprise prints without a key (watermark.ts).
const ENTERPRISE_NOTICE = 'User is using a Commercial version which requires a license.'

// Two related models: a relation lookup, a boolean, a float.
const PRISMA = `model Account {
  id       Int       @id @default(autoincrement())
  name     String
  invoices Invoice[]
}

model Invoice {
  id        Int     @id @default(autoincrement())
  number    String
  amount    Float
  paid      Boolean @default(false)
  account   Account @relation(fields: [accountId], references: [id])
  accountId Int
}
`

function pageProblems(r) {
  const errs = []
  if (r.status !== 200) errs.push(`HTTP ${r.status}`)
  for (const e of r.pageErrors) errs.push(`page error: ${e}`)
  for (const e of r.consoleErrors) if (!e.includes(ENTERPRISE_NOTICE)) errs.push(`console error: ${e}`)
  for (const f of r.failed) if (!f.startsWith('net::ERR_ABORTED')) errs.push(`request failed: ${f}`)
  return errs
}

function gridRows(page) {
  return page.evaluate(() => {
    const g = document.querySelector('[role=grid], [role=treegrid]')
    if (!g) return 0
    return [...g.querySelectorAll('[role=row]')].filter((r) => r.querySelector('[role=gridcell]') && !/No rows to display/.test(r.textContent)).length
  })
}

const preview = async (ctx, dir, env = {}) => {
  const port = await freePort()
  const url = `http://127.0.0.1:${port}`
  const srv = await serve(`npm run preview -- --port ${port} --strictPort --host 127.0.0.1`, { cwd: dir, url, env: { ...ctx.env, ...env } })
  return { url, srv }
}

export async function run(ctx) {
  const semver = semverFrom(ctx.work)
  const only = process.env.SVGRID_PP_STUDIO?.split(',').map((s) => s.trim()).filter(Boolean)
  const want = (id) => !only || only.includes(id)
  const vCreate = ctx.versions['create-studio']
  const vStudio = ctx.versions.studio
  const root = ctx.dir('studio')
  const schemaFile = join(root, 'schema.prisma')
  writeFileSync(schemaFile, PRISMA)

  const rangesResolve = (label, dir) =>
    ctx.step(`${label}: package.json ranges resolve on npm`, async () => {
      const pkg = readJson(join(dir, 'package.json'))
      const problems = []
      for (const field of ['dependencies', 'devDependencies']) {
        for (const [dep, range] of Object.entries(pkg[field] ?? {})) {
          if (/^(workspace|file|link):/.test(range)) { problems.push(`${dep}@${range} is a workspace/file range`); continue }
          if (range === 'latest') continue
          const doc = await registryDoc(dep)
          if (!doc) problems.push(`${dep} is not on npm`)
          else if (!semver.maxSatisfying(Object.keys(doc.versions), range)) problems.push(`${dep}@${range} matches no published version`)
        }
      }
      if (problems.length) throw new Error(problems.join('\n'))
    })

  /** install, check, build, test (when the app has tests); false once install fails. */
  async function lifecycle(label, dir, { order = ['check', 'build', 'test'] } = {}) {
    await rangesResolve(label, dir)
    const installed = await ctx.step(`${label}: npm install`, async () => {
      const r = await ctx.ok('npm install', { cwd: dir })
      const peer = r.out.split('\n').filter((l) => /ERESOLVE|conflicting peer|unmet peer|peer dep|Could not resolve dependency/i.test(l))
      if (peer.length) throw new Error(`peer dependency warnings:\n${peer.slice(0, 15).join('\n')}`)
    })
    if (!installed) return { installed: false, built: false }
    const scripts = readJson(join(dir, 'package.json')).scripts ?? {}
    let built = false
    for (const what of order) {
      if (what === 'check' && scripts.check) {
        await ctx.step(`${label}: npm run check`, async () => {
          const r = await ctx.sh('npm run check', { cwd: dir })
          // svelte-check prints a sentence on a TTY and a COMPLETED line otherwise.
          const m = r.out.match(/found (\d+) errors? and (\d+) warnings?/) ?? r.out.match(/(\d+) ERRORS (\d+) WARNINGS/)
          if (r.code !== 0 || !m || m[1] !== '0') throw new Error(`exit ${r.code}:\n${tail(r.out)}`)
          return `${m[2]} warning(s)`
        })
      }
      if (what === 'build') built = await ctx.step(`${label}: npm run build`, () => ctx.ok('npm run build', { cwd: dir }).then(() => ''))
      if (what === 'test' && scripts.test) {
        await ctx.step(`${label}: npm test`, async () => {
          const r = await ctx.ok('npm test', { cwd: dir })
          return r.out.match(/Tests\s+(\d+ passed[^\n]*)/)?.[1]?.trim() ?? ''
        })
      }
    }
    return { installed: true, built }
  }

  // ---- create-studio starter --------------------------------------------
  if (want('starter')) {
    const dir = join(root, 'starter')
    const L = 'starter'
    const made = await ctx.step(`${L}: npm create @svgrid/studio@${vCreate}`, async () => {
      await ctx.ok(`npm create @svgrid/studio@${vCreate} starter`, { cwd: root, input: '' })
      if (!existsSync(join(dir, 'package.json'))) throw new Error('no package.json written')
    })
    if (made) {
      const { built } = await lifecycle(L, dir)
      if (built) {
        const { url, srv } = await preview(ctx, dir)
        try {
          await ctx.step(`${L}: preview renders / and /customers`, async () => {
            const notes = []
            for (const path of ['/', '/customers']) {
              const shot = join(dir, `post-publish${path.replace(/\W+/g, '-')}.png`)
              const r = await loadPage(url + path, { screenshot: shot, waitFor: path === '/' ? 'main, h1' : '[role=grid] [role=gridcell]' })
              try {
                const problems = pageProblems(r)
                if (path !== '/') {
                  const rows = await gridRows(r.page)
                  if (!rows) problems.push(`no grid rows on ${path}`)
                  else notes.push(`${path}: ${rows} rows`)
                }
                if (problems.length) throw new Error(`${path}:\n${problems.join('\n')}\nscreenshot: ${shot}`)
              } finally {
                await r.page.close()
              }
            }
            return notes.join(', ')
          })

          await ctx.step(`${L}: edit modal's primary button keeps its label on hover`, async () => {
            const shot = join(dir, 'post-publish-save-hover.png')
            const r = await loadPage(`${url}/customers`, { waitFor: '[role=grid] [role=gridcell]' })
            const page = r.page
            try {
              const cell = page.locator('[role=grid] [role=row] [role=gridcell]').filter({ hasText: /\w{3,}/ }).first()
              await cell.dblclick()
              const save = page.getByRole('dialog').getByRole('button', { name: /^save$/i })
              await save.waitFor({ timeout: 10_000 })
              await save.hover()
              await sleep(400)
              const css = await save.evaluate((b) => {
                const s = getComputedStyle(b)
                return { color: s.color, bg: s.backgroundColor, text: b.textContent.trim() }
              })
              await page.screenshot({ path: shot })
              if (!css.text) throw new Error('the button has no text')
              if (css.color === css.bg) throw new Error(`on hover the label color equals the background (${css.color})\nscreenshot: ${shot}`)
              return `"${css.text}" ${css.color} on ${css.bg}`
            } finally {
              await page.close()
            }
          })
        } finally {
          srv.stop()
        }
      }
    }
  }

  // ---- create-studio --from prisma --------------------------------------
  if (want('from-prisma')) {
    const dir = join(root, 'from-prisma')
    const L = 'from-prisma'
    const made = await ctx.step(`${L}: npm create @svgrid/studio@${vCreate} -- --from schema.prisma`, async () => {
      const r = await ctx.ok(`npm create @svgrid/studio@${vCreate} from-prisma -- --from schema.prisma`, { cwd: root, input: '' })
      if (!existsSync(join(dir, 'package.json'))) throw new Error(`no package.json written:\n${tail(r.out)}`)
      for (const route of ['Account', 'Invoice', 'account', 'invoice', 'accounts', 'invoices']) if (existsSync(join(dir, 'src', 'routes', route))) return `route /${route}`
      throw new Error(`no route for Account or Invoice under src/routes:\n${tail(r.out)}`)
    })
    if (made) await lifecycle(L, dir, { order: ['check', 'build', 'test'] })
  }

  // ---- studio init --dataset customers-orders ----------------------------
  if (want('dataset')) {
    const cwd = join(root, 'dataset')
    const dir = join(cwd, 'app')
    const L = 'init --dataset'
    const made = await ctx.step(`${L}: npx @svgrid/studio@${vStudio} init --dataset customers-orders`, async () => {
      ctx.dir(join('studio', 'dataset'))
      await ctx.ok(`npx -y @svgrid/studio@${vStudio} init --dataset customers-orders --out app -y`, { cwd, input: '' })
      if (!existsSync(join(dir, 'package.json'))) throw new Error('no package.json written')
    })
    if (made) {
      const { built } = await lifecycle(L, dir, { order: ['check', 'test', 'build'] })
      if (built) {
        const { url, srv } = await preview(ctx, dir)
        try {
          await ctx.step(`${L}: server-rendered /orders shows customer names`, async () => {
            const { customers, orders } = seedFromStore(join(dir, 'src', 'lib', 'server', 'store.ts'))
            const res = await fetch(`${url}/orders`)
            const html = await res.text()
            if (res.status !== 200) throw new Error(`GET /orders: HTTP ${res.status}\n${html.slice(0, 400)}`)
            // Only the markup: the hydration payload in <script> also holds the names.
            const markup = html.replace(/<script[\s\S]*?<\/script>/g, '')
            const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
            const found = orders
              .map((o) => ({ o, at: markup.indexOf(`>${esc(o.ref)}<`) }))
              .filter((x) => x.at >= 0)
              .sort((a, z) => a.at - z.at)
            if (!found.length) throw new Error(`no order reference in the server HTML:\n${markup.slice(markup.indexOf('<body'), markup.indexOf('<body') + 600)}`)
            const wrong = []
            found.forEach(({ o, at }, i) => {
              const row = markup.slice(at, found[i + 1]?.at ?? at + 4000)
              const label = customers.get(o.customer)
              if (!label || !row.includes(esc(label))) wrong.push(`${o.ref}: expected "${label}" (${o.customer})`)
            })
            if (wrong.length) throw new Error(`rows without their customer name:\n${wrong.join('\n')}`)
            return `${found.length} rows with customer names`
          })

          await ctx.step(`${L}: /orders and /customers render in the browser`, async () => {
            const notes = []
            for (const path of ['/orders', '/customers']) {
              const shot = join(dir, `post-publish${path.replace(/\W+/g, '-')}.png`)
              const r = await loadPage(url + path, { screenshot: shot, waitFor: 'table, [role=grid]' })
              try {
                const problems = pageProblems(r)
                const rows = await r.page.evaluate(() => document.querySelectorAll('[role=gridcell], td').length)
                if (!rows) problems.push(`no cells on ${path}`)
                if (problems.length) throw new Error(`${path}:\n${problems.join('\n')}\nscreenshot: ${shot}`)
                notes.push(`${path}: ${rows} cells`)
              } finally {
                await r.page.close()
              }
            }
            return notes.join(', ')
          })
        } finally {
          srv.stop()
        }
      }
    }
  }

  // ---- studio init --db sqlite -------------------------------------------
  if (want('sqlite')) {
    const cwd = join(root, 'sqlite')
    const dir = join(cwd, 'app')
    const L = 'init --db sqlite'
    const init = async () => {
      const r = await ctx.ok(`npx -y @svgrid/studio@${vStudio} init --db sqlite --url ./shop.db --out app -y`, { cwd, input: '' })
      if (!existsSync(join(dir, 'package.json'))) throw new Error(`no package.json written:\n${tail(r.out)}`)
      return /Found (\d+) tables/.exec(r.out)?.[0] ?? ''
    }
    // The scenario dir sits under the work dir, which has its own package.json
    // and node_modules: a user running init inside an existing project.
    let made = await ctx.step(`${L}: npx @svgrid/studio@${vStudio} init --db sqlite --url ./shop.db (driver not installed yet)`, async () => {
      ctx.dir(join('studio', 'sqlite'))
      await makeShopDb(join(cwd, 'shop.db'))
      return init()
    })
    // A failed first run says "try running the command again"; do that, so a
    // driver-install failure does not hide what the generated app does.
    if (!made && existsSync(join(cwd, 'shop.db'))) made = await ctx.step(`${L}: init again (driver now installed)`, init)
    if (made) {
      await ctx.step(`${L}: .env holds a DATABASE_URL that reaches shop.db`, async () => {
        const envFile = join(dir, '.env')
        if (!existsSync(envFile)) throw new Error('no .env written')
        const url = readText(envFile, 'utf8').match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim()
        if (!url) throw new Error(`.env has no DATABASE_URL:\n${readText(envFile, 'utf8')}`)
        if (resolve(dir, url) !== resolve(cwd, 'shop.db')) throw new Error(`DATABASE_URL=${url} resolves to ${resolve(dir, url)}, not ${resolve(cwd, 'shop.db')}`)
        return `DATABASE_URL=${url}`
      })
      const { built } = await lifecycle(L, dir, { order: ['check', 'build', 'test'] })
      if (built) {
        const { url, srv } = await preview(ctx, dir)
        try {
          await ctx.step(`${L}: /api routes return the SQLite rows`, async () => {
            const notes = []
            for (const [table, want] of [['customers', 'Ada Corp'], ['orders', 'ORD-1']]) {
              const res = await fetch(`${url}/api/${table}`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ kind: 'query', request: { startRow: 0, endRow: 50, pageIndex: 0, pageSize: 50, sortModel: [], filterModel: {} } }),
              })
              const body = await res.text()
              if (res.status !== 200) throw new Error(`POST /api/${table}: HTTP ${res.status}\n${body.slice(0, 600)}\nserver:\n${tail(srv.log(), 15)}`)
              const rows = JSON.parse(body).rows ?? []
              if (rows.length !== 2 || !body.includes(want)) throw new Error(`POST /api/${table}: expected 2 rows incl. "${want}", got ${body.slice(0, 400)}`)
              notes.push(`${table}: ${rows.length}`)
            }
            return notes.join(', ')
          })
          await ctx.step(`${L}: /orders renders in the browser`, async () => {
            const shot = join(dir, 'post-publish-orders.png')
            const r = await loadPage(`${url}/orders`, { screenshot: shot, waitFor: 'table, [role=grid]' })
            try {
              const problems = pageProblems(r)
              const text = await r.page.evaluate(() => document.body.innerText)
              if (!text.includes('ORD-1')) problems.push(`no order rows; page says:\n${text.slice(0, 400)}`)
              if (problems.length) throw new Error(`${problems.join('\n')}\nscreenshot: ${shot}`)
            } finally {
              await r.page.close()
            }
          })
        } finally {
          srv.stop()
        }
      }
    }
  }

  // ---- studio add --all into the starter ---------------------------------
  if (want('add-all')) {
    const dir = join(root, 'add-all')
    const L = 'add --all'
    const made = await ctx.step(`${L}: scaffold a starter to add into`, () =>
      ctx.ok(`npm create @svgrid/studio@${vCreate} add-all`, { cwd: root, input: '' }).then(() => ''),
    )
    if (made) {
      await ctx.step(`${L}: keeps the starter's +layout.svelte and writes +layout.svelte.new`, async () => {
        const layout = join(dir, 'src', 'routes', '+layout.svelte')
        const before = readText(layout, 'utf8')
        const r = await ctx.ok(`npx -y @svgrid/studio@${vStudio} add --all --from ../schema.prisma`, { cwd: dir, input: '' })
        const after = readText(layout, 'utf8')
        if (after !== before) throw new Error(`+layout.svelte was overwritten:\n${tail(r.out)}`)
        if (!existsSync(`${layout}.new`)) throw new Error(`no +layout.svelte.new beside it:\n${tail(r.out)}`)
        return ''
      })
    }
  }
}

/** Customer id -> name and each order's reference + customer, from the seeded store. */
function seedFromStore(file) {
  const src = readText(file, 'utf8')
  const arrayAfter = (marker) => {
    const at = src.indexOf(marker)
    if (at < 0) throw new Error(`${file}: no ${marker}`)
    const start = src.indexOf('[', at)
    let depth = 0
    for (let i = start; i < src.length; i++) {
      if (src[i] === '[') depth++
      else if (src[i] === ']' && --depth === 0) return JSON.parse(src.slice(start, i + 1))
    }
    throw new Error(`${file}: unterminated array after ${marker}`)
  }
  const customers = new Map(arrayAfter('customersStore =').map((c) => [c.id, c.name]))
  const orders = arrayAfter('ordersStore =').map((o) => ({ ref: o.reference, customer: o.customer_id }))
  return { customers, orders }
}

/** A two-table SQLite file with a foreign key, written with node:sqlite. */
async function makeShopDb(file) {
  const emit = process.emitWarning
  process.emitWarning = () => {}
  let sqlite
  try {
    sqlite = await import('node:sqlite')
  } finally {
    process.emitWarning = emit
  }
  const db = new sqlite.DatabaseSync(file)
  db.exec(`create table customers (id integer primary key, name text not null);
create table orders (id integer primary key, number text not null, amount real, customer_id integer references customers(id));
insert into customers values (1, 'Ada Corp'), (2, 'Turing Ltd');
insert into orders values (1, 'ORD-1', 10, 1), (2, 'ORD-2', 20, 2);`)
  db.close()
}
