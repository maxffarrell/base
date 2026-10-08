import './def.ts';
import { registerEntity } from '#lib/server/entities/registry.ts';
import { getEntityDef } from '#lib/entities.ts';
import { stockItem, stockMovement } from './table.ts';

registerEntity({ def: getEntityDef('stock_item')!, table: stockItem });
registerEntity({ def: getEntityDef('stock_movement')!, table: stockMovement });
