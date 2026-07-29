import type { OrderStatus, QuotationStatus } from './types';

/**
 * The product promise: every record shows its stage, the next action, and WHO owns that
 * action. A status without an owner is a failed screen, so this is the single place that
 * derives owner + next-action from lifecycle state. `ownerRole` keys into owner.* i18n;
 * `ownerId` is the readable ref of the specific responsible person when we know it
 * (secondary to the human role, per the charter).
 */

export type OwnerRole =
  | 'venture_manager' | 'finance' | 'china_sourcing' | 'logistics' | 'front_office' | 'none';

export interface Promise {
  /** i18n key for the human-readable stage label. */
  stageKey: string;
  /** i18n key for the next action. */
  nextKey: string;
  /** i18n key suffix for the responsible role (owner.<role>). */
  ownerRole: OwnerRole;
}

export function quotationPromise(status: QuotationStatus): Promise {
  switch (status) {
    case 'draft':
      return { stageKey: 'stage.quotation.draft', nextKey: 'next.quotation.draft', ownerRole: 'venture_manager' };
    case 'approved':
      return { stageKey: 'stage.quotation.approved', nextKey: 'next.quotation.approved', ownerRole: 'venture_manager' };
    case 'superseded':
      return { stageKey: 'stage.quotation.superseded', nextKey: 'next.quotation.superseded', ownerRole: 'venture_manager' };
  }
}

export function orderPromise(status: OrderStatus): Promise {
  switch (status) {
    case 'awaiting_payment':
      // Payment gates procurement — Finance verifies the confirmation deposit (charter rule 1).
      return { stageKey: 'stage.order.awaiting_payment', nextKey: 'next.order.awaiting_payment', ownerRole: 'finance' };
    case 'procurement_active':
      return { stageKey: 'stage.order.procurement_active', nextKey: 'next.order.procurement_active', ownerRole: 'china_sourcing' };
    case 'in_transit':
      return { stageKey: 'stage.order.in_transit', nextKey: 'next.order.in_transit', ownerRole: 'logistics' };
    case 'delivered':
      return { stageKey: 'stage.order.delivered', nextKey: 'next.order.delivered', ownerRole: 'front_office' };
    case 'cancelled':
      return { stageKey: 'stage.order.cancelled', nextKey: 'next.order.cancelled', ownerRole: 'none' };
  }
}
