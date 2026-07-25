/** Readable identifiers layered over UUID primary keys (spec section 4). */
export const ID_PATTERNS = {
  customer:    'CUS-{country}-{seq:6}',
  agent:       'AGT-{office}-{seq:4}',
  supplier:      'SUP-{country}-{seq:4}',
  rfq:           'RFQ-{year}-{seq:4}',
  supplierQuote: 'SQ-{seq:4}',
  lead:        'LED-{year}-{seq:4}',
  request:     'REQ-{venture}-{year}-{seq:4}',
  project:     'PRJ-{venture}-{year}-{seq:4}',
  task:        'TSK-{venture}-{year}-{seq:4}',
  quotation:   'QUO-{venture}-{year}-{seq:4}',
  order:       'ORD-{venture}-{year}-{seq:4}',
  installment: '{order}-{trigger}',
  invoice:     'INV-{venture}-{year}-{seq:4}',
  payment:     'PAY-{year}-{seq:4}',
  po:          'PO-{country}-{year}-{seq:4}',
  lot:         'LOT-{parent}-{seq:2}',
  package:     'PKG-{parent}-{seq:3}',
  visit:       'VIS-{country}-{year}-{seq:4}',
  inspection:  'INS-{country}-{year}-{seq:4}',
  capa:        'CAPA-{country}-{year}-{seq:4}',
  shipment:    'SHP-{year}-{seq:4}',
  delivery:    'DLV-{office}-{year}-{seq:4}',
  call:        'CALL-{year}-{seq:5}',
  claim:       'CLM-{year}-{seq:4}',
  pettyCash:   'PC-{office}-{year}-{seq:4}',
  bankChange:  'SBC-{year}-{seq:4}',
} as const;

export type IdKind = keyof typeof ID_PATTERNS;

/** Interfaces show project names, owners, stage and next action — not IDs. */
export interface Ref { readonly id: string; readonly ref: string }
