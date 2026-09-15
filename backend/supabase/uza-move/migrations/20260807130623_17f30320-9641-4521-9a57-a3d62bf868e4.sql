ALTER TYPE wallet_tx_type ADD VALUE IF NOT EXISTS 'cancellation_fee';
ALTER TYPE wallet_tx_type ADD VALUE IF NOT EXISTS 'cancellation_payout';

ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS cancellation_fee numeric NOT NULL DEFAULT 0;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS cancelled_by uuid;

ALTER TABLE public.trips REPLICA IDENTITY FULL;
