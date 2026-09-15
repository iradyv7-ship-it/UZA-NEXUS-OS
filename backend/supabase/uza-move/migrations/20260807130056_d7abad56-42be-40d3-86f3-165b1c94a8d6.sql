-- 1. Idempotency: one ledger row per (wallet, type, reference)
DELETE FROM public.wallet_transactions a
USING public.wallet_transactions b
WHERE a.ref IS NOT NULL AND a.ref = b.ref AND a.wallet_id = b.wallet_id
  AND a.type = b.type AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_idempotent
  ON public.wallet_transactions (wallet_id, type, ref) WHERE ref IS NOT NULL;

-- 2. Atomic ledger posting: row-locked, idempotent, single statement from callers
CREATE OR REPLACE FUNCTION public.wallet_post(
  _owner uuid,
  _type public.wallet_tx_type,
  _amount numeric,
  _delta numeric DEFAULT 0,
  _savings_delta numeric DEFAULT 0,
  _owed_delta numeric DEFAULT 0,
  _ref text DEFAULT NULL,
  _note text DEFAULT NULL
) RETURNS public.wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE w public.wallets;
BEGIN
  INSERT INTO public.wallets(owner_id) VALUES (_owner) ON CONFLICT (owner_id) DO NOTHING;
  SELECT * INTO w FROM public.wallets WHERE owner_id = _owner FOR UPDATE;

  IF _ref IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.wallet_transactions
    WHERE wallet_id = w.id AND type = _type AND ref = _ref
  ) THEN
    RETURN w;
  END IF;

  UPDATE public.wallets
     SET balance = balance + COALESCE(_delta, 0),
         locked_savings = locked_savings + COALESCE(_savings_delta, 0),
         commission_owed = commission_owed + COALESCE(_owed_delta, 0)
   WHERE id = w.id
   RETURNING * INTO w;

  INSERT INTO public.wallet_transactions(wallet_id, type, amount, balance_after, ref, note)
  VALUES (w.id, _type, _amount, w.balance, _ref, _note);

  RETURN w;
END; $$;

REVOKE ALL ON FUNCTION public.wallet_post(uuid, public.wallet_tx_type, numeric, numeric, numeric, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_post(uuid, public.wallet_tx_type, numeric, numeric, numeric, numeric, text, text) TO service_role;

-- 3. One person, one identity document; one plate per vehicle
CREATE UNIQUE INDEX IF NOT EXISTS drivers_national_id_unique
  ON public.drivers (lower(national_id)) WHERE national_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS drivers_licence_unique
  ON public.drivers (lower(licence_number)) WHERE licence_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS drivers_plate_unique
  ON public.drivers (lower(plate_number)) WHERE plate_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_plate_unique
  ON public.vehicles (lower(plate_number));
