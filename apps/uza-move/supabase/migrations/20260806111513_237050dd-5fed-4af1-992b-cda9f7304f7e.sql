-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','ops','operator','driver','rider','advertiser');
CREATE TYPE public.vehicle_type AS ENUM ('moto','cab','e_moto','delivery');
CREATE TYPE public.trip_status AS ENUM ('requested','accepted','arriving','started','completed','cancelled_by_rider','cancelled_by_driver','no_show');
CREATE TYPE public.pay_method AS ENUM ('momo','cash');
CREATE TYPE public.pay_status AS ENUM ('pending','paid','failed','cash_collected');
CREATE TYPE public.momo_provider AS ENUM ('mtn','airtel');
CREATE TYPE public.momo_direction AS ENUM ('collection','disbursement');
CREATE TYPE public.momo_status AS ENUM ('pending','successful','failed');
CREATE TYPE public.wallet_tx_type AS ENUM ('trip_credit','commission','commission_owed','commission_settled','savings_sweep','savings_release','topup','payout','charging_reward','parts_discount','recycling_credit','ad_spend','referral_bonus','loan_installment');
CREATE TYPE public.savings_rule_type AS ENUM ('fixed_daily','percent_trip','round_up','none');
CREATE TYPE public.ad_placement AS ENUM ('rider_home_banner','post_trip','receipt','driver_idle');
CREATE TYPE public.ad_status AS ENUM ('draft','pending_review','approved','rejected','running','paused','ended');
CREATE TYPE public.driver_status AS ENUM ('pending','approved','suspended','rejected');

-- UPDATED_AT HELPER
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  language TEXT NOT NULL DEFAULT 'rw',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_ops(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','ops'));
$$;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_ops(auth.uid()));
CREATE POLICY "own profile write" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "roles read own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_ops(auth.uid()));
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- NEW USER HANDLER
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.wallets (owner_id) VALUES (NEW.id) ON CONFLICT (owner_id) DO NOTHING;
  RETURN NEW;
END; $$;

-- OPERATORS (cooperatives / fleets)
CREATE TABLE public.operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'cooperative',
  district TEXT,
  admin_user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.operators TO authenticated;
GRANT ALL ON public.operators TO service_role;
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operators read" ON public.operators FOR SELECT TO authenticated USING (true);
CREATE POLICY "operators manage" ON public.operators FOR ALL TO authenticated USING (public.is_ops(auth.uid()) OR admin_user_id = auth.uid()) WITH CHECK (public.is_ops(auth.uid()) OR admin_user_id = auth.uid());

-- DRIVERS
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  operator_id UUID REFERENCES public.operators ON DELETE SET NULL,
  national_id TEXT,
  licence_number TEXT,
  vehicle_type public.vehicle_type NOT NULL DEFAULT 'moto',
  plate_number TEXT,
  vehicle_photo_url TEXT,
  vest_photo_url TEXT,
  photo_url TEXT,
  status public.driver_status NOT NULL DEFAULT 'pending',
  is_online BOOLEAN NOT NULL DEFAULT false,
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  rating_avg NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  rating_count INTEGER NOT NULL DEFAULT 0,
  uza_score INTEGER NOT NULL DEFAULT 500,
  training_certified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drivers readable" ON public.drivers FOR SELECT TO authenticated USING (true);
CREATE POLICY "drivers insert own" ON public.drivers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "drivers update own" ON public.drivers FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_ops(auth.uid())) WITH CHECK (user_id = auth.uid() OR public.is_ops(auth.uid()));
CREATE TRIGGER trg_drivers_updated BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RIDERS
CREATE TABLE public.riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  phone_verified BOOLEAN NOT NULL DEFAULT false,
  momo_phone TEXT,
  rating_avg NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  rating_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.riders TO authenticated;
GRANT ALL ON public.riders TO service_role;
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "riders own" ON public.riders FOR ALL TO authenticated USING (user_id = auth.uid() OR public.is_ops(auth.uid())) WITH CHECK (user_id = auth.uid());

-- VEHICLES
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES public.drivers ON DELETE SET NULL,
  vehicle_type public.vehicle_type NOT NULL DEFAULT 'moto',
  plate_number TEXT NOT NULL,
  make TEXT, model TEXT, year INTEGER,
  is_electric BOOLEAN NOT NULL DEFAULT false,
  financed BOOLEAN NOT NULL DEFAULT false,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicles read" ON public.vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "vehicles manage" ON public.vehicles FOR ALL TO authenticated
  USING (public.is_ops(auth.uid()) OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()))
  WITH CHECK (public.is_ops(auth.uid()) OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()));

-- WALLETS
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  locked_savings NUMERIC(14,2) NOT NULL DEFAULT 0,
  commission_owed NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RWF',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet own read" ON public.wallets FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.is_ops(auth.uid()));
CREATE TRIGGER trg_wallets_updated BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets ON DELETE CASCADE,
  type public.wallet_tx_type NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  balance_after NUMERIC(14,2) NOT NULL DEFAULT 0,
  ref TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet tx own read" ON public.wallet_transactions FOR SELECT TO authenticated
  USING (public.is_ops(auth.uid()) OR EXISTS (SELECT 1 FROM public.wallets w WHERE w.id = wallet_id AND w.owner_id = auth.uid()));

-- MOMO
CREATE TABLE public.momo_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider public.momo_provider NOT NULL DEFAULT 'mtn',
  direction public.momo_direction NOT NULL,
  phone TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  external_ref TEXT NOT NULL UNIQUE,
  status public.momo_status NOT NULL DEFAULT 'pending',
  trip_id UUID,
  initiated_by UUID REFERENCES auth.users ON DELETE SET NULL,
  callback_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.momo_transactions TO authenticated;
GRANT ALL ON public.momo_transactions TO service_role;
ALTER TABLE public.momo_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "momo own read" ON public.momo_transactions FOR SELECT TO authenticated USING (initiated_by = auth.uid() OR public.is_ops(auth.uid()));
CREATE TRIGGER trg_momo_updated BEFORE UPDATE ON public.momo_transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FARES
CREATE TABLE public.fare_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  district TEXT,
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_km NUMERIC(6,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fare_zones TO authenticated;
GRANT ALL ON public.fare_zones TO service_role;
ALTER TABLE public.fare_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zones read" ON public.fare_zones FOR SELECT TO authenticated USING (true);
CREATE POLICY "zones manage" ON public.fare_zones FOR ALL TO authenticated USING (public.is_ops(auth.uid())) WITH CHECK (public.is_ops(auth.uid()));

CREATE TABLE public.fare_tariffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_type public.vehicle_type NOT NULL,
  zone_id UUID REFERENCES public.fare_zones ON DELETE SET NULL,
  base_fare NUMERIC(10,2) NOT NULL,
  per_km NUMERIC(10,2) NOT NULL,
  per_minute NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_fare NUMERIC(10,2) NOT NULL,
  waiting_per_minute NUMERIC(10,2) NOT NULL DEFAULT 0,
  surge_enabled BOOLEAN NOT NULL DEFAULT false,
  surge_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.08,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fare_tariffs TO authenticated;
GRANT ALL ON public.fare_tariffs TO service_role;
ALTER TABLE public.fare_tariffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tariffs read" ON public.fare_tariffs FOR SELECT TO authenticated USING (true);
CREATE POLICY "tariffs manage" ON public.fare_tariffs FOR ALL TO authenticated USING (public.is_ops(auth.uid())) WITH CHECK (public.is_ops(auth.uid()));
CREATE TRIGGER trg_tariffs_updated BEFORE UPDATE ON public.fare_tariffs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.fare_tariffs (vehicle_type, base_fare, per_km, per_minute, min_fare, waiting_per_minute)
VALUES ('moto', 300, 250, 20, 500, 15), ('cab', 700, 500, 40, 1200, 30), ('e_moto', 300, 220, 20, 500, 15), ('delivery', 500, 300, 20, 800, 20);

INSERT INTO public.fare_zones (name, district, center_lat, center_lng, radius_km) VALUES
('Kigali Centre','Nyarugenge',-1.9441,30.0619,6),
('Kimironko','Gasabo',-1.9370,30.1270,5),
('Remera','Gasabo',-1.9580,30.1100,5),
('Kicukiro','Kicukiro',-1.9830,30.1030,6);

-- TRIPS
CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers ON DELETE SET NULL,
  vehicle_type public.vehicle_type NOT NULL DEFAULT 'moto',
  pickup_lat DOUBLE PRECISION NOT NULL,
  pickup_lng DOUBLE PRECISION NOT NULL,
  pickup_address TEXT,
  dropoff_lat DOUBLE PRECISION NOT NULL,
  dropoff_lng DOUBLE PRECISION NOT NULL,
  dropoff_address TEXT,
  distance_km NUMERIC(8,2) NOT NULL DEFAULT 0,
  duration_min NUMERIC(8,2) NOT NULL DEFAULT 0,
  quoted_fare NUMERIC(10,2) NOT NULL,
  final_fare NUMERIC(10,2),
  commission_amount NUMERIC(10,2),
  driver_earnings NUMERIC(10,2),
  pay_method public.pay_method,
  pay_status public.pay_status NOT NULL DEFAULT 'pending',
  status public.trip_status NOT NULL DEFAULT 'requested',
  start_pin TEXT NOT NULL,
  tariff_id UUID REFERENCES public.fare_tariffs ON DELETE SET NULL,
  share_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(9),'hex'),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trips read party" ON public.trips FOR SELECT TO authenticated USING (
  rider_id = auth.uid() OR public.is_ops(auth.uid())
  OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid())
  OR (status = 'requested' AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid() AND d.is_online AND d.vehicle_type = trips.vehicle_type))
);
CREATE POLICY "trips insert rider" ON public.trips FOR INSERT TO authenticated WITH CHECK (rider_id = auth.uid());
CREATE POLICY "trips update party" ON public.trips FOR UPDATE TO authenticated USING (
  rider_id = auth.uid() OR public.is_ops(auth.uid())
  OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid())
) WITH CHECK (true);
CREATE TRIGGER trg_trips_updated BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_trips_status ON public.trips(status);
CREATE INDEX idx_trips_driver ON public.trips(driver_id);
CREATE INDEX idx_trips_rider ON public.trips(rider_id);

CREATE TABLE public.trip_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  actor_id UUID REFERENCES auth.users ON DELETE SET NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.trip_events TO authenticated;
GRANT ALL ON public.trip_events TO service_role;
ALTER TABLE public.trip_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trip events read" ON public.trip_events FOR SELECT TO authenticated USING (
  public.is_ops(auth.uid()) OR EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND (t.rider_id = auth.uid() OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = t.driver_id AND d.user_id = auth.uid()))));
CREATE POLICY "trip events insert" ON public.trip_events FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

-- RATINGS / INCIDENTS
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  ratee_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id, rater_id)
);
GRANT SELECT, INSERT ON public.ratings TO authenticated;
GRANT ALL ON public.ratings TO service_role;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings read" ON public.ratings FOR SELECT TO authenticated USING (rater_id = auth.uid() OR ratee_id = auth.uid() OR public.is_ops(auth.uid()));
CREATE POLICY "ratings insert" ON public.ratings FOR INSERT TO authenticated WITH CHECK (rater_id = auth.uid());

CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES public.trips ON DELETE SET NULL,
  reporter_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  kind TEXT NOT NULL,
  description TEXT,
  lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.incidents TO authenticated;
GRANT ALL ON public.incidents TO service_role;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "incidents read" ON public.incidents FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR public.is_ops(auth.uid()));
CREATE POLICY "incidents insert" ON public.incidents FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "incidents ops update" ON public.incidents FOR UPDATE TO authenticated USING (public.is_ops(auth.uid())) WITH CHECK (public.is_ops(auth.uid()));

-- SAVINGS / LOANS
CREATE TABLE public.savings_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL UNIQUE REFERENCES public.drivers ON DELETE CASCADE,
  rule_type public.savings_rule_type NOT NULL DEFAULT 'percent_trip',
  fixed_daily NUMERIC(10,2) NOT NULL DEFAULT 2000,
  percent NUMERIC(5,2) NOT NULL DEFAULT 10,
  round_to NUMERIC(10,2) NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.savings_rules TO authenticated;
GRANT ALL ON public.savings_rules TO service_role;
ALTER TABLE public.savings_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "savings rules own" ON public.savings_rules FOR ALL TO authenticated
  USING (public.is_ops(auth.uid()) OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()))
  WITH CHECK (public.is_ops(auth.uid()) OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()));

CREATE TABLE public.loan_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles ON DELETE SET NULL,
  principal NUMERIC(14,2) NOT NULL,
  collateral_blocked NUMERIC(14,2) NOT NULL DEFAULT 0,
  term_months INTEGER NOT NULL DEFAULT 48,
  installment_amount NUMERIC(14,2) NOT NULL,
  installment_period TEXT NOT NULL DEFAULT 'weekly',
  outstanding NUMERIC(14,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  started_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.loan_accounts TO authenticated;
GRANT ALL ON public.loan_accounts TO service_role;
ALTER TABLE public.loan_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loans own" ON public.loan_accounts FOR SELECT TO authenticated
  USING (public.is_ops(auth.uid()) OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()));
CREATE POLICY "loans ops manage" ON public.loan_accounts FOR ALL TO authenticated USING (public.is_ops(auth.uid())) WITH CHECK (public.is_ops(auth.uid()));

CREATE TABLE public.loan_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loan_accounts ON DELETE CASCADE,
  due_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'due'
);
GRANT SELECT, UPDATE ON public.loan_installments TO authenticated;
GRANT ALL ON public.loan_installments TO service_role;
ALTER TABLE public.loan_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "installments own" ON public.loan_installments FOR SELECT TO authenticated
  USING (public.is_ops(auth.uid()) OR EXISTS (SELECT 1 FROM public.loan_accounts l JOIN public.drivers d ON d.id = l.driver_id WHERE l.id = loan_id AND d.user_id = auth.uid()));

CREATE TABLE public.payout_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users ON DELETE SET NULL,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  driver_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payout_batches TO authenticated;
GRANT ALL ON public.payout_batches TO service_role;
ALTER TABLE public.payout_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payouts ops" ON public.payout_batches FOR ALL TO authenticated USING (public.is_ops(auth.uid())) WITH CHECK (public.is_ops(auth.uid()));

CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  referred_id UUID REFERENCES auth.users ON DELETE SET NULL,
  code TEXT NOT NULL UNIQUE,
  rewarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrals own" ON public.referrals FOR SELECT TO authenticated USING (referrer_id = auth.uid() OR public.is_ops(auth.uid()));
CREATE POLICY "referrals insert" ON public.referrals FOR INSERT TO authenticated WITH CHECK (referrer_id = auth.uid());

-- ECOSYSTEM
CREATE TABLE public.charging_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers ON DELETE CASCADE,
  station_name TEXT NOT NULL,
  kwh NUMERIC(8,2) NOT NULL,
  cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  reward_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.training_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers ON DELETE CASCADE,
  course TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  certificate_ref TEXT
);
CREATE TABLE public.parts_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers ON DELETE CASCADE,
  item TEXT NOT NULL,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.battery_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers ON DELETE CASCADE,
  battery_ref TEXT,
  credit_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.charging_sessions, public.training_records, public.parts_redemptions, public.battery_returns TO authenticated;
GRANT ALL ON public.charging_sessions, public.training_records, public.parts_redemptions, public.battery_returns TO service_role;
ALTER TABLE public.charging_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battery_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "charging own" ON public.charging_sessions FOR SELECT TO authenticated USING (public.is_ops(auth.uid()) OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()));
CREATE POLICY "training own" ON public.training_records FOR SELECT TO authenticated USING (public.is_ops(auth.uid()) OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()));
CREATE POLICY "parts own" ON public.parts_redemptions FOR SELECT TO authenticated USING (public.is_ops(auth.uid()) OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()));
CREATE POLICY "battery own" ON public.battery_returns FOR SELECT TO authenticated USING (public.is_ops(auth.uid()) OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()));

-- ADS
CREATE TABLE public.ad_advertisers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_phone TEXT,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ad_advertisers TO authenticated;
GRANT ALL ON public.ad_advertisers TO service_role;
ALTER TABLE public.ad_advertisers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "advertiser own" ON public.ad_advertisers FOR ALL TO authenticated USING (user_id = auth.uid() OR public.is_ops(auth.uid())) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id UUID NOT NULL REFERENCES public.ad_advertisers ON DELETE CASCADE,
  name TEXT NOT NULL,
  placement public.ad_placement NOT NULL,
  audience TEXT NOT NULL DEFAULT 'rider',
  zone_id UUID REFERENCES public.fare_zones ON DELETE SET NULL,
  vehicle_type public.vehicle_type,
  hour_start INTEGER NOT NULL DEFAULT 0,
  hour_end INTEGER NOT NULL DEFAULT 23,
  budget NUMERIC(14,2) NOT NULL DEFAULT 0,
  spent NUMERIC(14,2) NOT NULL DEFAULT 0,
  bill_model TEXT NOT NULL DEFAULT 'cpm',
  cpm NUMERIC(10,2) NOT NULL DEFAULT 500,
  cpc NUMERIC(10,2) NOT NULL DEFAULT 50,
  status public.ad_status NOT NULL DEFAULT 'draft',
  is_sponsored_offer BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ad_campaigns TO authenticated;
GRANT ALL ON public.ad_campaigns TO service_role;
ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaign own" ON public.ad_campaigns FOR ALL TO authenticated
  USING (public.is_ops(auth.uid()) OR EXISTS (SELECT 1 FROM public.ad_advertisers a WHERE a.id = advertiser_id AND a.user_id = auth.uid()))
  WITH CHECK (public.is_ops(auth.uid()) OR EXISTS (SELECT 1 FROM public.ad_advertisers a WHERE a.id = advertiser_id AND a.user_id = auth.uid()));
CREATE POLICY "campaign running readable" ON public.ad_campaigns FOR SELECT TO authenticated USING (status = 'running');
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON public.ad_campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ad_creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.ad_campaigns ON DELETE CASCADE,
  headline TEXT NOT NULL,
  body TEXT,
  image_url TEXT,
  cta_label TEXT,
  destination_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_creatives TO authenticated;
GRANT ALL ON public.ad_creatives TO service_role;
ALTER TABLE public.ad_creatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "creative manage" ON public.ad_creatives FOR ALL TO authenticated
  USING (public.is_ops(auth.uid()) OR EXISTS (SELECT 1 FROM public.ad_campaigns c JOIN public.ad_advertisers a ON a.id = c.advertiser_id WHERE c.id = campaign_id AND a.user_id = auth.uid()))
  WITH CHECK (public.is_ops(auth.uid()) OR EXISTS (SELECT 1 FROM public.ad_campaigns c JOIN public.ad_advertisers a ON a.id = c.advertiser_id WHERE c.id = campaign_id AND a.user_id = auth.uid()));
CREATE POLICY "creative running readable" ON public.ad_creatives FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ad_campaigns c WHERE c.id = campaign_id AND c.status = 'running'));

CREATE TABLE public.ad_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.ad_campaigns ON DELETE CASCADE,
  creative_id UUID REFERENCES public.ad_creatives ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  placement public.ad_placement NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.ad_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.ad_campaigns ON DELETE CASCADE,
  creative_id UUID REFERENCES public.ad_creatives ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  placement public.ad_placement NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ad_impressions, public.ad_clicks TO authenticated;
GRANT ALL ON public.ad_impressions, public.ad_clicks TO service_role;
ALTER TABLE public.ad_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "imp insert" ON public.ad_impressions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "imp read" ON public.ad_impressions FOR SELECT TO authenticated USING (public.is_ops(auth.uid()) OR EXISTS (SELECT 1 FROM public.ad_campaigns c JOIN public.ad_advertisers a ON a.id = c.advertiser_id WHERE c.id = campaign_id AND a.user_id = auth.uid()));
CREATE POLICY "click insert" ON public.ad_clicks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "click read" ON public.ad_clicks FOR SELECT TO authenticated USING (public.is_ops(auth.uid()) OR EXISTS (SELECT 1 FROM public.ad_campaigns c JOIN public.ad_advertisers a ON a.id = c.advertiser_id WHERE c.id = campaign_id AND a.user_id = auth.uid()));

-- AUTH TRIGGER (after wallets exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- REALTIME
ALTER TABLE public.trips REPLICA IDENTITY FULL;
ALTER TABLE public.drivers REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;
