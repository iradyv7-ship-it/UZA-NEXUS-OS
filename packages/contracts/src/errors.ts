/**
 * Error taxonomy.
 *
 * The booking gates and the release gate are the product. When one fires, a
 * human has to know what to do about it, and the frontend has to render it in
 * four languages. If each module throws its own ad-hoc string, that becomes
 * impossible — so the codes are shared.
 */
export const UZA_ERRORS = {
  // authorisation
  ACCESS_DENIED_ROLE:        'Your role does not permit this action.',
  ACCESS_DENIED_SCOPE:       'This record is outside your access.',

  // finance gates
  PAYMENT_SHORT:             'Payment does not settle the next installment.',
  PAYMENT_NOT_VERIFIED:      'Payment is awaiting verification by Finance.',
  DEPOSIT_BELOW_MINIMUM:     'Deposit is below the minimum policy percentage.',

  // booking gates, in the order they are checked
  GATE_VARIANCE_UNRESOLVED:  'Volumetric variance is unresolved. A decision is needed on who carries the extra freight.',
  GATE_PRELOADING_UNPAID:    'The pre-loading installment is unpaid.',
  GATE_MIXED_DESTINATION:    'Containers carry one destination only.',

  // quality gates
  GATE_QC_NOT_RELEASED:      'Packages have not passed quality release.',
  CAPA_REINSPECTION_FAILED:  'A corrective action cannot close against a failed reinspection.',

  // release gate
  GATE_BALANCE_OUTSTANDING:  'Goods stay in the warehouse until the balance is settled.',
} as const;

export type UzaErrorCode = keyof typeof UZA_ERRORS;

export interface UzaErrorDetail {
  readonly code: UzaErrorCode;
  /** English default. The web app localises from the code, not this string. */
  readonly message: string;
  /** What the user should do, and who can do it. */
  readonly nextAction?: string;
  readonly responsibleRole?: string;
  /** Refs that make the error actionable, e.g. { orderRef, shortfallMinor } */
  readonly context?: Record<string, string | number>;
}

export class UzaError extends Error {
  readonly code: UzaErrorCode;
  readonly nextAction: string | undefined;
  readonly responsibleRole: string | undefined;
  readonly context: Record<string, string | number> | undefined;

  constructor(detail: Omit<UzaErrorDetail, 'message'> & { message?: string }) {
    super(detail.message ?? UZA_ERRORS[detail.code]);
    this.name = 'UzaError';
    this.code = detail.code;
    this.nextAction = detail.nextAction;
    this.responsibleRole = detail.responsibleRole;
    this.context = detail.context;
  }

  toJSON(): UzaErrorDetail {
    return {
      code: this.code,
      message: this.message,
      ...(this.nextAction !== undefined ? { nextAction: this.nextAction } : {}),
      ...(this.responsibleRole !== undefined ? { responsibleRole: this.responsibleRole } : {}),
      ...(this.context !== undefined ? { context: this.context } : {}),
    };
  }
}
