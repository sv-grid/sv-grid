/**
 * E2E: every /api member's example is actually runnable.
 *
 * `tools/check-api-examples.mjs` proves the composed examples COMPILE. That is
 * not the same claim as "runnable": a snippet can compile and still blow up on
 * mount because it references a name nobody imported, or throw the moment you
 * press its Run button. Both of those are what the reader hits after clicking
 * "Open in playground", so both are checked here, in a real browser, through
 * the same compile-and-mount path the playground uses.
 *
 * Everything happens inside ONE page: the site's own modules are imported and
 * driven in-page, so 300+ examples cost one navigation instead of 300.
 */
import { expect, test } from '@playwright/test'

const PAGE = '/sv-grid/#/api'

type Failure = { id: string; mode: string; stage: string; message: string }

/** Compose, compile and mount every member example; report what breaks. */
async function runAll(page: import('@playwright/test').Page, clickRun: boolean): Promise<Failure[]> {
  return page.evaluate(async (withRun: boolean) => {
    const base = '/sv-grid/src/lib/'
    const { sections } = (await import(/* @vite-ignore */ `${base}api-reference.ts`)) as any
    const { buildRunnableExample } = (await import(/* @vite-ignore */ `${base}api-playground.ts`)) as any
    const { compileComponent, mount, unmount } = (await import(
      /* @vite-ignore */ `${base}svelte-runner.ts`
    )) as any

    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;height:600px;'
    document.body.appendChild(host)

    const settle = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      )

    const failures: Failure[] = []

    for (const section of sections) {
      for (const prop of section.props ?? []) {
        const built = buildRunnableExample(section, prop)
        if (!built) continue
        const id = `${section.id} :: ${prop.name}`
        let instance: unknown = null
        try {
          const { Component } = await compileComponent(
            built.source,
            'examples/src/demos/_api-example.svelte',
          )
          instance = mount(Component, { target: host })
          await settle()

          if (withRun) {
            const runBtn = host.querySelector('[data-run-example]') as HTMLButtonElement | null
            if (runBtn) {
              runBtn.click()
              await settle()
              const err = host.querySelector('[data-example-error]')
              if (err) {
                failures.push({
                  id,
                  mode: built.mode,
                  stage: 'run',
                  message: (err.textContent ?? '').trim(),
                })
              }
            }
          }
        } catch (e) {
          failures.push({
            id,
            mode: built.mode,
            stage: 'mount',
            message: (e as Error)?.message ?? String(e),
          })
        } finally {
          try {
            if (instance) unmount(instance)
          } catch {
            /* a component that failed to mount has nothing to tear down */
          }
          host.innerHTML = ''
        }
      }
    }

    host.remove()
    return failures
  }, clickRun)
}

const report = (failures: Failure[]) => {
  const text = failures
    .map((f) => `  - [${f.mode}/${f.stage}] ${f.id}\n      ${f.message.split('\n')[0]}`)
    .join('\n')
  // Printed as well as asserted: the diff of an array of objects is unreadable
  // once there is more than a couple of them.
  if (text) console.log(`\n${failures.length} example(s) failed:\n${text}\n`)
  return text
}

test.describe('/api runnable examples (real browser)', () => {
  // 300+ compile + mount cycles, each booting a real grid. Slow on purpose:
  // this is the check that the docs are not lying.
  test.slow()

  test('every member example mounts', async ({ page }) => {
    await page.goto(PAGE)
    await page.getByRole('heading', { name: '<SvGrid />' }).first().waitFor()

    const failures = await runAll(page, false)
    expect(failures, `Examples that do not mount:\n${report(failures)}`).toEqual([])
  })

  test('every Run button executes without throwing', async ({ page }) => {
    await page.goto(PAGE)
    await page.getByRole('heading', { name: '<SvGrid />' }).first().waitFor()

    const failures = await runAll(page, true)
    expect(failures, `Examples whose Run button throws:\n${report(failures)}`).toEqual([])
  })

  // The path a reader actually takes: expand a member, press the button, land
  // in the playground with a live grid.
  test('"Open in playground" hands the example to the playground', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (e) => pageErrors.push(e.message))
    await page.goto(PAGE)

    const row = page.locator('tr', { has: page.getByText('emptyMessage', { exact: true }) }).first()
    await row.locator('button.api-expand').click()
    await page.getByRole('button', { name: 'Open in playground' }).first().click()

    // The playground took over: the member is named in the bar, the composed
    // source is in the editor, and the example's own grid is mounted.
    await expect(page).toHaveURL(/playground\/api-example/)
    // The playground is a lazy route pulling in CodeMirror + the compilers; on
    // a cold dev server that transform is not a 5-second affair.
    await expect(page.locator('.pg-switch-label')).toContainText('emptyMessage', { timeout: 60_000 })
    await expect(page.getByRole('link', { name: /back to API reference/i })).toBeVisible()
    await expect(page.locator('.sv-grid-row').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('.pg-foot-err')).toHaveCount(0)
    expect(pageErrors, `Uncaught errors on the way to the playground:\n${pageErrors.join('\n')}`).toEqual([])
  })
})
