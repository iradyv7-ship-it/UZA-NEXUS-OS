import type { Destination } from '@uza/contracts';

/**
 * The client-facing copy for "your container is confirmed". Item 6 of the 2026-09-14
 * gap-closure audit calls this out BY NAME as something to get right: warm and human, not a
 * raw data dump. Kept as pure functions (no I/O) so the wording is unit-testable on its own,
 * separately from the notification dispatch plumbing in ContainerService/ShipmentDetailsService.
 */
export interface ContainerNoticeContext {
  readonly shipmentRef: string;
  readonly container: string;
  readonly destination: Destination;
  readonly vesselName?: string | null;
  readonly voyageNumber?: string | null;
  readonly ventureCode?: string | null;
  readonly goodsDescription?: string | null;
}

/** MOBILITY ships vehicles; every other venture ships goods/cargo. Kept to a small, honest
 *  vocabulary rather than guessing at product copy per venture. */
const goodsNoun = (ventureCode?: string | null): string =>
  ventureCode === 'MOBILITY' ? "vehicle's" : 'shipment’s';

export const customerContainerMessage = (ctx: ContainerNoticeContext): string => {
  const vessel =
    ctx.vesselName && ctx.voyageNumber
      ? ` It’s on ${ctx.vesselName}, voyage ${ctx.voyageNumber},`
      : ctx.vesselName
        ? ` It’s on ${ctx.vesselName},`
        : '';
  const goods = ctx.goodsDescription ? ` (${ctx.goodsDescription})` : '';
  return (
    `Great news — your ${goodsNoun(ctx.ventureCode)} container is confirmed and on its way!` +
    `${vessel} container ${ctx.container}${goods}, heading to ${ctx.destination}. ` +
    `We’ll keep you posted as it moves.`
  );
};

/** The internal, information-dense counterpart for customer-care staff (front_office
 *  today — see the role-mapping note in ContainerService) fielding client questions. */
export const careContainerMessage = (ctx: ContainerNoticeContext): string => {
  const vessel = [ctx.vesselName, ctx.voyageNumber ? `voyage ${ctx.voyageNumber}` : null]
    .filter(Boolean)
    .join(', ');
  const venture = ctx.ventureCode ?? 'unassigned venture';
  const goods = ctx.goodsDescription ?? 'goods description not yet recorded';
  return (
    `Container confirmed for ${ctx.shipmentRef} (${venture}): ${vessel || 'vessel/voyage pending'}, ` +
    `container ${ctx.container}, destination ${ctx.destination}, goods: ${goods}. ` +
    `Expect client questions.`
  );
};
