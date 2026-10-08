import { command, query } from '$app/server';
import * as v from 'valibot';
import { requireOrg } from '#lib/server/context.ts';
import {
	listShares,
	shareRecord,
	sharedWithMe,
	unshareRecord
} from '#lib/server/services/shares.ts';
import { assertNotDemo } from '#lib/server/demo-mode.ts';

const entityName = v.pipe(v.string(), v.minLength(1), v.maxLength(60));
const ref = v.object({ entity: entityName, id: v.string() });

export const getShares = query(ref, async ({ entity, id }) => {
	const { orgId } = await requireOrg();
	return listShares(orgId, entity, id);
});

export const shareEntityRecord = command(
	v.object({ entity: entityName, id: v.string(), toUserId: v.string() }),
	async ({ entity, id, toUserId }) => {
		const { orgId, userId } = await requireOrg();
		assertNotDemo();
		await shareRecord(orgId, entity, id, { fromUserId: userId, toUserId });
		void getShares({ entity, id }).refresh();
		void getSharedWithMe().refresh();
	}
);

export const unshareEntityRecord = command(
	v.object({ entity: entityName, id: v.string(), toUserId: v.string() }),
	async ({ entity, id, toUserId }) => {
		const { orgId } = await requireOrg();
		assertNotDemo();
		await unshareRecord(orgId, entity, id, toUserId);
		void getShares({ entity, id }).refresh();
	}
);

export const getSharedWithMe = query(async () => {
	const { orgId, userId } = await requireOrg();
	return sharedWithMe(orgId, userId);
});
