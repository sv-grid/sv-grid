import { RESEND_API_KEY, EMAIL_FROM } from '$app/env/private';

export type Email = { to: string; subject: string; text: string };

/**
 * Sends through Resend when RESEND_API_KEY is set. Without it the email is
 * printed to the server console, so password reset works in development with
 * no account anywhere. Swap the fetch for your provider; nothing else calls it.
 */
export async function sendEmail(email: Email): Promise<void> {
	if (!RESEND_API_KEY) {
		console.log(`\n--- email to ${email.to}: ${email.subject}\n${email.text}\n---\n`);
		return;
	}
	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({ from: EMAIL_FROM ?? 'onboarding@resend.dev', ...email })
	});
	if (!res.ok) throw new Error(`Resend refused the email: ${res.status} ${await res.text()}`);
}
