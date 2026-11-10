// Rules for project fields, shared by the grid (to flag a bad value while it
// is typed) and the server (to refuse it). The server check is the one that
// counts; the grid's is there so people see why before they press Enter.

export const PROJECT_STATUS = ['planned', 'active', 'paused', 'done'] as const;
export type ProjectStatus = (typeof PROJECT_STATUS)[number];

export const EDITABLE_FIELDS = ['name', 'client', 'status', 'budget', 'dueDate'] as const;
export type EditableField = (typeof EDITABLE_FIELDS)[number];

type Parsed = { ok: true; value: string | number | null } | { ok: false; error: string };

/** Turn a raw value (from a grid edit or a form) into what gets stored, or say why not. */
export function parseProjectField(field: EditableField, raw: unknown): Parsed {
	const text = raw == null ? '' : String(raw).trim();
	switch (field) {
		case 'name':
			if (!text) return { ok: false, error: 'A project needs a name' };
			if (text.length > 120) return { ok: false, error: 'Keep the name under 120 characters' };
			return { ok: true, value: text };
		case 'client':
			if (text.length > 120) return { ok: false, error: 'Keep the client under 120 characters' };
			return { ok: true, value: text || null };
		case 'status':
			return (PROJECT_STATUS as readonly string[]).includes(text)
				? { ok: true, value: text }
				: { ok: false, error: `Status is one of: ${PROJECT_STATUS.join(', ')}` };
		case 'budget': {
			if (!text) return { ok: true, value: null };
			const n = Number(text);
			if (!Number.isInteger(n) || n < 0) return { ok: false, error: 'Budget is a whole number, 0 or more' };
			if (n > 1_000_000_000) return { ok: false, error: 'Budget is over 1,000,000,000' };
			return { ok: true, value: n };
		}
		case 'dueDate': {
			if (!text) return { ok: true, value: null };
			const day = text.slice(0, 10);
			if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day))) return { ok: false, error: 'Use a date like 2027-03-31' };
			return { ok: true, value: day };
		}
	}
}

/** For a column's `validate`: null when fine, else the message. */
export function projectFieldError(field: EditableField, raw: unknown): string | null {
	const parsed = parseProjectField(field, raw);
	return parsed.ok ? null : parsed.error;
}
