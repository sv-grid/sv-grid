// Config for `npm run auth:schema` only. The Better Auth CLI cannot read the
// app's tsconfig (it extends `$app/tsconfig`) or load SvelteKit modules, so it
// runs from this folder against the shared shape in auth-options.ts.
import { betterAuth } from 'better-auth/minimal';
import { authShape } from '../../src/lib/server/auth-options.ts';

export const auth = betterAuth(authShape);
