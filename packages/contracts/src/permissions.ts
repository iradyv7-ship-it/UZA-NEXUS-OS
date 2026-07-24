/**
 * Role grants, object scope and field masking.
 * Authorisation happens at the SERVICE layer, because object scope depends on
 * the record being touched, not on the route.
 */
export type Role =
  | 'ceo' | 'venture_manager' | 'china_sourcing' | 'china_warehouse'
  | 'front_office' | 'finance' | 'sales_agent' | 'customer' | 'logistics_partner';

export interface Actor {
  readonly userId: string;
  readonly role: Role;
  readonly office: string;
  readonly scope: {
    customerId?: string;
    customerIds?: readonly string[];
    shipmentRefs?: readonly string[];
  };
}

export const ROLE_GRANTS: Record<Role, readonly string[]> = {
  ceo: ['*:*'],
  venture_manager: [
    'lead:*', 'request:*', 'project:*', 'task:*', 'quotation:*', 'order:*',
    'customer:read', 'supplier:read', 'shipment:read', 'shipment:create',
    'package:read', 'package:update', 'invoice:read', 'payment:read',
  ],
  china_sourcing: [
    'supplier:*', 'rfq:*', 'supplierQuote:*', 'po:*', 'visit:create',
    'inspection:read', 'capa:*', 'project:read', 'task:read', 'package:read',
  ],
  china_warehouse: [
    'visit:read', 'visit:accept', 'inspection:*', 'package:*', 'receipt:*',
    'supplier:read', 'po:read', 'capa:read',
  ],
  front_office: [
    'customer:read', 'call:*', 'promise:*', 'quotation:read', 'quotation:draft',
    'project:read', 'order:read', 'shipment:read', 'pettyCash:*',
  ],
  finance: [
    'invoice:*', 'payment:*', 'installment:*', 'po:approve', 'margin:read',
    'commission:*', 'project:read', 'order:read', 'supplier:read', 'claim:*',
  ],
  sales_agent: [
    'lead:create', 'lead:read', 'customer:create', 'customer:read',
    'request:create', 'quotation:read', 'order:read', 'commission:read',
  ],
  customer: [
    'project:read', 'quotation:read', 'order:read', 'invoice:read',
    'payment:create', 'shipment:read', 'package:read',
  ],
  logistics_partner: ['shipment:read', 'package:read', 'delivery:*', 'customsDoc:*'],
};

/**
 * Masked on READ, not filtered in the UI. A field absent from this map is visible
 * to anyone whose role grant already allows the resource.
 */
export const CONFIDENTIAL_FIELDS: Record<string, readonly Role[]> = {
  supplierUnitCost: ['ceo', 'china_sourcing', 'venture_manager', 'finance'],
  poTotal:          ['ceo', 'china_sourcing', 'venture_manager', 'finance'],
  targetPrice:      ['ceo', 'china_sourcing', 'venture_manager', 'finance'],
  walkawayPrice:    ['ceo', 'china_sourcing', 'venture_manager', 'finance'],
  marginPct:        ['ceo', 'venture_manager', 'finance'],
  realizedMargin:   ['ceo', 'venture_manager', 'finance'],
  agentCommission:  ['ceo', 'finance', 'sales_agent'],
};

export const MASK = '***' as const;

export const can = (actor: Actor, resource: string, action: string): boolean => {
  const grants = ROLE_GRANTS[actor.role];
  return ['*:*', `${resource}:*`, `*:${action}`, `${resource}:${action}`]
    .some((g) => grants.includes(g));
};

/**
 * Object scope. Resolve explicitly per role — never guess from attribute names.
 * Guessing was a real defect in the reference implementation: a partner scoped to
 * shipments reaches a delivery, a package and a customs doc by different paths.
 */
export interface Scopable {
  customerId?: string;
  agentId?: string;
  shipmentRef?: string;
  ref?: string;
  kind?: string;
}

export const inScope = (actor: Actor, obj: Scopable): boolean => {
  switch (actor.role) {
    case 'ceo': case 'venture_manager': case 'finance':
    case 'china_sourcing': case 'china_warehouse': case 'front_office':
      return true;
    case 'customer':
      return !!obj.customerId && obj.customerId === actor.scope.customerId;
    case 'sales_agent':
      return obj.agentId === actor.userId ||
        (!!obj.customerId && (actor.scope.customerIds ?? []).includes(obj.customerId));
    case 'logistics_partner': {
      const ref = obj.shipmentRef ?? (obj.kind === 'shipment' ? obj.ref : undefined);
      return !!ref && (actor.scope.shipmentRefs ?? []).includes(ref);
    }
  }
};

export const maskFields = <T extends Record<string, unknown>>(
  actor: Actor, record: T,
): { [K in keyof T]: T[K] | typeof MASK } => {
  const out = {} as { [K in keyof T]: T[K] | typeof MASK };
  for (const key of Object.keys(record) as (keyof T)[]) {
    const allowed = CONFIDENTIAL_FIELDS[key as string];
    out[key] = !allowed || allowed.includes(actor.role) ? record[key] : MASK;
  }
  return out;
};
