/** Shown in the header, page titles and emails. */
export const APP_NAME = 'Acme';

/** Where signed-in people land. */
export const HOME = '/dashboard';

/** Only allow same-site paths in ?next=, so a link can't bounce people off-site after sign-in. */
export function safeNext(next: string | null | undefined): string {
	return next && next.startsWith('/') && !next.startsWith('//') ? next : HOME;
}
