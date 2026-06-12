import adapter from '@sveltejs/adapter-vercel'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // adapter-vercel ships zero-config to Vercel. Swap for adapter-auto,
    // adapter-static, adapter-node, etc. if you deploy elsewhere.
    adapter: adapter(),
  },
}

export default config
