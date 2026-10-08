/** Per-user list-column visibility, kept in localStorage per entity. */

const key = (entity: string) => `base:cols-hidden:${entity}`;

/** Hidden column keys, or null when the user has never customized this list. */
export function readHiddenCols(entity: string): string[] | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(key(entity));
		return raw === null ? null : (JSON.parse(raw) as string[]);
	} catch {
		return null;
	}
}

export function writeHiddenCols(entity: string, hidden: string[]) {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(key(entity), JSON.stringify(hidden));
}

const viewKey = (page: string) => `base:default-view:${page}`;

/** Saved-view id applied automatically on a list page, or null. */
export function readDefaultView(page: string): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem(viewKey(page));
}

export function writeDefaultView(page: string, viewId: string | null) {
	if (typeof localStorage === 'undefined') return;
	if (viewId === null) localStorage.removeItem(viewKey(page));
	else localStorage.setItem(viewKey(page), viewId);
}
