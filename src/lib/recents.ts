/** Recently viewed records, kept per-browser in localStorage (no server state). */

export type Recent = { entity: string; label: string; id: string; title: string; at: number };

const KEY = 'base:recents';
const MAX = 10;

export function readRecents(): Recent[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Recent[];
	} catch {
		return [];
	}
}

export function pushRecent(entry: Omit<Recent, 'at'>) {
	if (typeof localStorage === 'undefined') return;
	const rest = readRecents().filter((r) => !(r.entity === entry.entity && r.id === entry.id));
	localStorage.setItem(KEY, JSON.stringify([{ ...entry, at: Date.now() }, ...rest].slice(0, MAX)));
}
