// Runs before `npm run dev`. On a fresh clone there is no .env yet: copy
// .env.example and fill in a random BETTER_AUTH_SECRET, so the app starts with
// no setup. An existing .env is never touched.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

if (!existsSync('.env')) {
	const secret = randomBytes(32).toString('base64url');
	const env = readFileSync('.env.example', 'utf8').replace(/^BETTER_AUTH_SECRET=.*$/m, `BETTER_AUTH_SECRET="${secret}"`);
	writeFileSync('.env', env);
	console.log('Created .env from .env.example with a new BETTER_AUTH_SECRET.');
}
