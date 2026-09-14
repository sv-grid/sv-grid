// `aria-description` (ARIA 1.3) is what the chart uses to hand a screen
// reader its plain-language summary. Svelte's element typings predate it,
// so this adds the attribute to every element's ARIA set rather than casting
// at the one use site.
import 'svelte/elements'

declare module 'svelte/elements' {
  interface AriaAttributes {
    'aria-description'?: string | null | undefined
  }
}
