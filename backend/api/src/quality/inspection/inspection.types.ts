/**
 * Local re-exports of the quality unions from @uza/contracts, so this module refers to
 * one name each without redeclaring the shape. These MIRROR the contract types
 * (InspectionStage, Inspection.result) — they do not redefine them.
 */
import type { InspectionStage as ContractInspectionStage, Inspection } from '@uza/contracts';

export type InspectionStage = ContractInspectionStage;
export type InspectionResult = Inspection['result'];
