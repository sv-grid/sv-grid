import { db } from '#lib/server/db/index.ts';
import { auditLog } from '#lib/server/db/schema.ts';

export type Actor = { id: string; email: string } | null | undefined;

/** Record one action. Failures are logged, never thrown: auditing must not break the action. */
export async function audit(actor: Actor, action: string, target?: string, detail?: Record<string, unknown>) {
	try {
		await db.insert(auditLog).values({ actorId: actor?.id, actorEmail: actor?.email, action, target, detail });
	} catch (error) {
		console.error('audit failed', action, error);
	}
}
