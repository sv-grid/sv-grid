import { bigserial, boolean, date, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { PROJECT_STATUS } from '../../projects.ts';
import { PLAN_IDS } from '../../plans.ts';
import { user } from './auth.schema.ts';

export * from './auth.schema.ts';

export const projectStatus = PROJECT_STATUS;

/**
 * The example of "your product's data". Rename it, add columns, and the
 * Projects screen shows how to list, edit and validate it.
 */
export const project = pgTable(
	'project',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		ownerId: text('owner_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		client: text('client'),
		status: text('status', { enum: projectStatus }).notNull().default('planned'),
		/** Whole currency units. */
		budget: integer('budget'),
		dueDate: date('due_date'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(t) => [index('project_owner_idx').on(t.ownerId)]
);

/** The Stripe customer behind each account, created on the first checkout. */
export const billingCustomer = pgTable('billing_customer', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	customerId: text('customer_id').notNull().unique(),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

/**
 * A copy of each Stripe subscription, written by the webhook. Stripe stays
 * the source of truth: every write re-reads the subscription from Stripe, so
 * events arriving out of order can't leave a stale status here.
 */
export const subscription = pgTable(
	'subscription',
	{
		/** The Stripe subscription id (sub_...). */
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		customerId: text('customer_id').notNull(),
		/** Stripe's status: active, trialing, past_due, canceled, unpaid, incomplete, ... */
		status: text('status').notNull(),
		plan: text('plan', { enum: PLAN_IDS }).notNull(),
		priceId: text('price_id'),
		/** Price per interval in the smallest currency unit (cents). */
		amount: integer('amount'),
		currency: text('currency'),
		interval: text('interval'),
		currentPeriodEnd: timestamp('current_period_end'),
		cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
		endedAt: timestamp('ended_at'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(t) => [index('subscription_user_idx').on(t.userId), index('subscription_status_idx').on(t.status)]
);

/** Every sign-in and admin action, newest first on the Audit log screen. */
export const auditLog = pgTable(
	'audit_log',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		at: timestamp('at').defaultNow().notNull(),
		actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
		/** Kept as text so the row still reads after the account is deleted. */
		actorEmail: text('actor_email'),
		action: text('action').notNull(),
		target: text('target'),
		detail: jsonb('detail')
	},
	(t) => [index('audit_at_idx').on(t.at), index('audit_action_idx').on(t.action)]
);
