import { deserialize, type ActionResult } from '$app/forms';

type Fields = Record<string, string | number | null | undefined | ReadonlyArray<string>>;

/**
 * Call a page's form action from code (a grid edit, a toolbar button) and get
 * its result back, the same way `use:enhance` does for a <form>.
 *
 *   const result = await callAction('?/update', { id, field, value })
 *   if (result.type === 'failure') show(result.data?.message)
 */
export async function callAction(action: string, fields: Fields): Promise<ActionResult> {
	const body = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		if (Array.isArray(value)) for (const v of value) body.append(key, v);
		else if (value != null) body.append(key, String(value));
	}
	const res = await fetch(action, { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
	return deserialize(await res.text());
}

/** The `message` a failed action returned, or a fallback. */
export function failureMessage(result: ActionResult, fallback = 'Something went wrong. Try again.'): string | null {
	if (result.type === 'failure') return (result.data?.message as string | undefined) ?? fallback;
	if (result.type === 'error') return fallback;
	return null;
}
