import '#lib/modules/index.ts';
import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
import Settings from '@lucide/svelte/icons/settings';
import Puzzle from '@lucide/svelte/icons/puzzle';
import Box from '@lucide/svelte/icons/box';
import { entityLabel, listEntityDefs } from '#lib/entities.ts';
import type { Component } from 'svelte';

type NavItem = { href: string; label: string; icon: Component; key: string };

/**
 * Main nav is registry-driven: each module `nav` entry becomes an item.
 * `key` is the second key of the `g <key>` keyboard shortcut.
 */
export const mainNav: NavItem[] = [
	{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, key: 'd' },
	...listEntityDefs().map((d, i) => ({
		href: `/${d.name}`,
		label: entityLabel(d),
		icon: d.icon ?? Box,
		key: String(i + 1)
	}))
];

export const secondaryNav: NavItem[] = [
	{ href: '/settings/integrations', label: 'Integrations', icon: Puzzle, key: 'i' },
	{ href: '/settings', label: 'Settings', icon: Settings, key: 's' }
];

export const allNav = [...mainNav, ...secondaryNav];
