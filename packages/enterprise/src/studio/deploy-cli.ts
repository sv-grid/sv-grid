/**
 * `svgrid-studio deploy` - the pure, testable core. Resolves WHICH provider to
 * deploy to (explicit flag > studio.config.json's deploy target > the SvelteKit
 * adapter in svelte.config.js - never a guess) and WHAT commands that means.
 * The thin CLI in @svgrid/studio does the file reads + process spawning.
 */

export type DeployProvider = 'vercel' | 'netlify' | 'cloudflare' | 'node'

export type DeployResolution =
  | { ok: true; provider: DeployProvider; source: 'flag' | 'config' | 'adapter' }
  | { ok: false; reason: string }

const PROVIDERS: DeployProvider[] = ['vercel', 'netlify', 'cloudflare', 'node']

/** Adapter package -> provider (what svelte.config.js imports). */
const ADAPTERS: Array<[string, DeployProvider]> = [
  ['@sveltejs/adapter-vercel', 'vercel'],
  ['@sveltejs/adapter-netlify', 'netlify'],
  ['@sveltejs/adapter-cloudflare', 'cloudflare'],
  ['@sveltejs/adapter-node', 'node'],
]

const GUIDANCE =
  'Set a target: pass --target vercel|netlify|cloudflare|node, pick a deploy target in the Studio designer ' +
  '(saved to studio.config.json), or pin a concrete SvelteKit adapter in svelte.config.js.'

/** Resolve the deploy provider from the inputs the CLI gathered (all optional). */
export function resolveDeployTarget(inputs: { flag?: string; configJson?: string | null; svelteConfig?: string | null }): DeployResolution {
  const { flag, configJson, svelteConfig } = inputs
  if (flag !== undefined) {
    if ((PROVIDERS as string[]).includes(flag)) return { ok: true, provider: flag as DeployProvider, source: 'flag' }
    return { ok: false, reason: `Unknown --target "${flag}". Use one of: ${PROVIDERS.join(' | ')}.` }
  }
  if (configJson) {
    try {
      const deploy = (JSON.parse(configJson) as { deploy?: string }).deploy
      if (deploy && (PROVIDERS as string[]).includes(deploy)) return { ok: true, provider: deploy as DeployProvider, source: 'config' }
      // 'auto' (or unset) means the project never chose a provider - don't guess one.
    } catch {
      /* unreadable config - fall through to the adapter */
    }
  }
  if (svelteConfig) {
    for (const [pkg, provider] of ADAPTERS) if (svelteConfig.includes(pkg)) return { ok: true, provider, source: 'adapter' }
  }
  return { ok: false, reason: `No deploy target configured. ${GUIDANCE}` }
}

export type DeployPlanCommands = {
  provider: DeployProvider
  /** Run first - validates the app compiles before anything leaves the machine. */
  build: string
  /** The provider CLI command, or null when there's nothing to run (node target). */
  deploy: string | null
  /** Shown before running (login hints, what the command does). */
  notes: string[]
}

/** The commands a provider deploy runs - same one-liners the generated `deploy` script uses. */
export function deployCommands(provider: DeployProvider): DeployPlanCommands {
  switch (provider) {
    case 'vercel':
      return { provider, build: 'npm run build', deploy: 'npx vercel deploy --prod', notes: ['Needs a Vercel login (npx vercel login) and a linked project (first run prompts to link).'] }
    case 'netlify':
      return { provider, build: 'npm run build', deploy: 'npx netlify deploy --build --prod', notes: ['Needs a Netlify login (npx netlify login) and a linked site (npx netlify link).'] }
    case 'cloudflare':
      return { provider, build: 'npm run build', deploy: 'npx wrangler pages deploy', notes: ['Needs a Cloudflare login (npx wrangler login).'] }
    case 'node':
      return {
        provider,
        build: 'npm run build',
        deploy: null,
        notes: [
          'The node target has no hosted provider - after the build, run it yourself:',
          '  node build            # serves on PORT (default 3000)',
          '  docker build -t app . && docker run -p 3000:3000 --env-file .env app',
        ],
      }
  }
}

/** Env keys declared in .env.example (uncommented `KEY=` lines) that are absent
 *  from the local .env - surfaced as a preflight warning before deploying. */
export function missingEnvKeys(envExample: string | null, envLocal: string | null): string[] {
  if (!envExample) return []
  const declared = envExample
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[A-Z][A-Z0-9_]*=/.test(l))
    .map((l) => l.slice(0, l.indexOf('=')))
  const present = new Set(
    (envLocal ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^[A-Z][A-Z0-9_]*=.+/.test(l))
      .map((l) => l.slice(0, l.indexOf('='))),
  )
  return declared.filter((k) => !present.has(k))
}
