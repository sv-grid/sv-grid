/// <reference types="svelte" />
/// <reference types="vite/client" />

// Svelte's internal client runtime + version marker have no public types.
// The playground's in-browser runner hands these singletons to compiled
// components, so we only need them to exist as modules.
declare module 'svelte/internal/client'
declare module 'svelte/internal/disclose-version'
