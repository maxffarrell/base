// Validated integrations bundled with Base. New integrations are contributed
// via the public integrations repository and synced here after review.
import type { IntegrationDefinition } from '@base/integration-sdk';

import slack from './slack/index.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each integration has its own config shape
export const integrations: IntegrationDefinition<any>[] = [slack];
