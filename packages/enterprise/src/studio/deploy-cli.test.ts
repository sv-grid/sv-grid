import { describe, expect, it } from 'vitest'
import { deployCommands, missingEnvKeys, resolveDeployTarget } from './deploy-cli'

describe('resolveDeployTarget', () => {
  it('an explicit --target wins and is validated', () => {
    expect(resolveDeployTarget({ flag: 'netlify', configJson: '{"deploy":"vercel"}' })).toEqual({ ok: true, provider: 'netlify', source: 'flag' })
    const bad = resolveDeployTarget({ flag: 'heroku' })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.reason).toMatch(/Unknown --target "heroku"/)
  })

  it('falls back to studio.config.json deploy, ignoring auto/unset (never guesses)', () => {
    expect(resolveDeployTarget({ configJson: '{"deploy":"cloudflare"}' })).toEqual({ ok: true, provider: 'cloudflare', source: 'config' })
    expect(resolveDeployTarget({ configJson: '{"deploy":"auto"}' }).ok).toBe(false)
    expect(resolveDeployTarget({ configJson: '{}' }).ok).toBe(false)
    expect(resolveDeployTarget({ configJson: 'not json' }).ok).toBe(false)
  })

  it('detects the provider from a pinned SvelteKit adapter', () => {
    const cfg = "import adapter from '@sveltejs/adapter-vercel'\nexport default { kit: { adapter: adapter() } }"
    expect(resolveDeployTarget({ svelteConfig: cfg })).toEqual({ ok: true, provider: 'vercel', source: 'adapter' })
    // adapter-auto is not a concrete provider - refuse with guidance.
    const auto = resolveDeployTarget({ svelteConfig: "import adapter from '@sveltejs/adapter-auto'" })
    expect(auto.ok).toBe(false)
    if (!auto.ok) expect(auto.reason).toMatch(/No deploy target configured/)
  })

  it('config beats adapter; flag beats both', () => {
    const svelteConfig = "import adapter from '@sveltejs/adapter-node'"
    expect(resolveDeployTarget({ configJson: '{"deploy":"netlify"}', svelteConfig })).toMatchObject({ provider: 'netlify', source: 'config' })
    expect(resolveDeployTarget({ flag: 'cloudflare', configJson: '{"deploy":"netlify"}', svelteConfig })).toMatchObject({ provider: 'cloudflare', source: 'flag' })
  })
})

describe('deployCommands', () => {
  it('providers build first, then run the same one-liners the generated deploy script uses', () => {
    expect(deployCommands('vercel')).toMatchObject({ build: 'npm run build', deploy: 'npx vercel deploy --prod' })
    expect(deployCommands('netlify').deploy).toBe('npx netlify deploy --build --prod')
    expect(deployCommands('cloudflare').deploy).toBe('npx wrangler pages deploy')
  })

  it('node has no provider command - instructions only', () => {
    const plan = deployCommands('node')
    expect(plan.deploy).toBeNull()
    expect(plan.notes.join('\n')).toMatch(/docker build/)
  })
})

describe('missingEnvKeys', () => {
  it('flags declared-but-unset keys, ignoring comments and filled values', () => {
    const example = '# note\nDATABASE_URL=\nSESSION_SECRET=change-me\n# VITE_SVPRO_KEY=\n'
    expect(missingEnvKeys(example, 'DATABASE_URL=postgres://x\n')).toEqual(['SESSION_SECRET'])
    expect(missingEnvKeys(example, null)).toEqual(['DATABASE_URL', 'SESSION_SECRET'])
    expect(missingEnvKeys(null, null)).toEqual([])
  })
})
